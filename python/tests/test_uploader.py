from __future__ import annotations

import json
from urllib.error import HTTPError

from barjung_media import uploader


class Response:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def test_upload_can_retry_an_existing_storage_object(tmp_path, monkeypatch):
    uploaded: set[str] = set()

    def fake_urlopen(request, timeout):
        assert timeout == 60
        if request.full_url in uploaded and request.get_header("X-upsert") != "true":
            raise HTTPError(request.full_url, 409, "duplicate", {}, None)
        uploaded.add(request.full_url)
        return Response()

    monkeypatch.setattr(uploader, "urlopen", fake_urlopen)
    image = tmp_path / "01-room.jpg"
    image.write_bytes(b"jpeg")

    uploader.upload_file("https://project.supabase.co", "service-key", "property-media", "office/property/01-room.jpg", image)
    uploader.upload_file("https://project.supabase.co", "service-key", "property-media", "office/property/01-room.jpg", image)

    assert len(uploaded) == 1


def test_media_record_can_retry_after_a_previous_insert(monkeypatch):
    records: set[str] = set()

    def fake_urlopen(request, timeout):
        assert timeout == 30
        assert "on_conflict=storage_path" in request.full_url
        body = json.loads(request.data)
        storage_path = body["storage_path"]
        prefer = request.get_header("Prefer") or ""
        if storage_path in records and "resolution=merge-duplicates" not in prefer:
            raise HTTPError(request.full_url, 409, "duplicate", {}, None)
        records.add(storage_path)
        return Response()

    monkeypatch.setattr(uploader, "urlopen", fake_urlopen)
    item = {
        "original_size_bytes": 1000,
        "optimized_size_bytes": 500,
        "width": 640,
        "height": 480,
        "mime_type": "image/jpeg",
        "checksum_sha256": "a" * 64,
    }
    kwargs = {
        "office_id": "office",
        "property_id": "property",
        "storage_path": "office/property/01-room.jpg",
        "sort_order": 0,
        "manifest_item": item,
    }

    uploader.insert_media_record("https://project.supabase.co", "service-key", **kwargs)
    uploader.insert_media_record("https://project.supabase.co", "service-key", **kwargs)

    assert records == {"office/property/01-room.jpg"}
