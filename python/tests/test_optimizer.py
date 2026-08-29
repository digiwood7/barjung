from pathlib import Path

import pytest
from PIL import Image

from barjung_media.optimizer import OptimizationOptions, optimize_batch, optimize_image
from barjung_media.uploader import upload_file


def make_image(path: Path) -> None:
    image = Image.new("RGB", (2400, 1200), (42, 96, 132))
    exif = Image.Exif()
    exif[274] = 1
    exif[270] = "private location note"
    image.save(path, "JPEG", quality=96, exif=exif)


def test_optimize_image_is_non_destructive_and_strips_metadata(tmp_path: Path) -> None:
    source = tmp_path / "source.jpg"
    output = tmp_path / "out" / "source.jpg"
    make_image(source)
    source_bytes = source.read_bytes()

    result = optimize_image(source, output, OptimizationOptions(max_edge=1000, quality=82, target_kb=200))

    assert source.read_bytes() == source_bytes
    assert output.exists()
    with Image.open(output) as optimized:
        assert max(optimized.size) == 1000
        assert len(optimized.getexif()) == 0
    assert result.optimized_size_bytes == output.stat().st_size
    assert len(result.checksum_sha256) == 64
    assert result.mime_type == "image/jpeg"


def test_optimize_batch_reports_invalid_files_without_stopping(tmp_path: Path) -> None:
    valid = tmp_path / "valid.jpg"
    invalid = tmp_path / "broken.jpg"
    make_image(valid)
    invalid.write_text("not an image", encoding="utf-8")

    manifest = optimize_batch([valid, invalid], tmp_path / "optimized", OptimizationOptions())

    assert manifest[0]["status"] == "succeeded"
    assert manifest[1] == {"source": "broken.jpg", "status": "failed", "error": "지원하거나 읽을 수 있는 이미지가 아닙니다."}


def test_upload_rejects_unsafe_storage_paths(tmp_path: Path) -> None:
    image = tmp_path / "safe.jpg"
    image.write_bytes(b"jpeg")
    with pytest.raises(ValueError, match="설정"):
        upload_file("https://example.supabase.co", "service-role", "property-media", "../outside.jpg", image)
