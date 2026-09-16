@echo off
cd /d "%~dp0"
echo Starting SovereignAI Backend...
python seed_admin.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
