import json
import re
import time
import os
from typing import List, Optional

import anthropic
import pandas as pd

from config import settings
from models import DataAnalysisReport, PolicyDraft, PolicyGenerateResponse

SUPPORTED_FORMATS = {
    ".csv": "csv",
    ".tsv": "tsv",
    ".json": "json",
    ".xlsx": "excel",
    ".xls": "excel",
    ".parquet": "parquet",
    ".xml": "xml",
    ".txt": "csv",
}

SYSTEM_PROMPT = """You are a world-class data governance and privacy law expert specializing in:
- GDPR (General Data Protection Regulation) — EU Regulation 2016/679
- EU Data Act — Regulation (EU) 2023/2854
- Data minimization and privacy by design principles

Your task is to ANALYZE actual dataset contents (column names and sample data rows) and generate legally-compliant data access policies.

You do NOT rely on descriptions alone. You read the actual data, detect sensitive fields, identify applicable regulations, and generate evidence-based policies.

DETECTION RULES:
- PII: names, emails, phone numbers, addresses, national IDs, passport numbers, IP addresses, usernames, dates of birth, account numbers
- GDPR Article 9 Special Categories: health/medical data, genetic data, biometric data, racial/ethnic origin, political opinions, religious/philosophical beliefs, trade union membership, sexual orientation/life
- EU Data Act triggers: IoT device data, machine-generated data, sensor readings, device identifiers, usage logs from connected products, industrial data
- Financial sensitive: credit card numbers, bank accounts, transaction amounts, credit scores
- Location sensitive: GPS coordinates, precise location, travel history

CRITICAL OUTPUT REQUIREMENTS:
1. Return ONLY valid JSON — no markdown, no code fences, no explanation before or after
2. Start your response with { and end with }
3. Every field is required — use null for optional fields that don't apply
4. Use empty arrays [] never null for list fields
5. Be conservative: when in doubt, choose stricter privacy protections
6. Cite specific legal articles in your justifications"""


def load_dataset_sample(file_path: str, max_rows: int = 50) -> tuple[pd.DataFrame, str]:
    """Load any supported data format and return a sample DataFrame + format name."""
    _, ext = os.path.splitext(file_path.lower())
    fmt = SUPPORTED_FORMATS.get(ext, "csv")

    try:
        if fmt == "csv":
            df = pd.read_csv(file_path, nrows=max_rows, encoding="utf-8", on_bad_lines="skip")
        elif fmt == "tsv":
            df = pd.read_csv(file_path, sep="\t", nrows=max_rows, on_bad_lines="skip")
        elif fmt == "json":
            df = pd.read_json(file_path)
            df = df.head(max_rows)
        elif fmt == "excel":
            df = pd.read_excel(file_path, nrows=max_rows)
        elif fmt == "parquet":
            df = pd.read_parquet(file_path)
            df = df.head(max_rows)
        elif fmt == "xml":
            df = pd.read_xml(file_path)
            df = df.head(max_rows)
        else:
            df = pd.read_csv(file_path, nrows=max_rows, on_bad_lines="skip")
    except Exception:
        df = pd.read_csv(file_path, nrows=max_rows, encoding="latin-1", on_bad_lines="skip")

    return df, fmt


def build_dataset_profile(df: pd.DataFrame) -> str:
    """Build a detailed text profile of the dataset for Claude to analyze."""
    lines = []
    lines.append(f"COLUMNS ({len(df.columns)} total): {', '.join(str(c) for c in df.columns)}")
    lines.append(f"ROW COUNT IN SAMPLE: {len(df)}")
    lines.append("")
    lines.append("COLUMN DETAILS:")

    for col in df.columns:
        dtype = str(df[col].dtype)
        non_null = df[col].notna().sum()
        unique_count = df[col].nunique()
        sample_vals = df[col].dropna().head(5).tolist()
        sample_str = ", ".join(str(v)[:50] for v in sample_vals)
        lines.append(f"  - {col} | type={dtype} | non_null={non_null} | unique={unique_count} | samples=[{sample_str}]")

    lines.append("")
    lines.append("FIRST 10 ROWS (CSV):")
    lines.append(df.head(10).to_csv(index=False))

    return "\n".join(lines)


def build_user_prompt(
    dataset_profile: str,
    compliance_frameworks: List[str],
    dataset_name: str,
    additional_context: Optional[str]
) -> str:
    frameworks_text = " AND ".join(compliance_frameworks)
    context_section = f"\nADDITIONAL CONTEXT FROM DATA HOLDER:\n{additional_context}\n" if additional_context else ""

    return f"""Analyze this dataset and generate a {frameworks_text} compliant data access policy.

DATASET NAME: {dataset_name}
{context_section}
COMPLIANCE FRAMEWORKS REQUESTED: {', '.join(compliance_frameworks)}

=== DATASET PROFILE ===
{dataset_profile}
=== END DATASET PROFILE ===

Generate a JSON object with this EXACT structure:

{{
  "analysis": {{
    "columns_analyzed": ["list of all column names you analyzed"],
    "pii_detected": [
      {{
        "field": "exact_column_name",
        "type": "one of: email_address, full_name, phone_number, postal_address, national_id, passport, ip_address, date_of_birth, account_number, other_pii",
        "confidence": "one of: high, medium, low",
        "gdpr_relevant": true
      }}
    ],
    "special_categories_detected": [
      {{
        "field": "exact_column_name",
        "category": "one of: health_data, genetic_data, biometric_data, racial_ethnic_origin, political_opinions, religious_beliefs, trade_union, sexual_orientation",
        "gdpr_article": "Article 9(1)",
        "description": "why this field is a special category"
      }}
    ],
    "data_act_triggers": [
      {{
        "field": "exact_column_name",
        "trigger": "one of: iot_device_data, machine_generated, sensor_data, usage_logs, industrial_data, connected_product",
        "article": "EU Data Act Article 4",
        "obligation": "description of the EU Data Act obligation"
      }}
    ],
    "risk_level": "one of: low, medium, high, critical",
    "dpia_required": true,
    "dpia_reason": "explanation of why DPIA is or is not required under GDPR Article 35",
    "sensitive_fields": ["list of all fields considered sensitive"],
    "recommended_redactions": ["list of fields that MUST be redacted or anonymized before sharing"],
    "findings_summary": "2-3 sentence plain-English summary of what was found and the key privacy risks"
  }},
  "policy": {{
    "name": "descriptive policy name based on the data",
    "description": "2-3 sentence policy description",
    "compliance_frameworks": {json.dumps(compliance_frameworks)},
    "legal_basis": "one of: consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests",
    "legal_basis_justification": "cite specific GDPR Article 6(1) sub-clause and explain why it applies to this data",
    "allowed_purposes": ["academic_research", "commercial_analytics", "public_health", "product_development", "regulatory_compliance", "internal_operations"],
    "allowed_roles": ["academic", "corporate", "government", "ngo", "healthcare", "financial", "legal"],
    "data_subject_rights": {{
      "access": true,
      "erasure": true,
      "portability": true,
      "rectification": true,
      "restriction": true,
      "objection": true
    }},
    "retention_period_days": 365,
    "geographic_restrictions": {{
      "mode": "one of: EU_only, EEA, global",
      "blocked_regions": [],
      "justification": "explain geographic scope decision"
    }},
    "requires_manual_approval": true,
    "max_exports_per_consumer": null,
    "row_limit": null,
    "fields_to_redact": ["list of fields to redact — must match recommended_redactions above"],
    "requires_explicit_consent": false,
    "frand_terms": {"\"Fair, Reasonable and Non-Discriminatory access terms\"" if "EU_DATA_ACT" in compliance_frameworks else "null"},
    "b2b_sharing_obligations": {"[\"list EU Data Act B2B obligations\"]" if "EU_DATA_ACT" in compliance_frameworks else "[]"},
    "switching_rights": {"true" if "EU_DATA_ACT" in compliance_frameworks else "false"},
    "switching_conditions": {"\"conditions for switching data providers under EU Data Act Article 23\"" if "EU_DATA_ACT" in compliance_frameworks else "null"},
    "compliance_notes": [
      "specific GDPR article citations relevant to this data",
      "EU Data Act provisions if applicable",
      "any special warnings or recommendations"
    ],
    "ai_explanation": "3-5 sentence plain-English explanation of the key policy decisions and why they were made"
  }}
}}

IMPORTANT: Return ONLY the JSON. No markdown. No code blocks. Start with {{ end with }}."""


VALID_PII_TYPES = {"email_address", "full_name", "phone_number", "postal_address", "national_id", "passport", "ip_address", "date_of_birth", "account_number", "other_pii"}
VALID_SPECIAL_CATEGORIES = {"health_data", "genetic_data", "biometric_data", "racial_ethnic_origin", "political_opinions", "religious_beliefs", "trade_union", "sexual_orientation"}
VALID_DATA_ACT_TRIGGERS = {"iot_device_data", "machine_generated", "sensor_data", "usage_logs", "industrial_data", "connected_product"}


def sanitize_result(data: dict) -> dict:
    """Fix edge cases in Claude output."""
    CONFIDENCE_VALUES = {"high", "medium", "low"}
    RISK_VALUES = {"low", "medium", "high", "critical"}
    LEGAL_BASIS_VALUES = {"consent", "contract", "legal_obligation", "vital_interests", "public_task", "legitimate_interests"}
    GEO_MODES = {"EU_only", "EEA", "global"}

    analysis = data.get("analysis", {})
    policy = data.get("policy", {})

    for pii in analysis.get("pii_detected", []):
        if pii.get("confidence") not in CONFIDENCE_VALUES:
            pii["confidence"] = "high"
        if pii.get("type") not in VALID_PII_TYPES:
            pii["type"] = "other_pii"

    for sc in analysis.get("special_categories_detected", []):
        if sc.get("category") not in VALID_SPECIAL_CATEGORIES:
            sc["category"] = "health_data"

    for trigger in analysis.get("data_act_triggers", []):
        if trigger.get("trigger") not in VALID_DATA_ACT_TRIGGERS:
            trigger["trigger"] = "machine_generated"

    if analysis.get("risk_level") not in RISK_VALUES:
        analysis["risk_level"] = "high"

    if policy.get("legal_basis") not in LEGAL_BASIS_VALUES:
        policy["legal_basis"] = "legitimate_interests"

    geo = policy.get("geographic_restrictions", {})
    if isinstance(geo, dict) and geo.get("mode") not in GEO_MODES:
        geo["mode"] = "EU_only"

    if not isinstance(analysis.get("dpia_required"), bool):
        analysis["dpia_required"] = True

    return data


def extract_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        lines = text.split("\n")
        start_line = next((i + 1 for i, l in enumerate(lines) if l.strip().startswith("```")), 0)
        end_line = next((i for i in range(len(lines) - 1, start_line, -1) if lines[i].strip() == "```"), len(lines))
        text = "\n".join(lines[start_line:end_line])

    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1:
        raise ValueError("No JSON found in response")

    candidate = text[start:end] if end > start else text[start:]

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Fix trailing commas
    fixed = re.sub(r',\s*([}\]])', r'\1', candidate)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError as e:
        raise ValueError(f"Could not parse Claude JSON output: {e}")


def _default_result(dataset_name: str, compliance_frameworks: list) -> dict:
    """Safe fallback when Claude output cannot be parsed."""
    return {
        "analysis": {
            "columns_analyzed": [],
            "pii_detected": [],
            "special_categories_detected": [],
            "data_act_triggers": [],
            "risk_level": "high",
            "dpia_required": True,
            "dpia_reason": "Unable to complete automated analysis. Manual DPIA required under GDPR Article 35.",
            "sensitive_fields": [],
            "recommended_redactions": [],
            "findings_summary": "Automated AI analysis could not complete. A conservative high-risk policy has been applied. Please review and update all fields manually before publishing."
        },
        "policy": {
            "name": f"{dataset_name} Access Policy",
            "description": "Auto-generated conservative policy. Please review all fields before publishing.",
            "compliance_frameworks": compliance_frameworks,
            "legal_basis": "legitimate_interests",
            "legal_basis_justification": "To be completed manually.",
            "allowed_purposes": ["academic_research"],
            "allowed_roles": ["academic"],
            "data_subject_rights": {"access": True, "erasure": True, "portability": True, "rectification": True, "restriction": True, "objection": True},
            "retention_period_days": 365,
            "geographic_restrictions": {"mode": "EU_only", "blocked_regions": [], "justification": "Conservative EU-only restriction pending manual review."},
            "requires_manual_approval": True,
            "max_exports_per_consumer": 1,
            "row_limit": 1000,
            "fields_to_redact": [],
            "requires_explicit_consent": True,
            "frand_terms": None,
            "b2b_sharing_obligations": [],
            "switching_rights": False,
            "switching_conditions": None,
            "compliance_notes": ["Manual review required — AI analysis did not complete successfully."],
            "ai_explanation": "Fallback policy applied. Please review every field carefully before publishing."
        }
    }


def generate_policy(
    file_path: str,
    dataset_name: str,
    compliance_frameworks: List[str],
    additional_context: Optional[str] = None
) -> PolicyGenerateResponse:
    t_start = time.time()

    if not settings.claude_api_key:
        raise RuntimeError("Claude API key not configured. Set CLAUDE_API_KEY in .env")

    client = anthropic.Anthropic(api_key=settings.claude_api_key)

    df, _ = load_dataset_sample(file_path, max_rows=50)
    profile = build_dataset_profile(df)
    user_prompt = build_user_prompt(profile, compliance_frameworks, dataset_name, additional_context)

    try:
        with client.messages.stream(
            model="claude-opus-4-5",
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            raw_text = stream.get_final_message().content[0].text
    except Exception as e:
        raise RuntimeError(f"Claude API error: {e}")

    try:
        result = sanitize_result(extract_json(raw_text))
    except Exception:
        result = _default_result(dataset_name, compliance_frameworks)

    elapsed_ms = int((time.time() - t_start) * 1000)

    analysis = DataAnalysisReport(**(result.get("analysis") or {}))
    draft = PolicyDraft(**(result.get("policy") or {}))

    return PolicyGenerateResponse(
        analysis=analysis,
        draft=draft,
        generation_time_ms=elapsed_ms
    )
