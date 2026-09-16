from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Literal["data_holder", "consumer", "auditor"]
    organization: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    organization: Optional[str]
    is_active: bool
    created_at: datetime

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    user_id: str
    role: str


# ── Datasets ─────────────────────────────────────────────────────────────────

class DatasetResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: Optional[str]
    file_format: Optional[str]
    file_size_bytes: Optional[int]
    row_count: Optional[int]
    column_names: Optional[List[str]]
    tags: Optional[List[str]]
    visibility: str
    confidentiality_level: str
    has_policy: bool = False
    created_at: datetime

class DatasetMetadataUpdate(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[Literal["private", "published"]] = None
    confidentiality_level: Optional[Literal["public", "internal", "confidential", "restricted"]] = None


# ── AI Policy ─────────────────────────────────────────────────────────────────

class PIIField(BaseModel):
    field: str
    type: str
    confidence: Literal["high", "medium", "low"]
    gdpr_relevant: bool = True

class SpecialCategory(BaseModel):
    field: str
    category: str
    gdpr_article: str
    description: str

class DataActTrigger(BaseModel):
    field: str
    trigger: str
    article: str
    obligation: str

class DataAnalysisReport(BaseModel):
    columns_analyzed: List[str] = []
    pii_detected: List[PIIField] = []
    special_categories_detected: List[SpecialCategory] = []
    data_act_triggers: List[DataActTrigger] = []
    risk_level: Literal["low", "medium", "high", "critical"] = "high"
    dpia_required: bool = True
    dpia_reason: str = "Manual review required — automated analysis incomplete."
    sensitive_fields: List[str] = []
    recommended_redactions: List[str] = []
    findings_summary: str = "Automated analysis incomplete. Please review all fields manually before publishing."

class PolicyDraft(BaseModel):
    name: str = "Untitled Policy"
    description: str = "Auto-generated policy — review before publishing."
    compliance_frameworks: List[str] = []
    legal_basis: str = "legitimate_interests"
    legal_basis_justification: str = "To be completed manually."
    allowed_purposes: List[str] = ["academic_research"]
    allowed_roles: List[str] = ["academic"]
    data_subject_rights: Dict[str, bool] = {"access": True, "erasure": True, "portability": True, "rectification": True, "restriction": True, "objection": True}
    retention_period_days: int = 365
    geographic_restrictions: Dict[str, Any] = {"mode": "EU_only", "blocked_regions": [], "justification": "Conservative default."}
    requires_manual_approval: bool = True
    max_exports_per_consumer: Optional[int] = None
    row_limit: Optional[int] = None
    fields_to_redact: List[str] = []
    requires_explicit_consent: bool = True
    frand_terms: Optional[str] = None
    b2b_sharing_obligations: List[str] = []
    switching_rights: bool = False
    switching_conditions: Optional[str] = None
    compliance_notes: List[str] = []
    ai_explanation: str = "Conservative default policy applied. Please review all fields carefully."

class PolicyGenerateRequest(BaseModel):
    dataset_id: str
    compliance_frameworks: List[Literal["GDPR", "EU_DATA_ACT"]] = Field(min_length=1)
    additional_context: Optional[str] = None

class PolicyGenerateResponse(BaseModel):
    analysis: DataAnalysisReport
    draft: PolicyDraft
    generation_time_ms: int

class PolicyCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    source: Literal["manual", "ai_generated"] = "manual"
    ai_prompt_used: Optional[str] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    compliance_frameworks: Optional[List[str]] = None
    legal_basis: Optional[str] = None
    allowed_purposes: Optional[List[str]] = None
    allowed_roles: Optional[List[str]] = None
    data_subject_rights: Optional[Dict[str, bool]] = None
    retention_period_days: Optional[int] = None
    geographic_restrictions: Optional[Dict[str, Any]] = None
    requires_manual_approval: bool = True
    max_exports_per_consumer: Optional[int] = None
    row_limit: Optional[int] = None
    fields_to_redact: Optional[List[str]] = None
    frand_terms: Optional[str] = None
    b2b_sharing_obligations: Optional[List[str]] = None
    switching_rights: bool = False
    switching_conditions: Optional[str] = None
    requires_explicit_consent: bool = False
    dpia_required: bool = False
    risk_level: Optional[str] = None

class PolicyResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: Optional[str]
    source: str
    compliance_frameworks: Optional[List[str]]
    legal_basis: Optional[str]
    allowed_purposes: Optional[List[str]]
    allowed_roles: Optional[List[str]]
    data_subject_rights: Optional[Dict[str, bool]]
    retention_period_days: Optional[int]
    geographic_restrictions: Optional[Dict[str, Any]]
    requires_manual_approval: bool
    max_exports_per_consumer: Optional[int]
    row_limit: Optional[int]
    fields_to_redact: Optional[List[str]]
    frand_terms: Optional[str]
    b2b_sharing_obligations: Optional[List[str]]
    switching_rights: bool
    requires_explicit_consent: bool
    dpia_required: bool
    risk_level: Optional[str]
    ai_analysis: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# ── Bindings ──────────────────────────────────────────────────────────────────

class BindingCreate(BaseModel):
    dataset_id: str
    policy_id: str

class BindingResponse(BaseModel):
    id: str
    dataset_id: str
    policy_id: str
    status: str
    published: bool
    created_at: datetime
    revoked_at: Optional[datetime]
    revoke_reason: Optional[str]

class RevokeBindingRequest(BaseModel):
    reason: str


# ── Access Requests ───────────────────────────────────────────────────────────

class AccessRequestCreate(BaseModel):
    binding_id: str
    purpose: str
    organization: Optional[str] = None
    intended_use: Optional[str] = None
    location: Optional[str] = None

class AccessRequestResponse(BaseModel):
    id: str
    consumer_id: str
    binding_id: str
    purpose: str
    organization: Optional[str]
    intended_use: Optional[str]
    location: Optional[str]
    status: str
    decision: Optional[str]
    decision_reason: Optional[str]
    decided_at: Optional[datetime]
    created_at: datetime

class DenyRequest(BaseModel):
    reason: str = "Access denied by data holder"

class BulkActionRequest(BaseModel):
    request_ids: List[str]
    reason: Optional[str] = None


# ── Export ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    dataset_id: str
    binding_id: str
    purpose: Optional[str] = None
    location: Optional[str] = None

class ExportResponse(BaseModel):
    id: str
    consumer_id: str
    dataset_id: str
    binding_id: str
    row_count: int
    fields_exported: List[str]
    fields_redacted: List[str]
    created_at: datetime
    download_url: str


# ── GDPR ──────────────────────────────────────────────────────────────────────

class GDPRRequestCreate(BaseModel):
    subject_email: EmailStr
    request_type: Literal["erasure", "access", "portability", "rectification"]
    dataset_id: Optional[str] = None
    notes: Optional[str] = None

class GDPRRequestResponse(BaseModel):
    id: str
    subject_email: str
    request_type: str
    dataset_id: Optional[str]
    status: str
    notes: Optional[str]
    completed_at: Optional[datetime]
    created_at: datetime


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    event_type: str
    actor_id: Optional[str]
    target_id: Optional[str]
    target_type: Optional[str]
    details: Optional[Dict[str, Any]]
    entry_hash: Optional[str]
    created_at: datetime

class ChainVerifyResponse(BaseModel):
    valid: bool
    total_entries: int
    broken_at_entry_id: Optional[int]
    message: str


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    type: str
    message: str
    link_id: Optional[str]
    read: bool
    created_at: datetime


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminStatsResponse(BaseModel):
    total_users: int
    users_by_role: Dict[str, int]
    total_datasets: int
    published_datasets: int
    total_policies: int
    ai_generated_policies: int
    total_access_requests: int
    pending_requests: int
    total_exports: int
    total_gdpr_requests: int
