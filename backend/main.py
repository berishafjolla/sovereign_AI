from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import auth_router, dataset_router, policy_router, binding_router
from routers import request_router, export_router, gdpr_router, audit_router, admin_router
from routers import health_router, org_router
from security import SecurityHeadersMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SovereignAI", version="1.0.0")

# Security headers + rate limiting (must be added before CORS)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(dataset_router.router)
app.include_router(policy_router.router)
app.include_router(binding_router.router)
app.include_router(request_router.router)
app.include_router(export_router.router)
app.include_router(gdpr_router.router)
app.include_router(audit_router.router)
app.include_router(admin_router.router)
app.include_router(health_router.router)
app.include_router(org_router.router)


@app.get("/")
def root():
    return {"status": "SovereignAI running", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
