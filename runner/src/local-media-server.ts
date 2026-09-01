import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { optimizeLocalPropertyMedia, type LocalMediaFile } from "./media-optimizer.js";

const DEFAULT_PORT = 43127;
const MAX_FILES = 30;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type JobStatus = "queued" | "running" | "succeeded" | "failed";
interface LocalJob {
  id: string;
  propertyId: string;
  status: JobStatus;
  processed: number;
  total: number;
  error?: string;
}

export interface LocalMediaServerOptions {
  client: SupabaseClient;
  officeId: string;
  host?: string;
  port?: number;
  allowedOrigins?: string[];
  optimize?: typeof optimizeLocalPropertyMedia;
}

function configuredOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.BARJUNG_RUNNER_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
  return configured?.length ? configured : ["https://barjeong.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"];
}

function applyCors(response: ServerResponse, origin: string | undefined, allowedOrigins: Set<string>): boolean {
  if (origin && !allowedOrigins.has(origin)) return false;
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Barjung-Runner-Token, X-Barjung-Property-Id");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Cache-Control", "no-store");
  return true;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function safeExtension(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function receivePhotos(request: IncomingMessage, directory: string): Promise<LocalMediaFile[]> {
  const files: Array<LocalMediaFile & { ready: Promise<void> }> = [];
  let parseError: Error | null = null;
  const parser = Busboy({ headers: request.headers, limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES, fields: 0 } });

  parser.on("file", (fieldName, stream, info) => {
    if (fieldName !== "photos" || !ALLOWED_TYPES.has(info.mimeType)) {
      parseError = new Error(`${info.filename || "사진"}: JPG, PNG, WebP 사진만 지원합니다.`);
      stream.resume();
      return;
    }
    const index = files.length;
    const destination = path.join(directory, `${String(index + 1).padStart(2, "0")}${safeExtension(info.mimeType)}`);
    const ready = pipeline(stream, createWriteStream(destination)).then(() => undefined);
    stream.on("limit", () => { parseError = new Error(`${info.filename}: 원본 한 장은 25MB 이하여야 합니다.`); });
    files.push({ name: info.filename, type: info.mimeType, size: 0, path: destination, ready });
  });
  parser.on("filesLimit", () => { parseError = new Error(`사진은 한 번에 ${MAX_FILES}장까지 처리할 수 있습니다.`); });

  await new Promise<void>((resolve, reject) => {
    parser.once("close", resolve);
    parser.once("error", reject);
    request.pipe(parser);
  });
  await Promise.all(files.map((file) => file.ready));
  if (parseError) throw parseError;
  if (!files.length) throw new Error("최적화할 사진을 선택하세요.");
  for (const file of files) {
    file.size = (await stat(file.path)).size;
    if (file.size <= 0) throw new Error(`${file.name}: 빈 파일은 처리할 수 없습니다.`);
  }
  return files.map(({ ready: _ready, ...file }) => file);
}

export function createLocalMediaServer(options: LocalMediaServerOptions): Server {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.BARJUNG_RUNNER_MEDIA_PORT || DEFAULT_PORT);
  const token = randomUUID();
  const allowedOrigins = new Set(options.allowedOrigins ?? configuredOrigins());
  const jobs = new Map<string, LocalJob>();
  const activeProperties = new Set<string>();
  const optimize = options.optimize ?? optimizeLocalPropertyMedia;

  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!applyCors(response, origin, allowedOrigins)) return json(response, 403, { error: "허용되지 않은 웹사이트입니다." });
    if (request.method === "OPTIONS") { response.statusCode = 204; response.end(); return; }
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { status: "online", token });
    }
    if (request.headers["x-barjung-runner-token"] !== token) return json(response, 401, { error: "실행기 연결 토큰이 올바르지 않습니다." });

    const jobMatch = url.pathname.match(/^\/media\/jobs\/([0-9a-f-]+)$/i);
    if (request.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      return job ? json(response, 200, job) : json(response, 404, { error: "사진 작업을 찾을 수 없습니다." });
    }

    if (request.method !== "POST" || url.pathname !== "/media/jobs") return json(response, 404, { error: "지원하지 않는 실행기 경로입니다." });
    const propertyId = String(request.headers["x-barjung-property-id"] || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(propertyId)) return json(response, 400, { error: "올바른 매물 ID가 필요합니다." });
    if (activeProperties.has(propertyId)) return json(response, 409, { error: "이 매물의 사진을 이미 최적화하고 있습니다." });

    const { data: property, error: propertyError } = await options.client.from("properties")
      .select("id").eq("id", propertyId).eq("office_id", options.officeId).maybeSingle();
    if (propertyError) return json(response, 500, { error: `매물 확인 실패: ${propertyError.message}` });
    if (!property) return json(response, 404, { error: "사진을 연결할 매물을 찾을 수 없습니다." });

    activeProperties.add(propertyId);
    const incoming = await mkdtemp(path.join(os.tmpdir(), "barjung-runner-upload-"));
    try {
      const files = await receivePhotos(request, incoming);
      const id = randomUUID();
      const job: LocalJob = { id, propertyId, status: "queued", processed: 0, total: files.length };
      jobs.set(id, job);
      json(response, 202, job);

      void (async () => {
        job.status = "running";
        try {
          await optimize(options.client, { officeId: options.officeId, propertyId, files }, (processed, total) => {
            job.processed = processed;
            job.total = total;
          });
          job.status = "succeeded";
        } catch (error) {
          job.status = "failed";
          job.error = error instanceof Error ? error.message : "사진 최적화에 실패했습니다.";
        } finally {
          activeProperties.delete(propertyId);
          await rm(incoming, { recursive: true, force: true });
          const cleanup = setTimeout(() => jobs.delete(id), 30 * 60 * 1000);
          cleanup.unref();
        }
      })();
    } catch (error) {
      activeProperties.delete(propertyId);
      await rm(incoming, { recursive: true, force: true });
      return json(response, 400, { error: error instanceof Error ? error.message : "사진을 전달받지 못했습니다." });
    }
  });
}

export function startLocalMediaServer(options: LocalMediaServerOptions): Server {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.BARJUNG_RUNNER_MEDIA_PORT || DEFAULT_PORT);
  const server = createLocalMediaServer({ ...options, host, port });
  server.listen(port, host, () => console.log(`사진 최적화 수신기: http://${host}:${port}`));
  return server;
}
