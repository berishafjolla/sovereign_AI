import hashlib
from sqlalchemy.orm import Session
from database import AuditLogDB
from models import ChainVerifyResponse


def verify_chain(db: Session) -> ChainVerifyResponse:
    logs = db.query(AuditLogDB).order_by(AuditLogDB.id.asc()).all()
    if not logs:
        return ChainVerifyResponse(valid=True, total_entries=0, broken_at_entry_id=None, message="No log entries.")

    import json
    from datetime import datetime

    prev_hash = "0" * 64
    for log in logs:
        entry_data = json.dumps({
            "event_type": log.event_type,
            "actor_id": log.actor_id,
            "target_id": log.target_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "prev_hash": prev_hash
        }, sort_keys=True)
        expected_hash = hashlib.sha256(entry_data.encode()).hexdigest()

        if log.entry_hash != expected_hash:
            return ChainVerifyResponse(
                valid=False,
                total_entries=len(logs),
                broken_at_entry_id=log.id,
                message=f"Chain broken at entry ID {log.id}"
            )
        prev_hash = log.entry_hash

    return ChainVerifyResponse(
        valid=True,
        total_entries=len(logs),
        broken_at_entry_id=None,
        message=f"Chain verified. All {len(logs)} entries intact."
    )
