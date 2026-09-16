# SovereignAI Backend

FastAPI backend for the SovereignAI Data Governance Platform.

## Quick Start

### 1. Install dependencies (once)
```
pip install fastapi uvicorn sqlalchemy python-jose passlib[bcrypt] anthropic pandas openpyxl xlrd pyarrow python-multipart pydantic-settings
```

### 2. Start the server
Double-click `start.bat`, or run manually:
```
python seed_admin.py   # creates admin user (safe to run multiple times)
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Admin account
Set `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run `python seed_admin.py`.

## Environment
Copy `.env.example` to `.env` and set the Claude API key, JWT secret, upload directory and admin account.

## Roles
| Role | Can do |
|------|--------|
| data_holder | Upload datasets, generate AI policies, manage access requests |
| consumer | Browse marketplace, request access, download exports |
| auditor | View all audit logs, verify chain integrity, monitor GDPR requests |
| admin | Manage users, view platform stats, full audit log |
