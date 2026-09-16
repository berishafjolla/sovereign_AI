from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Integer, Float, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from uuid import uuid4

from config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class OrganizationDB(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)  # url-safe name
    plan = Column(String, default="free")  # free|starter|business|enterprise
    max_datasets = Column(Integer, default=10)
    max_users = Column(Integer, default=5)
    max_exports_per_month = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # data_holder|consumer|auditor|admin
    organization = Column(String, nullable=True)           # display name (legacy)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DatasetDB(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=True)
    file_format = Column(String, nullable=True)  # csv|json|excel|tsv|parquet|xml
    file_size_bytes = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    column_names = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    visibility = Column(String, default="private")  # private|published
    confidentiality_level = Column(String, default="internal")
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class PolicyDB(Base):
    __tablename__ = "policies"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    source = Column(String, default="manual")  # manual|ai_generated
    ai_prompt_used = Column(Text, nullable=True)
    compliance_frameworks = Column(JSON, nullable=True)  # ["GDPR","EU_DATA_ACT"]

    # AI analysis results
    ai_analysis = Column(JSON, nullable=True)  # full analysis report from Claude

    # Core policy rules
    legal_basis = Column(String, nullable=True)
    allowed_purposes = Column(JSON, nullable=True)
    allowed_roles = Column(JSON, nullable=True)
    data_subject_rights = Column(JSON, nullable=True)
    retention_period_days = Column(Integer, nullable=True)
    geographic_restrictions = Column(JSON, nullable=True)
    requires_manual_approval = Column(Boolean, default=True)
    max_exports_per_consumer = Column(Integer, nullable=True)
    row_limit = Column(Integer, nullable=True)
    fields_to_redact = Column(JSON, nullable=True)

    # EU Data Act
    frand_terms = Column(Text, nullable=True)
    b2b_sharing_obligations = Column(JSON, nullable=True)
    switching_rights = Column(Boolean, default=False)
    switching_conditions = Column(Text, nullable=True)

    # GDPR extras
    requires_explicit_consent = Column(Boolean, default=False)
    dpia_required = Column(Boolean, default=False)
    risk_level = Column(String, nullable=True)  # low|medium|high|critical

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class BindingDB(Base):
    __tablename__ = "bindings"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id"), unique=True, nullable=False)
    policy_id = Column(String, ForeignKey("policies.id"), nullable=False)
    status = Column(String, default="active")  # active|revoked
    published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(Text, nullable=True)


class AccessRequestDB(Base):
    __tablename__ = "access_requests"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    consumer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    binding_id = Column(String, ForeignKey("bindings.id"), nullable=False)
    purpose = Column(String, nullable=False)
    organization = Column(String, nullable=True)
    intended_use = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending|approved|denied|auto_approved
    decision = Column(String, nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExportDB(Base):
    __tablename__ = "exports"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    consumer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    binding_id = Column(String, ForeignKey("bindings.id"), nullable=False)
    request_id = Column(String, ForeignKey("access_requests.id"), nullable=True)
    filename = Column(String, nullable=True)
    row_count = Column(Integer, nullable=True)
    fields_exported = Column(JSON, nullable=True)
    fields_redacted = Column(JSON, nullable=True)
    purpose = Column(String, nullable=True)
    watermark_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLogDB(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False, index=True)
    actor_id = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    target_type = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    prev_hash = Column(String, nullable=True)
    entry_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class GDPRRequestDB(Base):
    __tablename__ = "gdpr_requests"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    requester_id = Column(String, ForeignKey("users.id"), nullable=True)
    subject_email = Column(String, nullable=False, index=True)
    request_type = Column(String, nullable=False)  # erasure|access|portability|rectification
    dataset_id = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending|processing|completed|rejected
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationDB(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link_id = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
