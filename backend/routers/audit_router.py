from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, UserDB
from models import AuditLogResponse, ChainVerifyResponse
from auth import get_current_user, require_roles
import storage
from services.audit_service import verify_chain

router = APIRouter(prefix="/v1/audit", tags=["audit"])


def log_to_response(l) -> AuditLogResponse:
    return AuditLogResponse(
        id=l.id, event_type=l.event_type, actor_id=l.actor_id,
        target_id=l.target_id, target_type=l.target_type,
        details=l.details, entry_hash=l.entry_hash, created_at=l.created_at
    )


@router.get("/logs", response_model=List[AuditLogResponse])
def get_logs(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in ("auditor", "admin"):
        logs = storage.get_all_audit_logs(db, limit=500)
    else:
        logs = storage.get_audit_logs(db, actor_id=current_user.id, limit=200)
    return [log_to_response(l) for l in logs]


@router.get("/chain-verify", response_model=ChainVerifyResponse)
def chain_verify(
    current_user: UserDB = Depends(require_roles("auditor", "admin")),
    db: Session = Depends(get_db)
):
    return verify_chain(db)
