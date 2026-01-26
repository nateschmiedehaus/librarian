import hashlib
from typing import Dict


def normalize_record(record: Dict[str, str]) -> Dict[str, str]:
    normalized = {}
    for key, value in record.items():
        normalized[key.strip().lower()] = value.strip()
    return normalized


def coerce_types(record: Dict[str, str]) -> Dict[str, object]:
    coerced: Dict[str, object] = {}
    for key, value in record.items():
        if value.isdigit():
            coerced[key] = int(value)
        elif value.replace(".", "", 1).isdigit():
            coerced[key] = float(value)
        else:
            coerced[key] = value
    return coerced


def compute_fingerprint(record: Dict[str, object], salt: str) -> str:
    payload = "|".join(f"{key}={record[key]}" for key in sorted(record.keys()))
    digest = hashlib.sha256(f"{salt}:{payload}".encode("utf-8")).hexdigest()
    return digest
