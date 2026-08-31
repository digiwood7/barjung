import { randomUUID } from "node:crypto";
import { readJson, type RouteParams, withLive } from "@/lib/api/server";
import { getProperty } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STAGING_BUCKET = "property-media-staging";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 30;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface UploadFileInput { name: string; type: string; size: number }
interface PrepareInput { action: "prepare"; files: UploadFileInput[] }
interface QueueInput { action: "queue"; jobId: string }

function safeName(name: string, index: number, type: string): string {
  const extension = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKC").replace(/[^a-zA-Z0-9가-힣_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${String(index + 1).padStart(2, "0")}-${stem || "photo"}${extension}`;
}

function validateFiles(files: UploadFileInput[]): void {
  if (!Array.isArray(files) || files.length === 0) throw new Error("최적화할 사진을 선택하세요.");
  if (files.length > MAX_FILES) throw new Error(`사진은 한 번에 ${MAX_FILES}장까지 올릴 수 있습니다.`);
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name}: JPG, PNG, WebP 사진만 지원합니다.`);
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: 원본 한 장은 25MB 이하여야 합니다.`);
  }
}

export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withLive(request, async (ctx) => {
    const { id } = await params;
    const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
    if (!jobId) throw new Error("사진 최적화 작업 ID가 필요합니다.");
    const { data: job, error } = await ctx.client.from("media_optimization_jobs")
      .select("status,error_summary").eq("id", jobId).eq("property_id", id).eq("office_id", ctx.officeId).maybeSingle();
    if (error) throw new Error(`사진 작업 조회 실패: ${error.message}`);
    if (!job) throw new Error("사진 최적화 작업을 찾을 수 없습니다.");
    const property = job.status === "succeeded" ? await getProperty(ctx, id) : null;
    return { status: job.status, error: job.error_summary, property };
  });
}

export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withLive(request, async (ctx) => {
    const { id } = await params;
    if (!await getProperty(ctx, id)) throw new Error("사진을 연결할 매물을 찾을 수 없습니다.");
    const input = await readJson<PrepareInput | QueueInput>(request);

    if (input.action === "prepare") {
      validateFiles(input.files);
      const jobId = randomUUID();
      const sourceFiles = input.files.map((file, index) => ({
        name: file.name, type: file.type, size: file.size,
        path: `${ctx.officeId}/${id}/${jobId}/${safeName(file.name, index, file.type)}`,
      }));
      const { error: insertError } = await ctx.client.from("media_optimization_jobs").insert({
        id: jobId, office_id: ctx.officeId, property_id: id, status: "uploading", source_files: sourceFiles,
      });
      if (insertError) throw new Error(`사진 작업 준비 실패: ${insertError.message}`);
      const uploads = await Promise.all(sourceFiles.map(async (file) => {
        const { data, error } = await ctx.client.storage.from(STAGING_BUCKET).createSignedUploadUrl(file.path);
        if (error || !data) throw new Error(`사진 업로드 주소 생성 실패: ${error?.message || file.name}`);
        return { name: file.name, type: file.type, size: file.size, path: data.path, token: data.token };
      }));
      return { jobId, bucket: STAGING_BUCKET, uploads };
    }

    if (input.action === "queue") {
      const { data, error } = await ctx.client.from("media_optimization_jobs")
        .update({ status: "queued", queued_at: new Date().toISOString() })
        .eq("id", input.jobId).eq("property_id", id).eq("office_id", ctx.officeId).eq("status", "uploading")
        .select("id").maybeSingle();
      if (error) throw new Error(`사진 작업 등록 실패: ${error.message}`);
      if (!data) throw new Error("업로드 준비 상태의 사진 작업을 찾을 수 없습니다.");
      return { jobId: input.jobId, status: "queued" };
    }

    throw new Error("지원하지 않는 사진 작업입니다.");
  });
}
