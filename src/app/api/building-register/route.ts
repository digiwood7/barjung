import { NextResponse } from "next/server";
import { lookupBuildingRegisterByAddress } from "@/lib/building-register/client";
import type { AddressLookupInput } from "@/lib/building-register/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await request.json() as AddressLookupInput;
    const apiKey = process.env.BUILDING_REGISTER_API_KEY?.trim() || "";
    const jusoApiKey = process.env.JUSO_API_KEY?.trim() || "";
    if (!apiKey || (!jusoApiKey && !(input.sigunguCd && input.bjdongCd && input.bun))) {
      return NextResponse.json({ code: "NOT_CONFIGURED", message: "고객 공공데이터·도로명주소 API 키를 연결해야 합니다." }, { status: 503 });
    }
    const result = await lookupBuildingRegisterByAddress(input, {
      buildingApiKey: apiKey,
      jusoApiKey,
      buildingBaseUrl: process.env.BUILDING_REGISTER_API_BASE_URL,
      jusoBaseUrl: process.env.JUSO_API_BASE_URL,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "건축물대장 조회에 실패했습니다.";
    return NextResponse.json({ code: "BUILDING_REGISTER_LOOKUP_FAILED", message }, { status: 400 });
  }
}
