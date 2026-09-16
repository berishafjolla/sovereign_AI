from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, UserDB, GDPRRequestDB
from models import GDPRRequestCreate, GDPRRequestResponse
from auth import get_current_user, require_roles
import storage
from services.gdpr_service import execute_erasure, execute_portability, execute_access

router = APIRouter(prefix="/v1/gdpr", tags=["gdpr"])


def gdpr_to_response(r: GDPRRequestDB) -> GDPRRequestResponse:
    return GDPRRequestResponse(
        id=r.id, subject_email=r.subject_email, request_type=r.request_type,
        dataset_id=r.dataset_id, status=r.status, notes=r.notes,
        completed_at=r.completed_at, created_at=r.created_at
    )


@router.post("/erasure", response_model=GDPRRequestResponse, status_code=201)
def request_erasure(
    body: GDPRRequestCreate,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    body.request_type = "erasure"
    req = GDPRRequestDB(
        requester_id=current_user.id, subject_email=body.subject_email,
        request_type="erasure", dataset_id=body.dataset_id, notes=body.notes
    )
    req = storage.create_gdpr_request(db, req)
    execute_erasure(req, db)
    storage.append_audit_log(db, "GDPR_ERASURE", current_user.id, req.id, "gdpr_request",
                             {"subject": body.subject_email})
    return gdpr_to_response(req)


@router.post("/access", response_model=GDPRRequestResponse, status_code=201)
def request_access(
    body: GDPRRequestCreate,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    req = GDPRRequestDB(
        requester_id=current_user.id, subject_email=body.subject_email,
        request_type="access", dataset_id=body.dataset_id, notes=body.notes
    )
    req = storage.create_gdpr_request(db, req)
    execute_access(req, db)
    storage.append_audit_log(db, "GDPR_ACCESS", current_user.id, req.id, "gdpr_request",
                             {"subject": body.subject_email})
    return gdpr_to_response(req)


@router.post("/portability", response_model=GDPRRequestResponse, status_code=201)
def request_portability(
    body: GDPRRequestCreate,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    req = GDPRRequestDB(
        requester_id=current_user.id, subject_email=body.subject_email,
        request_type="portability", dataset_id=body.dataset_id, notes=body.notes
    )
    req = storage.create_gdpr_request(db, req)
    execute_portability(req, db)
    storage.append_audit_log(db, "GDPR_PORTABILITY", current_user.id, req.id, "gdpr_request",
                             {"subject": body.subject_email})
    return gdpr_to_response(req)


@router.get("/requests", response_model=List[GDPRRequestResponse])
def list_gdpr_requests(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in ("auditor", "admin"):
        reqs = db.query(GDPRRequestDB).order_by(GDPRRequestDB.created_at.desc()).all()
    else:
        datasets = storage.get_datasets_for_owner(db, current_user.id)
        dataset_ids = [d.id for d in datasets]
        reqs = storage.get_gdpr_requests(db, dataset_ids)
    return [gdpr_to_response(r) for r in reqs]
