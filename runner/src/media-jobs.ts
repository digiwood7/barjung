import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";

const runFile = promisify(execFile);
const STAGING_BUCKET = "property-media-staging";
const MEDIA_BUCKET = "property-media";

interface SourceFile {
  name: string;
  type: string;
  size: number;
  path: string;
}

export interface ClaimedMediaJob {
  id: string;
  office_id: string;
  property_id: string;
  source_files: SourceFile[];
  lease_agent_id: string;
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

export function validateMediaSourceFiles(job: ClaimedMediaJob): SourceFile[] {
  if (!Array.isArray(job.source_files) || job.source_files.length === 0) throw new Error("원본 사진 목록이 비어 있습니다.");
  const prefix = `${job.office_id}/${job.property_id}/${job.id}/`;
  for (const file of job.source_files) {
    if (!file.path.startsWith(prefix) || file.path.includes("..")) throw new Error("원본 사진 경로가 작업 범위를 벗어났습니다.");
  }
  return job.source_files;
}

async function pythonExecutable(projectRoot: string): Promise<string> {
  const configured = process.env.BARJUNG_PYTHON?.trim();
  const bundled = path.join(projectRoot, "python", ".venv", "Scripts", "python.exe");
  for (const candidate of [configured, bundled].filter(Boolean) as string[]) {
    try { await access(candidate); return candidate; } catch { /* 다음 후보 */ }
  }
  return process.platform === "win32" ? "python" : "python3";
}

async function failJob(client: SupabaseClient, job: ClaimedMediaJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "사진 최적화 실패";
  await client.from("media_optimization_jobs").update({
    status: "failed", error_summary: message.slice(0, 1000), completed_at: new Date().toISOString(),
    lease_agent_id: null, lease_expires_at: null,
  }).eq("id", job.id).eq("lease_agent_id", job.lease_agent_id);
}

export async function removeExcessPropertyMedia(client: SupabaseClient, job: ClaimedMediaJob, nextPhotoCount: number): Promise<void> {
  const { data: staleMedia, error: selectError } = await client.from("property_media")
    .select("storage_path").eq("property_id", job.property_id).gte("sort_order", nextPhotoCount);
  if (selectError) throw new Error(`기존 사진 목록 확인 실패: ${selectError.message}`);
  const storagePaths = (staleMedia ?? []).map((item) => item.storage_path as string).filter(Boolean);
  if (storagePaths.length === 0) return;
  const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove(storagePaths);
  if (removeError) throw new Error(`기존 사진 파일 정리 실패: ${removeError.message}`);
  const { error: deleteError } = await client.from("property_media").delete()
    .eq("property_id", job.property_id).gte("sort_order", nextPhotoCount);
  if (deleteError) throw new Error(`기존 사진 메타데이터 정리 실패: ${deleteError.message}`);
}

export async function runMediaOptimizationJob(client: SupabaseClient, job: ClaimedMediaJob): Promise<void> {
  let files: SourceFile[];
  try { files = validateMediaSourceFiles(job); }
  catch (error) { await failJob(client, job, error); return; }
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "barjung-media-job-"));
  const inputDir = path.join(temporary, "input");
  const outputDir = path.join(temporary, "output");
  try {
    await mkdir(inputDir, { recursive: true });
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const { data, error } = await client.storage.from(STAGING_BUCKET).download(file.path);
      if (error || !data) throw new Error(`${file.name} 원본 다운로드 실패: ${error?.message || "empty response"}`);
      await writeFile(path.join(inputDir, `${String(index + 1).padStart(2, "0")}${extension(file.type)}`), Buffer.from(await data.arrayBuffer()));
    }

    const { data: settings } = await client.from("app_settings")
      .select("image_max_edge,image_quality,image_target_kb").eq("office_id", job.office_id).maybeSingle();
    const executable = await pythonExecutable(projectRoot);
    const { stdout } = await runFile(executable, [
      "-m", "barjung_media.cli", inputDir, "--output", outputDir,
      "--max-edge", String(settings?.image_max_edge ?? 1920),
      "--quality", String(settings?.image_quality ?? 82),
      "--target-kb", String(settings?.image_target_kb ?? 800),
    ], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: [path.join(projectRoot, "python"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
      maxBuffer: 10 * 1024 * 1024,
    });
    const manifest = JSON.parse(stdout) as ManifestItem[];
    if (manifest.length !== files.length || manifest.some((item) => item.status !== "succeeded" || !item.output)) {
      throw new Error(manifest.find((item) => item.status === "failed")?.error || "일부 사진을 최적화하지 못했습니다.");
    }

    for (let index = 0; index < manifest.length; index += 1) {
      const item = manifest[index];
      const storagePath = `${job.office_id}/${job.property_id}/${String(index + 1).padStart(2, "0")}.jpg`;
      const payload = await readFile(item.output!);
      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(storagePath, payload, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw new Error(`최적화 사진 업로드 실패: ${uploadError.message}`);
      const { error: rowError } = await client.from("property_media").upsert({
        office_id: job.office_id, property_id: job.property_id, storage_path: storagePath, sort_order: index,
        original_size_bytes: item.original_size_bytes, optimized_size_bytes: item.optimized_size_bytes,
        width: item.width, height: item.height, mime_type: item.mime_type, checksum_sha256: item.checksum_sha256,
      }, { onConflict: "property_id,sort_order" });
      if (rowError) throw new Error(`사진 메타데이터 저장 실패: ${rowError.message}`);
    }

    await removeExcessPropertyMedia(client, job, manifest.length);

    const { error: completeError } = await client.from("media_optimization_jobs").update({
      status: "succeeded", error_summary: null, completed_at: new Date().toISOString(),
      lease_agent_id: null, lease_expires_at: null,
    }).eq("id", job.id).eq("lease_agent_id", job.lease_agent_id);
    if (completeError) throw new Error(`사진 작업 완료 저장 실패: ${completeError.message}`);
  } catch (error) {
    await failJob(client, job, error);
  } finally {
    await client.storage.from(STAGING_BUCKET).remove(files.map((file) => file.path));
    await rm(temporary, { recursive: true, force: true });
  }
}
