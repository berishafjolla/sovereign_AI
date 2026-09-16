"""
Organization (tenant) management.
POST /v1/orgs          — create org (any authenticated user)
GET  /v1/orgs/mine     — get my org
GET  /v1/orgs          — list all orgs (admin only)
POST /v1/orgs/join     — join org via invite code (future)
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, OrganizationDB, UserDB
from auth import get_current_user, require_roles
import storage

router = APIRouter(prefix="/v1/orgs", tags=["organizations"])


class OrgCreateRequest(BaseModel):
    name: str
    plan: str = "free"


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    max_datasets: int
    max_users: int
    max_exports_per_month: int
    is_active: bool

    class Config:
        from_attributes = True


def make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug[:50]


PLAN_LIMITS = {
    "free":       {"max_datasets": 10,   "max_users": 5,   "max_exports_per_month": 100},
    "starter":    {"max_datasets": 50,   "max_users": 20,  "max_exports_per_month": 500},
    "business":   {"max_datasets": 200,  "max_users": 100, "max_exports_per_month": 2000},
    "enterprise": {"max_datasets": 9999, "max_users": 9999,"max_exports_per_month": 99999},
}


@router.post("", response_model=OrgResponse, status_code=201)
def create_org(
    body: OrgCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if current_user.org_id:
        raise HTTPException(400, "You already belong to an organization")

    plan = body.plan if body.plan in PLAN_LIMITS else "free"
    limits = PLAN_LIMITS[plan]
    slug = make_slug(body.name)

    # Ensure slug uniqueness
    base_slug = slug
    i = 1
    while db.query(OrganizationDB).filter(OrganizationDB.slug == slug).first():
        slug = f"{base_slug}-{i}"
        i += 1

    org = OrganizationDB(name=body.name, slug=slug, plan=plan, **limits)
    db.add(org)
    db.flush()

    # Assign user to org
    current_user.org_id = org.id
    db.commit()
    db.refresh(org)

    storage.append_audit_log(db, "ORG_CREATED", current_user.id, org.id, "organization",
                             {"name": org.name, "plan": plan})
    return org


@router.get("/mine", response_model=OrgResponse)
def get_my_org(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if not current_user.org_id:
        raise HTTPException(404, "You are not part of any organization")
    org = db.query(OrganizationDB).filter(OrganizationDB.id == current_user.org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@router.get("", response_model=list[OrgResponse])
def list_orgs(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin"))
):
    return db.query(OrganizationDB).all()


@router.patch("/{org_id}/plan")
def update_plan(
    org_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin"))
):
    org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    plan = body.get("plan", "free")
    if plan not in PLAN_LIMITS:
        raise HTTPException(400, f"Invalid plan. Choose: {list(PLAN_LIMITS.keys())}")
    limits = PLAN_LIMITS[plan]
    org.plan = plan
    org.max_datasets = limits["max_datasets"]
    org.max_users = limits["max_users"]
    org.max_exports_per_month = limits["max_exports_per_month"]
    db.commit()
    return {"status": "updated", "plan": plan}
