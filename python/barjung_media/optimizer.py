from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import os

from PIL import Image, ImageOps, UnidentifiedImageError


@dataclass(frozen=True)
class OptimizationOptions:
    max_edge: int = 1920
    quality: int = 82
    target_kb: int = 800
    min_quality: int = 55


@dataclass(frozen=True)
class OptimizationResult:
    source: str
    output: str
    status: str
    original_size_bytes: int
    optimized_size_bytes: int
    width: int
    height: int
    mime_type: str
    checksum_sha256: str


def _jpeg_bytes(image: Image.Image, options: OptimizationOptions) -> bytes:
    quality = options.quality
    target = options.target_kb * 1024
    result = b""
    while quality >= options.min_quality:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
        result = buffer.getvalue()
        if len(result) <= target:
            break
        quality -= 4
    return result


def optimize_image(source: Path, output: Path, options: OptimizationOptions) -> OptimizationResult:
    if options.max_edge < 1 or options.target_kb < 1 or not 1 <= options.min_quality <= options.quality <= 95:
        raise ValueError("사진 최적화 설정값이 올바르지 않습니다.")

    original_size = source.stat().st_size
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail((options.max_edge, options.max_edge), Image.Resampling.LANCZOS)
        if image.mode != "RGB":
            background = Image.new("RGB", image.size, "white")
            if "A" in image.getbands():
                background.paste(image, mask=image.getchannel("A"))
            else:
                background.paste(image.convert("RGB"))
            image = background
        else:
            image = image.copy()
        payload = _jpeg_bytes(image, options)
        width, height = image.size

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, output)
    return OptimizationResult(
        source=source.name,
        output=str(output),
        status="succeeded",
        original_size_bytes=original_size,
        optimized_size_bytes=len(payload),
        width=width,
        height=height,
        mime_type="image/jpeg",
        checksum_sha256=sha256(payload).hexdigest(),
    )


def optimize_batch(sources: list[Path], output_dir: Path, options: OptimizationOptions) -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    for index, source in enumerate(sources):
        output = output_dir / f"{index + 1:02d}-{source.stem}.jpg"
        try:
            manifest.append(asdict(optimize_image(source, output, options)))
        except (UnidentifiedImageError, OSError):
            manifest.append({"source": source.name, "status": "failed", "error": "지원하거나 읽을 수 있는 이미지가 아닙니다."})
    return manifest
