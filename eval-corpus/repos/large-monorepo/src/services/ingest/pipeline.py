from typing import List, Dict

from config import BATCH_SIZE, MAX_ROWS, REQUIRED_FIELDS


def split_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return [row for row in rows if row]


def validate_rows(rows: List[Dict[str, str]]) -> None:
    if len(rows) > MAX_ROWS:
        raise ValueError("too many rows")
    for row in rows:
        for field in REQUIRED_FIELDS:
            if field not in row:
                raise ValueError(f"missing {field}")


def build_batches(rows: List[Dict[str, str]]) -> List[List[Dict[str, str]]]:
    batches: List[List[Dict[str, str]]] = []
    for i in range(0, len(rows), BATCH_SIZE):
        batches.append(rows[i : i + BATCH_SIZE])
    return batches
