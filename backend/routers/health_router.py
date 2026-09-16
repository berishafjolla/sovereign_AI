"""
Health check and monitoring endpoints.
GET /health       — liveness check (used by Docker, load balancers)
GET /health/ready — readiness check (DB connectivity)
GET /metrics      — platform statistics (admin only)
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, UserDB, DatasetDB, PolicyDB, BindingDB, AccessRequestDB, ExportDB, AuditLogDB
from auth import require_roles

router = APIRouter(tags=["health"])

START_TIME = datetime.utcnow()


@router.get("/health")
def health():
    """Liveness probe — always returns 200 if the process is running."""
    return {
        "status": "ok",
        "service": "SovereignAI",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)):
    """Readiness probe — checks DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    uptime_seconds = int((datetime.utcnow() - START_TIME).total_seconds())

    return {
        "status": "ready" if db_status == "ok" else "degraded",
        "database": db_status,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/metrics")
def metrics(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin"))
):
    """Detailed platform metrics — admin only."""
    users_total = db.query(UserDB).count()
    users_active = db.query(UserDB).filter(UserDB.is_active == True).count()
    datasets_total = db.query(DatasetDB).filter(DatasetDB.deleted_at == None).count()
    policies_total = db.query(PolicyDB).count()
    bindings_published = db.query(BindingDB).filter(BindingDB.published == True).count()
    requests_total = db.query(AccessRequestDB).count()
    requests_pending = db.query(AccessRequestDB).filter(AccessRequestDB.status == "pending").count()
    exports_total = db.query(ExportDB).count()
    audit_entries = db.query(AuditLogDB).count()
    uptime_seconds = int((datetime.utcnow() - START_TIME).total_seconds())

    return {
        "uptime_seconds": uptime_seconds,
        "users": {"total": users_total, "active": users_active},
        "datasets": {"total": datasets_total, "published": bindings_published},
        "policies": {"total": policies_total},
        "access_requests": {"total": requests_total, "pending": requests_pending},
        "exports": {"total": exports_total},
        "audit_log": {"total_entries": audit_entries},
        "timestamp": datetime.utcnow().isoformat()
    }
