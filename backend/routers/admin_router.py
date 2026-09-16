from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, UserDB, GDPRRequestDB
from models import AdminStatsResponse, UserResponse
from auth import require_roles
import storage

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    users = storage.get_all_users(db)
    datasets = storage.get_all_datasets(db)
    policies = storage.get_all_policies(db)
    requests = storage.get_all_requests(db)
    exports = storage.get_all_exports(db)
    gdpr_reqs = db.query(GDPRRequestDB).all()

    return AdminStatsResponse(
        total_users=len(users),
        users_by_role={
            "data_holder": sum(1 for u in users if u.role == "data_holder"),
            "consumer": sum(1 for u in users if u.role == "consumer"),
            "auditor": sum(1 for u in users if u.role == "auditor"),
            "admin": sum(1 for u in users if u.role == "admin"),
        },
        total_datasets=len(datasets),
        published_datasets=sum(1 for d in datasets if d.visibility == "published"),
        total_policies=len(policies),
        ai_generated_policies=sum(1 for p in policies if p.source == "ai_generated"),
        total_access_requests=len(requests),
        pending_requests=sum(1 for r in requests if r.status == "pending"),
        total_exports=len(exports),
        total_gdpr_requests=len(gdpr_reqs),
    )


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    return [
        UserResponse(id=u.id, username=u.username, email=u.email, role=u.role,
                     organization=u.organization, is_active=u.is_active, created_at=u.created_at)
        for u in storage.get_all_users(db)
    ]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    is_active: bool = None,
    role: str = None,
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    user = storage.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if is_active is not None:
        user.is_active = is_active
    if role is not None:
        user.role = role
    db.commit()
    return UserResponse(id=user.id, username=user.username, email=user.email, role=user.role,
                        organization=user.organization, is_active=user.is_active, created_at=user.created_at)


@router.get("/notifications")
def get_notifications(
    current_user: UserDB = Depends(require_roles("admin", "data_holder", "consumer", "auditor")),
    db: Session = Depends(get_db)
):
    notifs = storage.get_notifications(db, current_user.id)
    return [{"id": n.id, "type": n.type, "message": n.message,
             "link_id": n.link_id, "read": n.read, "created_at": n.created_at} for n in notifs]
