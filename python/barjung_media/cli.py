from __future__ import annotations

import argparse
import glob
import json
import os
from pathlib import Path

from .optimizer import OptimizationOptions, optimize_batch
from .uploader import insert_media_record, upload_file


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="바를정 사진을 로컬에서 최적화합니다.")
    result.add_argument("images", nargs="+", type=Path)
    result.add_argument("--output", type=Path, required=True)
    result.add_argument("--max-edge", type=int, default=1920)
    result.add_argument("--quality", type=int, default=82)
    result.add_argument("--target-kb", type=int, default=800)
    result.add_argument("--manifest", type=Path)
    result.add_argument("--upload", action="store_true", help="최적화 결과를 고객 Supabase에 직접 업로드합니다.")
    result.add_argument("--office-id")
    result.add_argument("--property-id")
    result.add_argument("--bucket", default="property-media")
    return result


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def expand_images(patterns: list[Path]) -> list[Path]:
    """Windows PowerShell 은 *.jpg 를 풀어 주지 않으므로 여기서 와일드카드와 폴더를 펼친다."""
    result: list[Path] = []
    for pattern in patterns:
        text = str(pattern)
        if any(ch in text for ch in "*?["):
            matches = sorted(Path(m) for m in glob.glob(text))
        elif pattern.is_dir():
            matches = sorted(p for p in pattern.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        else:
            matches = [pattern]
        result.extend(m for m in matches if m.suffix.lower() in IMAGE_SUFFIXES or not m.exists())
    return result


def main() -> int:
    args = parser().parse_args()
    images = expand_images(args.images)
    if not images:
        raise SystemExit("처리할 사진이 없습니다. 경로나 와일드카드를 확인하세요.")
    manifest = optimize_batch(images, args.output, OptimizationOptions(max_edge=args.max_edge, quality=args.quality, target_kb=args.target_kb))
    if args.upload:
        if not args.office_id or not args.property_id:
            raise SystemExit("--upload에는 --office-id와 --property-id가 필요합니다.")
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not supabase_url or not service_role_key:
            raise SystemExit("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.")
        for sort_order, item in enumerate(manifest):
            if item["status"] != "succeeded":
                continue
            output_path = Path(str(item["output"]))
            storage_path = f"{args.office_id}/{args.property_id}/{output_path.name}"
            upload_file(supabase_url, service_role_key, args.bucket, storage_path, output_path)
            insert_media_record(supabase_url, service_role_key, office_id=args.office_id, property_id=args.property_id, storage_path=storage_path, sort_order=sort_order, manifest_item=item)
            item["storage_path"] = storage_path
    payload = json.dumps(manifest, ensure_ascii=False, indent=2)
    if args.manifest:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(payload, encoding="utf-8")
    print(payload)
    return 1 if any(item["status"] == "failed" for item in manifest) else 0


if __name__ == "__main__":
    raise SystemExit(main())
