from database import PolicyDB, AccessRequestDB
from datetime import datetime


def evaluate_request(policy: PolicyDB, request: AccessRequestDB) -> tuple[str, str]:
    """
    Evaluate an access request against a policy.
    Returns (decision, reason): decision is 'allow'|'deny'|'pending_manual'
    """
    # Check allowed purposes
    if policy.allowed_purposes:
        if request.purpose and request.purpose not in policy.allowed_purposes:
            return "deny", f"Purpose '{request.purpose}' not in allowed purposes: {policy.allowed_purposes}"

    # Check allowed roles (by organization type mapping)
    if policy.allowed_roles and request.organization:
        org_lower = request.organization.lower()
        role_match = any(
            role in org_lower or org_lower in role
            for role in policy.allowed_roles
        )
        if not role_match:
            pass  # soft check — don't hard deny on org name alone

    # Check geographic restrictions
    if policy.geographic_restrictions and request.location:
        mode = policy.geographic_restrictions.get("mode", "global")
        blocked = policy.geographic_restrictions.get("blocked_regions", [])

        if request.location in blocked:
            return "deny", f"Location '{request.location}' is blocked by policy"

        if mode == "EU_only":
            EU_COUNTRIES = {
                "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
                "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
                "NL", "PL", "PT", "RO", "SE", "SI", "SK"
            }
            if request.location.upper() not in EU_COUNTRIES:
                return "deny", f"Policy restricts access to EU countries only. Location: {request.location}"

        elif mode == "EEA":
            EEA_COUNTRIES = {
                "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
                "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
                "NL", "PL", "PT", "RO", "SE", "SI", "SK", "IS", "LI", "NO"
            }
            if request.location.upper() not in EEA_COUNTRIES:
                return "deny", f"Policy restricts access to EEA countries only. Location: {request.location}"

    # Manual approval check
    if policy.requires_manual_approval:
        return "pending_manual", "Request requires manual approval by data holder"

    return "allow", "Request automatically approved by policy"
