from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, UserDB, BindingDB
from models import BindingCreate, BindingResponse, RevokeBindingRequest
from auth import get_current_user, require_roles
import storage

router = APIRouter(prefix="/v1/bindings", tags=["bindings"])


def binding_to_response(b: BindingDB) -> BindingResponse:
    return BindingResponse(
        id=b.id, dataset_id=b.dataset_id, policy_id=b.policy_id,
        status=b.status, published=b.published, created_at=b.created_at,
        revoked_at=b.revoked_at, revoke_reason=b.revoke_reason
    )


@router.post("", response_model=BindingResponse, status_code=201)
def create_binding(
    body: BindingCreate,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    dataset = storage.get_dataset(db, body.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    policy = storage.get_policy(db, body.policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")

    existing = storage.get_binding_for_dataset(db, body.dataset_id)
    if existing:
        raise HTTPException(400, "Dataset already has an active binding. Revoke it first.")

    binding = BindingDB(dataset_id=body.dataset_id, policy_id=body.policy_id)
    binding = storage.create_binding(db, binding)
    storage.append_audit_log(db, "BINDING_CREATED", current_user.id, binding.id, "binding",
                             {"dataset_id": body.dataset_id, "policy_id": body.policy_id})
    return binding_to_response(binding)


@router.get("", response_model=List[BindingResponse])
def list_bindings(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in ("auditor", "admin"):
        bindings = db.query(BindingDB).all()
    elif current_user.role == "consumer":
        # Consumers need published bindings so they can submit access requests
        bindings = storage.get_published_bindings(db)
    else:
        bindings = storage.get_bindings_for_owner_datasets(db, current_user.id)
    return [binding_to_response(b) for b in bindings]


@router.get("/{binding_id}", response_model=BindingResponse)
def get_binding(
    binding_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    b = storage.get_binding(db, binding_id)
    if not b:
        raise HTTPException(404, "Binding not found")
    return binding_to_response(b)


@router.patch("/{binding_id}/publish", response_model=BindingResponse)
def toggle_publish(
    binding_id: str,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    b = storage.get_binding(db, binding_id)
    if not b:
        raise HTTPException(404, "Binding not found")

    dataset = storage.get_dataset(db, b.dataset_id)
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your binding")

    b.published = not b.published
    if b.published:
        dataset.visibility = "published"
    db.commit()

    storage.append_audit_log(db, "BINDING_PUBLISH_TOGGLED", current_user.id, binding_id, "binding",
                             {"published": b.published})
    return binding_to_response(b)


@router.post("/{binding_id}/revoke", response_model=BindingResponse)
def revoke_binding(
    binding_id: str,
    body: RevokeBindingRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    b = storage.get_binding(db, binding_id)
    if not b:
        raise HTTPException(404, "Binding not found")

    dataset = storage.get_dataset(db, b.dataset_id)
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your binding")

    b.status = "revoked"
    b.revoked_at = datetime.utcnow()
    b.revoke_reason = body.reason
    b.published = False
    db.commit()

    storage.append_audit_log(db, "BINDING_REVOKED", current_user.id, binding_id, "binding",
                             {"reason": body.reason})
    return binding_to_response(b)
