import { describe, expect, it, vi } from "vitest";
import { lookupBuildingRegister, mapBuildingTitle, normalizeLotNumber, normalizeServiceKey, resolveParcelAddress, validateParcelAddress } from "./client";

describe("building register client", () => {
  it("validates and normalizes official parcel parameters", () => {
    expect(normalizeLotNumber("481")).toBe("0481");
    expect(normalizeLotNumber(undefined)).toBe("0000");
    expect(() => validateParcelAddress({ address: "산격동 481-5", sigunguCd: "27230", bjdongCd: "11100", bun: "481", ji: "5" })).not.toThrow();
    expect(() => validateParcelAddress({ address: "산격동", sigunguCd: "27", bjdongCd: "11100", bun: "481" })).toThrow("시군구코드");
  });

  it("accepts either data.go.kr encoding-key format", () => {
    expect(normalizeServiceKey("abc%2Fdef%3D")).toBe("abc/def=");
    expect(normalizeServiceKey("\"abc/def=\"")).toBe("abc/def=");
  });

  it("maps only authoritative title fields and labels total area correctly", () => {
    const result = mapBuildingTitle({
      mgmBldrgstPk: "PK-1", platPlc: "대구광역시 북구 산격동 481-5", mainPurpsCdNm: "단독주택",
      etcPurps: "다가구주택", grndFlrCnt: "4", ugrndFlrCnt: "1", useAprDay: "20201106", totArea: "79.62",
      indrAutoUtcnt: "4", oudrAutoUtcnt: "2",
    }, "2026-08-30T00:00:00.000Z");
    expect(result.disclosure.propertyCategory).toBe("다가구주택");
    expect(result.disclosure.floor).toBe("지상 4층 / 지하 1층");
    expect(result.disclosure.approvalDate).toBe("2020. 11. 06.");
    expect(result.disclosure.parking).toBe("총 6대");
    expect(result.buildingArea).toBe("79.62㎡ (건축물 연면적)");
    expect(result).not.toHaveProperty("disclosure.contractArea");
  });

  it("uses the queried parcel when a valid result omits a management PK", () => {
    const result = mapBuildingTitle({ platPlc: "대구광역시 북구 산격동 481-5" }, "2026-08-30T00:00:00.000Z", "27230-11100-0-0481-0005");
    expect(result.managementId).toBe("27230-11100-0-0481-0005");
  });

  it("resolves a typed address into the parcel codes required by Building HUB", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      results: { common: { errorCode: "0", errorMessage: "정상" }, juso: [{ admCd: "2723011100", lnbrMnnm: "481", lnbrSlno: "5", mtYn: "0", jibunAddr: "대구광역시 북구 산격동 481-5" }] },
    }), { status: 200 }));
    const result = await resolveParcelAddress("대구광역시 북구 산격동 481-5", { apiKey: "juso-key", fetcher });
    expect(result).toMatchObject({ sigunguCd: "27230", bjdongCd: "11100", bun: "481", ji: "5", platGbCd: "0" });
  });

  it("calls the official title endpoint without exposing the key in an error", async () => {
    const payload = {
      response: {
        header: { resultCode: "00" },
        body: {
          items: {
            item: {
              mgmBldrgstPk: "PK-1",
              platPlc: "대구광역시 북구 산격동 481-5",
              mainPurpsCdNm: "다가구주택",
              grndFlrCnt: 4,
              useAprDay: "20201106",
              oudrAutoUtcnt: 6,
            },
          },
        },
      },
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload), { status: 200 }));
    const result = await lookupBuildingRegister(
      { address: "대구광역시 북구 산격동 481-5", sigunguCd: "27230", bjdongCd: "11100", bun: "481", ji: "5" },
      { apiKey: "secret-key", fetcher },
    );
    expect(result.managementId).toBe("PK-1");
    const calledUrl = String(fetcher.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("getBrTitleInfo");
    expect(calledUrl).toContain("bun=0481");
  });
});
