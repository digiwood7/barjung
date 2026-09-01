import { readJson, type RouteParams, withLive } from "@/lib/api/server";
import { getProperty } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_BUCKET = "property-videos";
const ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const MAX_FILE_BYTES = 500 * 1024 * 1024;

interface VideoFileInput {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  durationSeconds: number;
}

interface PrepareInput { action: "prepare"; file: VideoFileInput }
interface CommitInput { action: "commit"; path: string; file: VideoFileInput }

function extension(type: string): string {
  if (type === "video/quicktime") return ".mov";
  if (type === "video/webm") return ".webm";
  return ".mp4";
}

function validate(file: VideoFileInput): void {
  if (!file || !ALLOWED_TYPES.has(file.type)) throw new Error("영상은 MP4, MOV, WebM 형식만 지원합니다.");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error("영상은 500MB 이하여야 합니다.");
  if (!Number.isFinite(file.width) || !Number.isFinite(file.height) || file.width <= 0 || file.height <= file.width) throw new Error("높이가 너비보다 큰 세로 영상만 저장할 수 있습니다.");
  if (!Number.isFinite(file.durationSeconds) || file.durationSeconds <= 0) throw new Error("영상 재생 시간을 확인할 수 없습니다.");
}

export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withLive(request, async (ctx) => {
    const { id } = await params;
    if (!await getProperty(ctx, id)) throw new Error("영상을 연결할 매물을 찾을 수 없습니다.");
    const input = await readJson<PrepareInput | CommitInput>(request);
    validate(input.file);
    const expectedPath = `${ctx.officeId}/${id}/vertical${extension(input.file.type)}`;

    if (input.action === "prepare") {
      const { data, error } = await ctx.client.storage.from(VIDEO_BUCKET).createSignedUploadUrl(expectedPath, { upsert: true });
      if (error || !data) throw new Error(`영상 업로드 주소 생성 실패: ${error?.message || "응답 없음"}`);
      return { path: data.path, signedUrl: data.signedUrl };
    }

    if (input.path !== expectedPath || input.path.includes("..")) throw new Error("영상 저장 경로가 매물 범위를 벗어났습니다.");
    const { data: object, error: objectError } = await ctx.client.storage.from(VIDEO_BUCKET).list(`${ctx.officeId}/${id}`, { search: `vertical${extension(input.file.type)}` });
    if (objectError || !object?.some((item) => item.name === `vertical${extension(input.file.type)}`)) throw new Error("업로드된 영상 파일을 확인하지 못했습니다.");

    const { data: previous } = await ctx.client.from("property_videos").select("storage_path").eq("office_id", ctx.officeId).eq("property_id", id).maybeSingle();
    const { error } = await ctx.client.from("property_videos").upsert({
      office_id: ctx.officeId,
      property_id: id,
      storage_path: expectedPath,
      original_filename: input.file.name.slice(0, 255),
      size_bytes: input.file.size,
      mime_type: input.file.type,
      width: Math.round(input.file.width),
      height: Math.round(input.file.height),
      duration_seconds: input.file.durationSeconds,
    }, { onConflict: "property_id" });
    if (error) throw new Error(`영상 메타데이터 저장 실패: ${error.message}`);
    if (previous?.storage_path && previous.storage_path !== expectedPath) await ctx.client.storage.from(VIDEO_BUCKET).remove([previous.storage_path]);
    return getProperty(ctx, id);
  });
}
