import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import settings
from database import get_db, UserDB, PolicyDB
from models import (
    PolicyCreateRequest, PolicyResponse, PolicyGenerateRequest, PolicyGenerateResponse
)
from auth import get_current_user, require_roles
import storage
from services.ai_policy_service import generate_policy

router = APIRouter(prefix="/v1/policies", tags=["policies"])


def policy_to_response(p: PolicyDB) -> PolicyResponse:
    return PolicyResponse(
        id=p.id, owner_id=p.owner_id, name=p.name, description=p.description,
        source=p.source, compliance_frameworks=p.compliance_frameworks,
        legal_basis=p.legal_basis, allowed_purposes=p.allowed_purposes,
        allowed_roles=p.allowed_roles, data_subject_rights=p.data_subject_rights,
        retention_period_days=p.retention_period_days,
        geographic_restrictions=p.geographic_restrictions,
        requires_manual_approval=p.requires_manual_approval,
        max_exports_per_consumer=p.max_exports_per_consumer,
        row_limit=p.row_limit, fields_to_redact=p.fields_to_redact,
        frand_terms=p.frand_terms, b2b_sharing_obligations=p.b2b_sharing_obligations,
        switching_rights=p.switching_rights or False,
        requires_explicit_consent=p.requires_explicit_consent or False,
        dpia_required=p.dpia_required or False, risk_level=p.risk_level,
        ai_analysis=p.ai_analysis,
        created_at=p.created_at, updated_at=p.updated_at
    )


@router.post("/generate", response_model=PolicyGenerateResponse)
def generate_policy_endpoint(
    body: PolicyGenerateRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    dataset = storage.get_dataset(db, body.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if current_user.role == "data_holder" and dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")

    file_path = os.path.join(settings.upload_dir, dataset.filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Dataset file not found on disk")

    try:
        result = generate_policy(
            file_path=file_path,
            dataset_name=dataset.name,
            compliance_frameworks=body.compliance_frameworks,
            additional_context=body.additional_context
        )
    except Exception as e:
        raise HTTPException(502, f"AI policy generation failed: {str(e)}")

    storage.append_audit_log(
        db, "POLICY_AI_GENERATED", current_user.id, dataset.id, "dataset",
        {"frameworks": body.compliance_frameworks, "risk_level": result.analysis.risk_level}
    )
    return result


@router.post("", response_model=PolicyResponse, status_code=201)
def create_policy(
    body: PolicyCreateRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    policy = PolicyDB(
        owner_id=current_user.id,
        name=body.name,
        description=body.description,
        source=body.source,
        ai_prompt_used=body.ai_prompt_used,
        ai_analysis=body.ai_analysis,
        compliance_frameworks=body.compliance_frameworks,
        legal_basis=body.legal_basis,
        allowed_purposes=body.allowed_purposes,
        allowed_roles=body.allowed_roles,
        data_subject_rights=body.data_subject_rights,
        retention_period_days=body.retention_period_days,
        geographic_restrictions=body.geographic_restrictions,
        requires_manual_approval=body.requires_manual_approval,
        max_exports_per_consumer=body.max_exports_per_consumer,
        row_limit=body.row_limit,
        fields_to_redact=body.fields_to_redact,
        frand_terms=body.frand_terms,
        b2b_sharing_obligations=body.b2b_sharing_obligations,
        switching_rights=body.switching_rights,
        switching_conditions=body.switching_conditions,
        requires_explicit_consent=body.requires_explicit_consent,
        dpia_required=body.dpia_required,
        risk_level=body.risk_level,
    )
    policy = storage.create_policy(db, policy)
    storage.append_audit_log(db, "POLICY_CREATED", current_user.id, policy.id, "policy", {"source": body.source})
    return policy_to_response(policy)


@router.get("", response_model=List[PolicyResponse])
def list_policies(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in ("auditor", "admin"):
        return [policy_to_response(p) for p in storage.get_all_policies(db)]
    return [policy_to_response(p) for p in storage.get_policies_for_owner(db, current_user.id)]


@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(
    policy_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    p = storage.get_policy(db, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    if current_user.role == "data_holder" and p.owner_id != current_user.id:
        raise HTTPException(403, "Not your policy")
    return policy_to_response(p)


@router.patch("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: str,
    body: PolicyCreateRequest,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    p = storage.get_policy(db, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    if current_user.role == "data_holder" and p.owner_id != current_user.id:
        raise HTTPException(403, "Not your policy")

    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(p, field):
            setattr(p, field, value)

    storage.update_policy(db, p)
    storage.append_audit_log(db, "POLICY_UPDATED", current_user.id, p.id, "policy")
    return policy_to_response(p)


@router.delete("/{policy_id}", status_code=204)
def delete_policy(
    policy_id: str,
    current_user: UserDB = Depends(require_roles("data_holder", "admin")),
    db: Session = Depends(get_db)
):
    p = storage.get_policy(db, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    if current_user.role == "data_holder" and p.owner_id != current_user.id:
        raise HTTPException(403, "Not your policy")
    db.delete(p)
    db.commit()
    storage.append_audit_log(db, "POLICY_DELETED", current_user.id, policy_id, "policy")
