import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";

const runFile = promisify(execFile);
const MEDIA_BUCKET = "property-media";

export interface LocalMediaFile {
  name: string;
  type: string;
  size: number;
  path: string;
}

interface ManifestItem {
  source: string;
  output?: string;
  status: "succeeded" | "failed";
  error?: string;
  original_size_bytes?: number;
  optimized_size_bytes?: number;
  width?: number;
  height?: number;
  mime_type?: string;
  checksum_sha256?: string;
}

function extension(type: string): string {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

async function pythonExecutable(projectRoot: string): Promise<string> {
  const configured = process.env.BARJUNG_PYTHON?.trim();
  const bundled = path.join(projectRoot, "python", ".venv", "Scripts", "python.exe");
  for (const candidate of [configured, bundled].filter(Boolean) as string[]) {
    try { await access(candidate); return candidate; } catch { /* 다음 후보 */ }
  }
  return process.platform === "win32" ? "python" : "python3";
}

export async function removeExcessPropertyMedia(client: SupabaseClient, propertyId: string, nextPhotoCount: number): Promise<void> {
  const { data: staleMedia, error: selectError } = await client.from("property_media")
    .select("storage_path").eq("property_id", propertyId).gte("sort_order", nextPhotoCount);
  if (selectError) throw new Error(`기존 사진 목록 확인 실패: ${selectError.message}`);
  const storagePaths = (staleMedia ?? []).map((item) => item.storage_path as string).filter(Boolean);
  if (storagePaths.length === 0) return;
  const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove(storagePaths);
  if (removeError) throw new Error(`기존 사진 파일 정리 실패: ${removeError.message}`);
  const { error: deleteError } = await client.from("property_media").delete()
    .eq("property_id", propertyId).gte("sort_order", nextPhotoCount);
  if (deleteError) throw new Error(`기존 사진 메타데이터 정리 실패: ${deleteError.message}`);
}

export async function optimizeLocalPropertyMedia(
  client: SupabaseClient,
  input: { officeId: string; propertyId: string; files: LocalMediaFile[] },
  onProgress?: (processed: number, total: number) => void,
): Promise<number> {
  if (!input.files.length) throw new Error("최적화할 사진이 없습니다.");
  if (input.files.length > 30) throw new Error("사진은 한 번에 30장까지 처리할 수 있습니다.");

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "barjung-local-media-"));
  const inputDir = path.join(temporary, "input");
  const outputDir = path.join(temporary, "output");
  try {
    await mkdir(inputDir, { recursive: true });
    for (let index = 0; index < input.files.length; index += 1) {
      const file = input.files[index];
      await copyFile(file.path, path.join(inputDir, `${String(index + 1).padStart(2, "0")}${extension(file.type)}`));
    }

    const { data: settings } = await client.from("app_settings")
      .select("image_max_edge,image_quality,image_target_kb").eq("office_id", input.officeId).maybeSingle();
    const executable = await pythonExecutable(projectRoot);
    for (let index = 0; index < input.files.length; index += 1) {
      const source = path.join(inputDir, `${String(index + 1).padStart(2, "0")}${extension(input.files[index].type)}`);
      const singleOutputDir = path.join(outputDir, String(index + 1));
      const { stdout } = await runFile(executable, [
        "-m", "barjung_media.cli", source, "--output", singleOutputDir,
        "--max-edge", String(settings?.image_max_edge ?? 1920),
        "--quality", String(settings?.image_quality ?? 82),
        "--target-kb", String(settings?.image_target_kb ?? 800),
      ], {
        cwd: projectRoot,
        env: { ...process.env, PYTHONPATH: [path.join(projectRoot, "python"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
        maxBuffer: 10 * 1024 * 1024,
      });
      const manifest = JSON.parse(stdout) as ManifestItem[];
      const item = manifest[0];
      if (manifest.length !== 1 || item.status !== "succeeded" || !item.output) {
        throw new Error(item?.error || `${input.files[index].name} 사진을 최적화하지 못했습니다.`);
      }
      const storagePath = `${input.officeId}/${input.propertyId}/${String(index + 1).padStart(2, "0")}.jpg`;
      const payload = await readFile(item.output!);
      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(storagePath, payload, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw new Error(`최적화 사진 업로드 실패: ${uploadError.message}`);
      const { error: rowError } = await client.from("property_media").upsert({
        office_id: input.officeId, property_id: input.propertyId, storage_path: storagePath, sort_order: index,
        original_size_bytes: item.original_size_bytes, optimized_size_bytes: item.optimized_size_bytes,
        width: item.width, height: item.height, mime_type: item.mime_type, checksum_sha256: item.checksum_sha256,
      }, { onConflict: "property_id,sort_order" });
      if (rowError) throw new Error(`사진 메타데이터 저장 실패: ${rowError.message}`);
      onProgress?.(index + 1, input.files.length);
    }

    await removeExcessPropertyMedia(client, input.propertyId, input.files.length);
    return input.files.length;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
