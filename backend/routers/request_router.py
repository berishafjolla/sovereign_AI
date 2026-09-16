from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, UserDB, AccessRequestDB
from models import AccessRequestCreate, AccessRequestResponse, DenyRequest, BulkActionRequest
from auth import get_current_user, require_roles
import storage
from services.authorization_service import evaluate_request

router = APIRouter(tags=["requests"])


def req_to_response(r: AccessRequestDB) -> AccessRequestResponse:
    return AccessRequestResponse(
        id=r.id, consumer_id=r.consumer_id, binding_id=r.binding_id,
        purpose=r.purpose, organization=r.organization, intended_use=r.intended_use,
        location=r.location, status=r.status, decision=r.decision,
        decision_reason=r.decision_reason, decided_at=r.decided_at, created_at=r.created_at
    )


@router.post("/v1/requests", response_model=AccessRequestResponse, status_code=201)
def submit_request(
    body: AccessRequestCreate,
    current_user: UserDB = Depends(require_roles("consumer")),
    db: Session = Depends(get_db)
):
    binding = storage.get_binding(db, body.binding_id)
    if not binding or binding.status != "active":
        raise HTTPException(404, "Binding not found or inactive")
    if not binding.published:
        raise HTTPException(403, "This dataset is not published for access")

    policy = storage.get_policy(db, binding.policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")

    req = AccessRequestDB(
        consumer_id=current_user.id,
        binding_id=body.binding_id,
        purpose=body.purpose,
        organization=body.organization or current_user.organization,
        intended_use=body.intended_use,
        location=body.location,
    )

    decision, reason = evaluate_request(policy, req)

    if decision == "allow":
        req.status = "auto_approved"
        req.decision = "allow"
        req.decision_reason = reason
        req.decided_at = datetime.utcnow()
    elif decision == "deny":
        req.status = "denied"
        req.decision = "deny"
        req.decision_reason = reason
        req.decided_at = datetime.utcnow()
    else:
        req.status = "pending"

    req = storage.create_access_request(db, req)
    storage.append_audit_log(db, "ACCESS_REQUEST", current_user.id, req.id, "access_request",
                             {"binding_id": body.binding_id, "decision": req.decision})

    # Notify data holder if pending
    if req.status == "pending":
        dataset = storage.get_dataset(db, binding.dataset_id)
        if dataset:
            storage.create_notification(
                db, dataset.owner_id, "access_request",
                f"New access request for '{dataset.name}' from {current_user.username}",
                link_id=req.id
            )
    return req_to_response(req)


@router.get("/v1/requests", response_model=List[AccessRequestResponse])
def list_my_requests(
    current_user: UserDB = Depends(require_roles("consumer")),
    db: Session = Depends(get_db)
):
    return [req_to_response(r) for r in storage.get_requests_for_consumer(db, current_user.id)]


@router.get("/v1/data-holder/requests", response_model=List[AccessRequestResponse])
def list_incoming_requests(
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    bindings = storage.get_bindings_for_owner_datasets(db, current_user.id)
    binding_ids = [b.id for b in bindings]
    return [req_to_response(r) for r in storage.get_requests_for_bindings(db, binding_ids)]


@router.post("/v1/requests/{request_id}/approve", response_model=AccessRequestResponse)
def approve_request(
    request_id: str,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    req = storage.get_access_request(db, request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")

    binding = storage.get_binding(db, req.binding_id)
    dataset = storage.get_dataset(db, binding.dataset_id)
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    req.status = "approved"
    req.decision = "allow"
    req.decision_reason = "Approved by data holder"
    req.decided_at = datetime.utcnow()
    db.commit()

    storage.create_notification(db, req.consumer_id, "request_approved",
                                f"Your access request for '{dataset.name}' was approved", link_id=req.id)
    storage.append_audit_log(db, "ACCESS_APPROVED", current_user.id, req.id, "access_request")
    return req_to_response(req)


@router.post("/v1/requests/{request_id}/deny", response_model=AccessRequestResponse)
def deny_request(
    request_id: str,
    body: DenyRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    req = storage.get_access_request(db, request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")

    binding = storage.get_binding(db, req.binding_id)
    dataset = storage.get_dataset(db, binding.dataset_id)
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    req.status = "denied"
    req.decision = "deny"
    req.decision_reason = body.reason
    req.decided_at = datetime.utcnow()
    db.commit()

    storage.create_notification(db, req.consumer_id, "request_denied",
                                f"Your access request for '{dataset.name}' was denied", link_id=req.id)
    storage.append_audit_log(db, "ACCESS_DENIED", current_user.id, req.id, "access_request",
                             {"reason": body.reason})
    return req_to_response(req)


@router.post("/v1/requests/bulk-approve")
def bulk_approve(
    body: BulkActionRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    updated = 0
    for rid in body.request_ids:
        req = storage.get_access_request(db, rid)
        if req and req.status == "pending":
            req.status = "approved"
            req.decision = "allow"
            req.decision_reason = "Bulk approved by data holder"
            req.decided_at = datetime.utcnow()
            updated += 1
    db.commit()
    return {"updated": updated}


@router.post("/v1/requests/bulk-deny")
def bulk_deny(
    body: BulkActionRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    updated = 0
    for rid in body.request_ids:
        req = storage.get_access_request(db, rid)
        if req and req.status == "pending":
            req.status = "denied"
            req.decision = "deny"
            req.decision_reason = body.reason or "Bulk denied"
            req.decided_at = datetime.utcnow()
            updated += 1
    db.commit()
    return {"updated": updated}
