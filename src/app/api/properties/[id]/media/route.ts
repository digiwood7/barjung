import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isRemoteAdminRuntime, requireRemoteAdmin, type RouteParams, withLive } from "@/lib/api/server";
import { getProperty, loadSettings } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const runFile = promisify(execFile);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 30;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface PythonManifestItem {
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

async function pythonExecutable(root: string): Promise<string> {
  const configured = process.env.BARJUNG_PYTHON?.trim();
  const bundled = path.join(root, "python", ".venv", "Scripts", "python.exe");
  for (const candidate of [configured, bundled].filter(Boolean) as string[]) {
    try { await access(candidate); return candidate; } catch { /* 다음 후보 */ }
  }
  return process.platform === "win32" ? "python" : "python3";
}

function validateFiles(value: FormDataEntryValue[]): File[] {
  const files = value.filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) throw new Error("최적화할 사진을 선택하세요.");
  if (files.length > MAX_FILES) throw new Error(`사진은 한 번에 ${MAX_FILES}장까지 올릴 수 있습니다.`);
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name}: JPG, PNG, WebP 사진만 지원합니다.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: 원본 한 장은 25MB 이하여야 합니다.`);
  }
  return files;
}

async function cleanup(directory: string): Promise<void> {
  const tempRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("barjung-media-")) return;
  await rm(resolved, { recursive: true, force: true });
}

export async function POST(request: Request, { params }: RouteParams<"id">) {
  const denied = requireRemoteAdmin(request);
  if (denied) return denied;
  if (isRemoteAdminRuntime()) {
    return NextResponse.json({ code: "LOCAL_REQUIRED", message: "사진 Python 최적화는 바를정 Windows PC의 로컬 관리자에서 실행하세요." }, { status: 503 });
  }
  return withLive(request, async (ctx) => {
    const { id } = await params;
    if (!await getProperty(ctx, id)) throw new Error("사진을 연결할 매물을 찾을 수 없습니다.");
    const files = validateFiles((await request.formData()).getAll("files"));
    const settings = await loadSettings(ctx);
    const root = process.cwd();
    const directory = await mkdtemp(path.join(os.tmpdir(), "barjung-media-"));
    const inputDir = path.join(directory, "input");
    const outputDir = path.join(directory, "output");
    try {
      await mkdir(inputDir, { recursive: true });
      await Promise.all(files.map(async (file, index) => {
        const extension = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
        await writeFile(path.join(inputDir, `${String(index + 1).padStart(2, "0")}${extension}`), Buffer.from(await file.arrayBuffer()));
      }));
      const executable = await pythonExecutable(root);
      const pythonPath = path.join(root, "python");
      const { stdout } = await runFile(executable, [
        "-m", "barjung_media.cli", inputDir,
        "--output", outputDir,
        "--max-edge", String(settings.imageMaxEdge),
        "--quality", String(settings.imageQuality),
        "--target-kb", String(settings.imageTargetKb),
      ], {
        cwd: root,
        env: { ...process.env, PYTHONPATH: [pythonPath, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
        maxBuffer: 10 * 1024 * 1024,
      });
      const manifest = JSON.parse(stdout) as PythonManifestItem[];
      const succeeded = manifest.filter((item) => item.status === "succeeded" && item.output);
      if (succeeded.length !== files.length) {
        const failed = manifest.find((item) => item.status === "failed");
        throw new Error(failed?.error || "일부 사진을 최적화하지 못했습니다.");
      }
      for (let index = 0; index < succeeded.length; index += 1) {
        const item = succeeded[index];
        const payload = await readFile(item.output!);
        const storagePath = `${ctx.officeId}/${id}/${String(index + 1).padStart(2, "0")}.jpg`;
        const { error: uploadError } = await ctx.client.storage.from("property-media").upload(storagePath, payload, { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw new Error(`최적화 사진 업로드 실패: ${uploadError.message}`);
        const { error: rowError } = await ctx.client.from("property_media").upsert({
          office_id: ctx.officeId,
          property_id: id,
          storage_path: storagePath,
          sort_order: index,
          original_size_bytes: item.original_size_bytes,
          optimized_size_bytes: item.optimized_size_bytes,
          width: item.width,
          height: item.height,
          mime_type: item.mime_type,
          checksum_sha256: item.checksum_sha256,
        }, { onConflict: "property_id,sort_order" });
        if (rowError) throw new Error(`사진 메타데이터 저장 실패: ${rowError.message}`);
      }
      const updated = await getProperty(ctx, id);
      if (!updated) throw new Error("사진 저장 후 매물을 다시 읽지 못했습니다.");
      return updated;
    } finally {
      await cleanup(directory);
    }
  });
}
