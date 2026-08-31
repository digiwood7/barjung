import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, barjungUniqueKeys, resetFakeSupabaseClock } from "@/test/fake-supabase";
import { properties as demoProperties } from "@/lib/mock/data";
import {
  createCustomer, createEmployee, createProperty, deleteProperty, getProperty, loadWorkspace, nextPropertyNumber,
  requestDistribution, resolveOfficeId, updateCustomer, updateProperty, updateSettings, type WorkspaceContext,
} from "./workspace";

const OFFICE = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000101";
const NOW = new Date("2026-08-30T03:00:00.000Z"); // KST 12:00

function seeded() {
  const db = new FakeSupabase({ uniqueKeys: barjungUniqueKeys });
  db.seed("offices", [{ id: OFFICE, name: "바를정공인중개사사무소", region_label: "경북대 캠퍼스 권역", created_at: "2026-08-01T00:00:00Z" }]);
  db.seed("employees", [
    { id: "emp-1", office_id: OFFICE, name: "정다혜", phone: "010-0000-0000", position: "대표 공인중개사", employment_status: "active", created_at: "2026-08-01T00:00:01Z" },
    { id: "emp-2", office_id: OFFICE, name: "김민지", phone: "010-0000-0001", position: "중개보조원", employment_status: "active", created_at: "2026-08-01T00:00:02Z" },
  ]);
  db.seed("app_settings", [{ office_id: OFFICE, publish_mode: "review", image_max_edge: 1920, image_quality: 82, image_target_kb: 800, platform_settings: {} }]);
  db.seed("local_agents", [{ id: AGENT, office_id: OFFICE, device_name: "BARJUNG-OFFICE-01", operating_system: "windows", version: "0.1.0", status: "online", last_heartbeat_at: new Date(NOW.getTime() - 5000).toISOString() }]);
  return db;
}

describe("workspace 데이터 서비스 (가짜 Supabase)", () => {
  let db: FakeSupabase;
  let ctx: WorkspaceContext;
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); resetFakeSupabaseClock(NOW); db = seeded(); ctx = { client: db.asClient(), officeId: OFFICE, now: NOW }; });
  afterEach(() => vi.useRealTimers());

  it("seed 만 적용된 빈 사업장을 live 스냅샷으로 읽는다", async () => {
    expect(await resolveOfficeId(db.asClient(), {} as NodeJS.ProcessEnv)).toBe(OFFICE);
    const snapshot = await loadWorkspace(ctx, false);
    expect(snapshot.mode).toBe("live");
    expect(snapshot.office.name).toBe("바를정공인중개사사무소");
    expect(snapshot.agent.status).toBe("online");
    expect(snapshot.agent.label).toMatch(/온라인 · 5초 전/);
    expect(snapshot.employees.map((e) => e.name)).toEqual(["정다혜", "김민지"]);
    expect(snapshot.properties).toEqual([]);
    expect(snapshot.settings.publishMode).toBe("review");
  });

  it("매물 등록 → 매물번호 채번·법정 고지·플랫폼 원고까지 저장하고 화면 모델로 되돌려 준다", async () => {
    expect(await nextPropertyNumber(ctx)).toBe("260830-01");
    const seed = demoProperties[0];
    const created = await createProperty(ctx, {
      ...seed, number: "", registeredBy: "김민지", registeredById: undefined,
      copies: { naver: "네이버 원고", instagram: "인스타 원고", daangn: "당근 원고", zigbang: "직방 원고" },
    });
    expect(created.number).toBe("260830-01");
    expect(created.registeredBy).toBe("김민지");
    expect(created.deposit).toBe(500);
    expect(db.rows("properties")[0].deposit_won).toBe(5_000_000);
    expect(created.disclosure.direction).toBe("남동향 (주실 창 기준)");
    expect(db.rows("legal_disclosures")[0].validation_status).toBe("valid");
    expect(db.rows("content_drafts")).toHaveLength(4);
    expect(db.rows("content_drafts")[0].legal_block).toContain("공인중개사법 시행령에 따른 명시사항");
    expect(created.targets.every((t) => t.status === "not_requested")).toBe(true);
    expect(created.createdAt).toMatch(/^오늘/);
    expect(await nextPropertyNumber(ctx)).toBe("260830-02");
  });

  it("당일 중간 번호를 삭제해도 이미 사용한 번호보다 큰 다음 번호를 만든다", async () => {
    const seed = demoProperties[0];
    const first = await createProperty(ctx, { ...seed, number: "260830-01" });
    const second = await createProperty(ctx, { ...seed, number: "260830-02" });
    await createProperty(ctx, { ...seed, number: "260830-03" });
    await deleteProperty(ctx, second.id);

    expect(first.number).toBe("260830-01");
    expect(await nextPropertyNumber(ctx)).toBe("260830-04");
  });

  it("고지가 비면 invalid 로 저장하고 배포 요청을 막는다", async () => {
    const created = await createProperty(ctx, { ...demoProperties[3], number: "" });
    expect(db.rows("legal_disclosures")[0].validation_status).toBe("invalid");
    await expect(requestDistribution(ctx, created.id)).rejects.toThrow(/법정 고지 필수값 누락/);
  });

  it("전체 발행 요청에서 네이버부터 네 플랫폼을 한 작업에 순서대로 큐잉한다", async () => {
    const created = await createProperty(ctx, { ...demoProperties[0], number: "", copies: { naver: "n", instagram: "i", daangn: "d", zigbang: "z" } });
    const queued = await requestDistribution(ctx, created.id);
    expect(queued.targets.map((t) => t.status)).toEqual(["queued", "queued", "queued", "queued"]);
    expect(db.rows("distribution_jobs")).toHaveLength(1);
    expect(db.rows("distribution_targets").map((t) => t.platform)).toEqual(["naver", "instagram", "daangn", "zigbang"]);
    expect(db.rows("distribution_targets").every((t) => t.content_draft_id)).toBe(true);
    await expect(requestDistribution(ctx, created.id)).rejects.toThrow(/방금 요청/);
    const naverDrafts = db.rows("content_drafts").filter((draft) => draft.platform === "naver");
    const latestNaverDraft = naverDrafts.sort((a, b) => Number(b.version) - Number(a.version))[0];
    expect(latestNaverDraft.employee_copy).toContain(created.title);
    expect(latestNaverDraft.employee_copy).toContain("\n\nn");
  });

  it("매물 수정은 상태·금액·고지·원고 버전을 갱신하고 삭제는 하위 행까지 지운다", async () => {
    const created = await createProperty(ctx, { ...demoProperties[0], number: "", employeeCopy: "첫 원고" });
    const updated = await updateProperty(ctx, created.id, { status: "광고 중", rent: 45, disclosure: { ...created.disclosure, direction: "" }, employeeCopy: "둘째 원고" });
    expect(updated.status).toBe("광고 중");
    expect(updated.rent).toBe(45);
    expect(updated.disclosure.direction).toBe("");
    expect(db.rows("legal_disclosures")[0].validation_status).toBe("invalid");
    const naverDrafts = db.rows("content_drafts").filter((d) => d.platform === "naver").map((d) => d.version).sort();
    expect(naverDrafts).toEqual([1, 2]);
    await deleteProperty(ctx, created.id);
    expect(await getProperty(ctx, created.id)).toBeNull();
    expect(db.rows("legal_disclosures")).toHaveLength(0);
  });

  it("고객·직원 CRUD 와 설정 저장이 DB 열 이름으로 왕복한다", async () => {
    const customer = await createCustomer(ctx, { name: "김고객", phone: "010-1111-2222", interest: "원룸", budget: "월 45 이하", followUp: "2026-09-01 14:00", note: "채광" });
    expect(db.rows("customers")[0].follow_up_at).toBe("2026-09-01T05:00:00.000Z");
    expect(customer.followUp).toBe("9월 1일 14:00");
    await expect(createCustomer(ctx, { name: "중복", phone: "010-1111-2222", interest: "", budget: "", followUp: "", note: "" })).rejects.toThrow(/같은 전화번호/);
    const edited = await updateCustomer(ctx, customer.id, { note: "주차", followUpAt: null });
    expect(edited.note).toBe("주차");
    expect(edited.followUp).toBe("일정 미정");

    const employee = await createEmployee(ctx, { name: "박서준", phone: "010-3", role: "현장 매니저", status: "휴직" });
    expect(db.rows("employees").find((e) => e.name === "박서준")?.employment_status).toBe("leave");
    expect(employee.status).toBe("휴직");

    const settings = await updateSettings(ctx, { publishMode: "automatic", publicAddressPolicy: { naver: "hidden" } as never });
    expect(settings.publishMode).toBe("automatic");
    expect(settings.publicAddressPolicy).toMatchObject({ naver: "hidden", zigbang: "lot" });
  });
});
