"""
Run once to create an admin user:
  set ADMIN_PASSWORD in .env (or the environment), then: python seed_admin.py
"""
import sys
from database import SessionLocal, Base, engine, UserDB
from auth import hash_password
import os
import uuid

from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

USERNAME = os.getenv("ADMIN_USERNAME", "admin")
EMAIL    = os.getenv("ADMIN_EMAIL", "admin@sovereignai.local")
PASSWORD = os.getenv("ADMIN_PASSWORD")
if not PASSWORD:
    sys.exit("Set ADMIN_PASSWORD in .env before running seed_admin.py")

db = SessionLocal()
try:
    existing = db.query(UserDB).filter(UserDB.username == USERNAME).first()
    if existing:
        print(f"Admin user '{USERNAME}' already exists.")
        sys.exit(0)

    admin = UserDB(
        id=str(uuid.uuid4()),
        username=USERNAME,
        email=EMAIL,
        hashed_password=hash_password(PASSWORD),
        role="admin",
        organization="SovereignAI Platform",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print(f"Admin created — username: {USERNAME}")
finally:
    db.close()
