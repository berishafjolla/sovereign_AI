import hashlib
import json
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from database import (
    UserDB, DatasetDB, PolicyDB, BindingDB,
    AccessRequestDB, ExportDB, AuditLogDB, GDPRRequestDB, NotificationDB
)


# ── Users ─────────────────────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> Optional[UserDB]:
    return db.query(UserDB).filter(UserDB.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[UserDB]:
    return db.query(UserDB).filter(UserDB.email == email).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[UserDB]:
    return db.query(UserDB).filter(UserDB.id == user_id).first()

def get_all_users(db: Session) -> List[UserDB]:
    return db.query(UserDB).all()

def create_user(db: Session, user: UserDB) -> UserDB:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Datasets ──────────────────────────────────────────────────────────────────

def create_dataset(db: Session, dataset: DatasetDB) -> DatasetDB:
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset

def get_dataset(db: Session, dataset_id: str) -> Optional[DatasetDB]:
    return db.query(DatasetDB).filter(DatasetDB.id == dataset_id, DatasetDB.deleted_at == None).first()

def get_datasets_for_owner(db: Session, owner_id: str) -> List[DatasetDB]:
    return db.query(DatasetDB).filter(DatasetDB.owner_id == owner_id, DatasetDB.deleted_at == None).all()

def get_published_datasets(db: Session) -> List[DatasetDB]:
    return db.query(DatasetDB).filter(DatasetDB.visibility == "published", DatasetDB.deleted_at == None).all()

def get_all_datasets(db: Session) -> List[DatasetDB]:
    return db.query(DatasetDB).filter(DatasetDB.deleted_at == None).all()

def soft_delete_dataset(db: Session, dataset_id: str):
    dataset = get_dataset(db, dataset_id)
    if dataset:
        dataset.deleted_at = datetime.utcnow()
        db.commit()


# ── Policies ──────────────────────────────────────────────────────────────────

def create_policy(db: Session, policy: PolicyDB) -> PolicyDB:
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy

def get_policy(db: Session, policy_id: str) -> Optional[PolicyDB]:
    return db.query(PolicyDB).filter(PolicyDB.id == policy_id).first()

def get_policies_for_owner(db: Session, owner_id: str) -> List[PolicyDB]:
    return db.query(PolicyDB).filter(PolicyDB.owner_id == owner_id).all()

def get_all_policies(db: Session) -> List[PolicyDB]:
    return db.query(PolicyDB).all()

def update_policy(db: Session, policy: PolicyDB) -> PolicyDB:
    policy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(policy)
    return policy


# ── Bindings ──────────────────────────────────────────────────────────────────

def create_binding(db: Session, binding: BindingDB) -> BindingDB:
    db.add(binding)
    db.commit()
    db.refresh(binding)
    return binding

def get_binding(db: Session, binding_id: str) -> Optional[BindingDB]:
    return db.query(BindingDB).filter(BindingDB.id == binding_id).first()

def get_binding_for_dataset(db: Session, dataset_id: str) -> Optional[BindingDB]:
    return db.query(BindingDB).filter(BindingDB.dataset_id == dataset_id, BindingDB.status == "active").first()

def get_bindings_for_owner_datasets(db: Session, owner_id: str) -> List[BindingDB]:
    datasets = get_datasets_for_owner(db, owner_id)
    dataset_ids = [d.id for d in datasets]
    return db.query(BindingDB).filter(BindingDB.dataset_id.in_(dataset_ids)).all()

def get_published_bindings(db: Session) -> List[BindingDB]:
    return db.query(BindingDB).filter(BindingDB.published == True, BindingDB.status == "active").all()


# ── Access Requests ───────────────────────────────────────────────────────────

def create_access_request(db: Session, req: AccessRequestDB) -> AccessRequestDB:
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def get_access_request(db: Session, request_id: str) -> Optional[AccessRequestDB]:
    return db.query(AccessRequestDB).filter(AccessRequestDB.id == request_id).first()

def get_requests_for_consumer(db: Session, consumer_id: str) -> List[AccessRequestDB]:
    return db.query(AccessRequestDB).filter(AccessRequestDB.consumer_id == consumer_id).all()

def get_requests_for_bindings(db: Session, binding_ids: List[str]) -> List[AccessRequestDB]:
    return db.query(AccessRequestDB).filter(AccessRequestDB.binding_id.in_(binding_ids)).all()

def get_pending_requests_for_bindings(db: Session, binding_ids: List[str]) -> List[AccessRequestDB]:
    return db.query(AccessRequestDB).filter(
        AccessRequestDB.binding_id.in_(binding_ids),
        AccessRequestDB.status == "pending"
    ).all()

def get_all_requests(db: Session) -> List[AccessRequestDB]:
    return db.query(AccessRequestDB).all()


# ── Exports ───────────────────────────────────────────────────────────────────

def create_export(db: Session, export: ExportDB) -> ExportDB:
    db.add(export)
    db.commit()
    db.refresh(export)
    return export

def get_export(db: Session, export_id: str) -> Optional[ExportDB]:
    return db.query(ExportDB).filter(ExportDB.id == export_id).first()

def get_exports_for_consumer(db: Session, consumer_id: str) -> List[ExportDB]:
    return db.query(ExportDB).filter(ExportDB.consumer_id == consumer_id).all()

def get_exports_for_datasets(db: Session, dataset_ids: List[str]) -> List[ExportDB]:
    return db.query(ExportDB).filter(ExportDB.dataset_id.in_(dataset_ids)).all()

def get_all_exports(db: Session) -> List[ExportDB]:
    return db.query(ExportDB).all()


# ── Audit Log ─────────────────────────────────────────────────────────────────

def append_audit_log(db: Session, event_type: str, actor_id: Optional[str],
                     target_id: Optional[str], target_type: Optional[str],
                     details: Optional[dict] = None):
    last = db.query(AuditLogDB).order_by(AuditLogDB.id.desc()).first()
    prev_hash = last.entry_hash if last else "0" * 64

    entry_data = json.dumps({
        "event_type": event_type,
        "actor_id": actor_id,
        "target_id": target_id,
        "details": details,
        "created_at": datetime.utcnow().isoformat(),
        "prev_hash": prev_hash
    }, sort_keys=True)
    entry_hash = hashlib.sha256(entry_data.encode()).hexdigest()

    log = AuditLogDB(
        event_type=event_type,
        actor_id=actor_id,
        target_id=target_id,
        target_type=target_type,
        details=details,
        prev_hash=prev_hash,
        entry_hash=entry_hash
    )
    db.add(log)
    db.commit()

def get_audit_logs(db: Session, actor_id: Optional[str] = None,
                   target_id: Optional[str] = None, limit: int = 200) -> List[AuditLogDB]:
    q = db.query(AuditLogDB)
    if actor_id:
        q = q.filter(AuditLogDB.actor_id == actor_id)
    if target_id:
        q = q.filter(AuditLogDB.target_id == target_id)
    return q.order_by(AuditLogDB.id.desc()).limit(limit).all()

def get_all_audit_logs(db: Session, limit: int = 500) -> List[AuditLogDB]:
    return db.query(AuditLogDB).order_by(AuditLogDB.id.desc()).limit(limit).all()


# ── GDPR ──────────────────────────────────────────────────────────────────────

def create_gdpr_request(db: Session, req: GDPRRequestDB) -> GDPRRequestDB:
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def get_gdpr_requests(db: Session, owner_dataset_ids: Optional[List[str]] = None) -> List[GDPRRequestDB]:
    q = db.query(GDPRRequestDB)
    if owner_dataset_ids:
        q = q.filter(GDPRRequestDB.dataset_id.in_(owner_dataset_ids))
    return q.order_by(GDPRRequestDB.created_at.desc()).all()


# ── Notifications ─────────────────────────────────────────────────────────────

def create_notification(db: Session, user_id: str, type: str, message: str, link_id: Optional[str] = None):
    n = NotificationDB(user_id=user_id, type=type, message=message, link_id=link_id)
    db.add(n)
    db.commit()

def get_notifications(db: Session, user_id: str) -> List[NotificationDB]:
    return db.query(NotificationDB).filter(NotificationDB.user_id == user_id, NotificationDB.read == False).all()
