import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db, UserDB
from models import ExportRequest, ExportResponse
from auth import get_current_user, require_roles
import storage
from services.export_service import run_export

router = APIRouter(tags=["exports"])


def export_to_response(e, base_url: str = "") -> ExportResponse:
    return ExportResponse(
        id=e.id, consumer_id=e.consumer_id, dataset_id=e.dataset_id,
        binding_id=e.binding_id, row_count=e.row_count or 0,
        fields_exported=e.fields_exported or [], fields_redacted=e.fields_redacted or [],
        created_at=e.created_at, download_url=f"/v1/exports/{e.id}/download"
    )


@router.post("/v1/export", response_model=ExportResponse, status_code=201)
def create_export(
    body: ExportRequest,
    current_user: UserDB = Depends(require_roles("consumer")),
    db: Session = Depends(get_db)
):
    binding = storage.get_binding(db, body.binding_id)
    if not binding or binding.status != "active":
        raise HTTPException(404, "Binding not found or inactive")

    # Check approved request exists
    requests = storage.get_requests_for_consumer(db, current_user.id)
    approved = next((r for r in requests
                     if r.binding_id == body.binding_id
                     and r.decision == "allow"
                     and r.status in ("approved", "auto_approved")), None)
    if not approved:
        raise HTTPException(403, "No approved access request found for this dataset")

    dataset = storage.get_dataset(db, body.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    policy = storage.get_policy(db, binding.policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")

    # Geo check
    if body.location and policy.geographic_restrictions:
        mode = policy.geographic_restrictions.get("mode", "global")
        blocked = policy.geographic_restrictions.get("blocked_regions", [])
        if body.location in blocked:
            raise HTTPException(403, f"Your location '{body.location}' is blocked by policy")

    export = run_export(
        dataset=dataset, policy=policy,
        consumer_id=current_user.id, binding_id=body.binding_id,
        request_id=approved.id, purpose=body.purpose, location=body.location
    )
    export = storage.create_export(db, export)
    storage.append_audit_log(db, "EXPORT_CREATED", current_user.id, export.id, "export",
                             {"dataset_id": dataset.id, "rows": export.row_count})
    return export_to_response(export)


@router.get("/v1/exports", response_model=List[ExportResponse])
def list_exports(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "consumer":
        exports = storage.get_exports_for_consumer(db, current_user.id)
    elif current_user.role == "data_holder":
        datasets = storage.get_datasets_for_owner(db, current_user.id)
        exports = storage.get_exports_for_datasets(db, [d.id for d in datasets])
    else:
        exports = storage.get_all_exports(db)
    return [export_to_response(e) for e in exports]


@router.get("/v1/exports/{export_id}/download")
def download_export(
    export_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    export = storage.get_export(db, export_id)
    if not export:
        raise HTTPException(404, "Export not found")

    if current_user.role == "consumer" and export.consumer_id != current_user.id:
        raise HTTPException(403, "Not your export")

    file_path = os.path.join(settings.upload_dir, export.filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Export file not found")

    storage.append_audit_log(db, "EXPORT_DOWNLOADED", current_user.id, export_id, "export")
    return FileResponse(file_path, media_type="text/csv",
                        filename=f"sovereignai_export_{export_id[:8]}.csv")
