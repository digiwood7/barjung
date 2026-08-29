from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


def _validate(supabase_url: str, service_role_key: str, object_path: str) -> None:
    if not supabase_url.startswith("https://") or not service_role_key or ".." in object_path or object_path.startswith(("/", "\\")):
        raise ValueError("Supabase 업로드 설정이 올바르지 않습니다.")


def upload_file(supabase_url: str, service_role_key: str, bucket: str, object_path: str, file_path: Path) -> None:
    _validate(supabase_url, service_role_key, object_path)
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    endpoint = f"{supabase_url.rstrip('/')}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}"
    request = Request(endpoint, data=file_path.read_bytes(), method="POST", headers={
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
    })
    with urlopen(request, timeout=60) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"Storage 업로드 실패: HTTP {response.status}")


def insert_media_record(
    supabase_url: str,
    service_role_key: str,
    *,
    office_id: str,
    property_id: str,
    storage_path: str,
    sort_order: int,
    manifest_item: dict[str, object],
) -> None:
    _validate(supabase_url, service_role_key, storage_path)
    body = json.dumps({
        "office_id": office_id,
        "property_id": property_id,
        "storage_path": storage_path,
        "sort_order": sort_order,
        "original_size_bytes": manifest_item["original_size_bytes"],
        "optimized_size_bytes": manifest_item["optimized_size_bytes"],
        "width": manifest_item["width"],
        "height": manifest_item["height"],
        "mime_type": manifest_item["mime_type"],
        "checksum_sha256": manifest_item["checksum_sha256"],
    }).encode("utf-8")
    request = Request(f"{supabase_url.rstrip('/')}/rest/v1/property_media", data=body, method="POST", headers={
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })
    with urlopen(request, timeout=30) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"사진 메타데이터 저장 실패: HTTP {response.status}")
