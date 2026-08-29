import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform, PublishInput } from "./types.js";

export interface ClaimedTarget {
  id: string;
  platform: Platform;
  distribution_job_id: string;
  content_draft_id?: string | null;
}

type JobRow = { property_id: string };
type PropertyRow = { id: string; title: string };
type DraftRow = { employee_copy: string; legal_block: string };
type MediaRow = { storage_path: string; sort_order: number };

function assertRecord<T>(value: T | null, label: string): T {
  if (!value) throw new Error(`${label} 데이터를 찾을 수 없습니다.`);
  return value;
}

function safeExtension(storagePath: string): string {
  const extension = path.extname(storagePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".jpg";
}

export class SupabaseRunnerStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly mediaRoot = process.env.BARJUNG_RUNNER_MEDIA_DIR || "tmp/runner-media",
  ) {}

  async loadPublishInput(target: ClaimedTarget): Promise<PublishInput> {
    const { data: job, error: jobError } = await this.client.from("distribution_jobs").select("property_id").eq("id", target.distribution_job_id).single<JobRow>();
    if (jobError) throw new Error(`배포 작업 조회 실패: ${jobError.code}`);
    const propertyId = assertRecord(job, "배포 작업").property_id;

    const [{ data: property, error: propertyError }, draftResult, { data: media, error: mediaError }] = await Promise.all([
      this.client.from("properties").select("id,title").eq("id", propertyId).single<PropertyRow>(),
      target.content_draft_id
        ? this.client.from("content_drafts").select("employee_copy,legal_block").eq("id", target.content_draft_id).single<DraftRow>()
        : this.client.from("content_drafts").select("employee_copy,legal_block").eq("property_id", propertyId).eq("platform", target.platform).order("version", { ascending: false }).limit(1).maybeSingle<DraftRow>(),
      this.client.from("property_media").select("storage_path,sort_order").eq("property_id", propertyId).order("sort_order", { ascending: true }).returns<MediaRow[]>(),
    ]);
    if (propertyError) throw new Error(`매물 조회 실패: ${propertyError.code}`);
    if (draftResult.error) throw new Error(`게시 원고 조회 실패: ${draftResult.error.code}`);
    if (mediaError) throw new Error(`사진 목록 조회 실패: ${mediaError.code}`);
    const draft = assertRecord(draftResult.data, "게시 원고");
    const propertyRow = assertRecord(property, "매물");
    const imagePaths = await this.downloadMedia(target.id, media || []);

    return {
      targetId: target.id,
      platform: target.platform,
      title: propertyRow.title,
      copy: `${draft.employee_copy.trim()}\n\n${draft.legal_block.trim()}`,
      imagePaths,
    };
  }

  private async downloadMedia(targetId: string, rows: MediaRow[]): Promise<string[]> {
    const directory = path.resolve(this.mediaRoot, targetId.replace(/[^a-zA-Z0-9-]/g, "_"));
    await mkdir(directory, { recursive: true });
    return Promise.all(rows.map(async (row, index) => {
      const { data, error } = await this.client.storage.from("property-media").download(row.storage_path);
      if (error || !data) throw new Error(`사진 다운로드 실패: ${error?.message || "empty response"}`);
      const destination = path.join(directory, `${String(index + 1).padStart(2, "0")}${safeExtension(row.storage_path)}`);
      await writeFile(destination, Buffer.from(await data.arrayBuffer()));
      return destination;
    }));
  }
}
