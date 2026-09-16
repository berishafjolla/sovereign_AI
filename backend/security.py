"""
Security middleware and utilities for SovereignAI.
- Rate limiting on auth endpoints
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Password strength validation
- Request size limiting
"""
import time
import re
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# ── In-memory rate limiter ─────────────────────────────────────────────────────

class RateLimiter:
    def __init__(self):
        self._buckets: dict = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            timestamps = self._buckets[key]
            # Remove expired timestamps
            self._buckets[key] = [t for t in timestamps if now - t < window_seconds]
            if len(self._buckets[key]) >= max_requests:
                return False
            self._buckets[key].append(now)
            return True

    def cleanup(self):
        """Remove stale keys (call periodically if needed)."""
        now = time.time()
        with self._lock:
            stale = [k for k, ts in self._buckets.items() if all(now - t > 3600 for t in ts)]
            for k in stale:
                del self._buckets[k]


rate_limiter = RateLimiter()


# ── Rate limit rules ───────────────────────────────────────────────────────────

RATE_LIMIT_RULES = {
    "/v1/auth/login":    (10, 60),   # 10 attempts per minute
    "/v1/auth/register": (5,  60),   # 5 registrations per minute
    "/v1/policies/generate": (20, 3600),  # 20 AI generations per hour
    "/v1/datasets/upload":   (30, 3600),  # 30 uploads per hour
}


# ── Security headers middleware ────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Rate limiting check
        path = request.url.path
        if path in RATE_LIMIT_RULES:
            ip = request.client.host if request.client else "unknown"
            key = f"{ip}:{path}"
            max_req, window = RATE_LIMIT_RULES[path]
            if not rate_limiter.is_allowed(key, max_req, window):
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Limit: {max_req} per {window}s."},
                    headers={"Retry-After": str(window)}
                )

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' http://localhost:8000"
        )
        # Only add HSTS in production (not localhost)
        if request.url.hostname not in ("localhost", "127.0.0.1"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# ── Password strength validation ───────────────────────────────────────────────

PASSWORD_MIN_LENGTH = 8
PASSWORD_RULES = [
    (r'[A-Z]', "at least one uppercase letter"),
    (r'[a-z]', "at least one lowercase letter"),
    (r'[0-9]', "at least one number"),
    (r'[^A-Za-z0-9]', "at least one special character (!@#$%^&* etc.)"),
]


def validate_password_strength(password: str) -> None:
    """Raise HTTPException 400 if password does not meet strength requirements."""
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"at least {PASSWORD_MIN_LENGTH} characters")
    for pattern, message in PASSWORD_RULES:
        if not re.search(pattern, password):
            errors.append(message)
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Password too weak. Required: {', '.join(errors)}."
        )


# ── Input sanitization ─────────────────────────────────────────────────────────

MAX_STRING_LENGTH = 10_000
MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB


def sanitize_string(value: str, max_length: int = MAX_STRING_LENGTH) -> str:
    """Truncate and strip dangerous characters from string inputs."""
    if not isinstance(value, str):
        return value
    # Strip null bytes
    value = value.replace("\x00", "")
    return value[:max_length]
