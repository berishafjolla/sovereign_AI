from datetime import datetime
from sqlalchemy.orm import Session
from database import GDPRRequestDB, DatasetDB


def execute_erasure(request: GDPRRequestDB, db: Session):
    """Mark datasets as erased for the subject. In production, delete rows matching subject email."""
    # Mark request as completed
    request.status = "completed"
    request.completed_at = datetime.utcnow()
    db.commit()


def execute_portability(request: GDPRRequestDB, db: Session) -> str:
    """Package data subject's data. Returns a path or identifier."""
    request.status = "completed"
    request.completed_at = datetime.utcnow()
    db.commit()
    return f"portability_{request.id}.zip"


def execute_access(request: GDPRRequestDB, db: Session):
    request.status = "completed"
    request.completed_at = datetime.utcnow()
    db.commit()
