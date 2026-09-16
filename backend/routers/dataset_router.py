import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from config import settings
from database import get_db, UserDB, DatasetDB
from models import DatasetResponse, DatasetMetadataUpdate
from auth import get_current_user, require_roles
import storage
from services.ai_policy_service import SUPPORTED_FORMATS

router = APIRouter(prefix="/v1/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = set(SUPPORTED_FORMATS.keys())


def dataset_to_response(d: DatasetDB, db: Session) -> DatasetResponse:
    binding = storage.get_binding_for_dataset(db, d.id)
    return DatasetResponse(
        id=d.id, owner_id=d.owner_id, name=d.name, description=d.description,
        file_format=d.file_format, file_size_bytes=d.file_size_bytes,
        row_count=d.row_count, column_names=d.column_names, tags=d.tags,
        visibility=d.visibility, confidentiality_level=d.confidentiality_level,
        has_policy=binding is not None, created_at=d.created_at
    )


@router.post("/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.upload_dir, stored_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse dataset metadata
    try:
        import pandas as pd
        from services.ai_policy_service import load_dataset_sample
        df, fmt = load_dataset_sample(file_path, max_rows=5000)
        col_names = list(df.columns)
        row_count = len(df)
    except Exception:
        col_names = []
        row_count = None
        fmt = ext.lstrip(".")

    dataset = DatasetDB(
        owner_id=current_user.id,
        name=name,
        description=description,
        filename=stored_filename,
        original_filename=file.filename,
        file_format=fmt,
        file_size_bytes=len(content),
        row_count=row_count,
        column_names=col_names,
    )
    dataset = storage.create_dataset(db, dataset)
    storage.append_audit_log(db, "DATASET_UPLOAD", current_user.id, dataset.id, "dataset", {"name": name, "format": fmt})

    return dataset_to_response(dataset, db)


@router.get("", response_model=List[DatasetResponse])
def list_datasets(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "data_holder":
        datasets = storage.get_datasets_for_owner(db, current_user.id)
    elif current_user.role in ("auditor", "admin"):
        datasets = storage.get_all_datasets(db)
    else:
        datasets = storage.get_published_datasets(db)
    return [dataset_to_response(d, db) for d in datasets]


@router.get("/marketplace", response_model=List[DatasetResponse])
def marketplace(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bindings = storage.get_published_bindings(db)
    dataset_ids = {b.dataset_id for b in bindings}
    datasets = [storage.get_dataset(db, did) for did in dataset_ids if storage.get_dataset(db, did)]
    return [dataset_to_response(d, db) for d in datasets]


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = storage.get_dataset(db, dataset_id)
    if not d:
        raise HTTPException(404, "Dataset not found")
    if current_user.role == "data_holder" and d.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")
    return dataset_to_response(d, db)


@router.patch("/{dataset_id}/metadata", response_model=DatasetResponse)
def update_metadata(
    dataset_id: str,
    body: DatasetMetadataUpdate,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    d = storage.get_dataset(db, dataset_id)
    if not d:
        raise HTTPException(404, "Dataset not found")
    if current_user.role == "data_holder" and d.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    if body.description is not None:
        d.description = body.description
    if body.tags is not None:
        d.tags = body.tags
    if body.visibility is not None:
        d.visibility = body.visibility
    if body.confidentiality_level is not None:
        d.confidentiality_level = body.confidentiality_level
    db.commit()

    return dataset_to_response(d, db)


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: str,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    d = storage.get_dataset(db, dataset_id)
    if not d:
        raise HTTPException(404, "Dataset not found")
    if current_user.role == "data_holder" and d.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    storage.soft_delete_dataset(db, dataset_id)
    storage.append_audit_log(db, "DATASET_DELETED", current_user.id, dataset_id, "dataset")
