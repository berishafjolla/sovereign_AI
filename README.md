# SovereignAI

A data governance platform in which a large language model reads an uploaded dataset and drafts a data access policy for the data holder to review. Developed by Fjolla Berisha as a research prototype during doctoral research on data sovereignty and governed data sharing at Maynooth University.

## What it does

- **AI-assisted policy drafting.** The backend profiles a sample of an uploaded dataset (CSV, TSV, JSON, Excel, Parquet or XML): column types, completeness, distinct values and example values. It sends this profile to Claude through the Anthropic API, which returns a structured analysis and a draft policy:
  - personal data, GDPR Article 9 special categories and EU Data Act triggers found in the columns
  - a risk level, whether a DPIA is needed under GDPR Article 35, and the fields to redact
  - a draft access policy: legal basis under GDPR Article 6(1), permitted purposes and roles, retention, geographic scope and redactions, with a plain-English explanation
- **Guardrails on model output.** The response must follow a fixed JSON schema. It is extracted, repaired and validated against the allowed values, and a conservative default policy replaces any output that cannot be parsed. Every draft goes to the data holder for review.
- **Governed sharing.** Data holders upload datasets and manage access requests; consumers browse a marketplace, request access and download exports; auditors review audit logs, verify chain integrity and monitor GDPR requests; administrators manage users.

## Architecture

- `backend/`: FastAPI, SQLAlchemy (SQLite by default), Pydantic, pandas, Anthropic SDK
- `frontend/`: React 18 single-page application with separate views for data holders, consumers, auditors and administrators

## Running it locally

Backend:
```
cd backend
python -m venv .venv
.venv\Scripts\activate        (Windows)   or   source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        (then fill in the values)
python seed_admin.py
uvicorn main:app --reload --port 8000
```
API documentation: http://localhost:8000/docs

Frontend:
```
cd frontend
npm install
npm start
```
The frontend expects the API at http://localhost:8000.

## Security notes

- Never commit `.env`: it holds your Anthropic API key and JWT secret.
- Set a long random `JWT_SECRET` and a strong `ADMIN_PASSWORD` before running.
- Uploaded datasets and the SQLite database are created at runtime and are excluded from version control.
