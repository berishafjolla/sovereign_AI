import os
import uuid
from typing import Optional
import pandas as pd

from config import settings
from database import DatasetDB, PolicyDB, ExportDB
from services.ai_policy_service import load_dataset_sample, SUPPORTED_FORMATS


def run_export(
    dataset: DatasetDB,
    policy: PolicyDB,
    consumer_id: str,
    binding_id: str,
    request_id: Optional[str],
    purpose: Optional[str],
    location: Optional[str]
) -> ExportDB:
    # Load full dataset
    df, _ = load_dataset_sample(
        os.path.join(settings.upload_dir, dataset.filename),
        max_rows=policy.row_limit or 100_000
    )

    original_columns = list(df.columns)
    fields_to_redact = policy.fields_to_redact or []

    # Apply field redaction
    cols_to_drop = [c for c in fields_to_redact if c in df.columns]
    df = df.drop(columns=cols_to_drop)

    fields_exported = list(df.columns)
    fields_redacted = cols_to_drop

    # Apply row limit
    if policy.row_limit:
        df = df.head(policy.row_limit)

    # Add watermark column
    watermark = str(uuid.uuid4())[:8]
    df["__sovereignai_watermark__"] = watermark

    # Write to export file
    export_id = str(uuid.uuid4())
    export_filename = f"export_{export_id}.csv"
    export_path = os.path.join(settings.upload_dir, export_filename)
    df.to_csv(export_path, index=False)

    export = ExportDB(
        id=export_id,
        consumer_id=consumer_id,
        dataset_id=dataset.id,
        binding_id=binding_id,
        request_id=request_id,
        filename=export_filename,
        row_count=len(df),
        fields_exported=fields_exported,
        fields_redacted=fields_redacted,
        purpose=purpose,
        watermark_token=watermark
    )
    return export
