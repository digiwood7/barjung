import type { LegalDisclosure } from "@/lib/domain/types";

export interface ParcelAddressInput {
  address: string;
  sigunguCd: string;
  bjdongCd: string;
  platGbCd?: "0" | "1" | "2";
  bun: string;
  ji?: string;
}

export type AddressLookupInput = Pick<ParcelAddressInput, "address"> & Partial<Omit<ParcelAddressInput, "address">>;

export interface BuildingRegisterTitleItem {
  mgmBldrgstPk?: string;
  platPlc?: string;
  newPlatPlc?: string;
  bldNm?: string;
  mainPurpsCdNm?: string;
  etcPurps?: string;
  grndFlrCnt?: string | number;
  ugrndFlrCnt?: string | number;
  useAprDay?: string;
  totArea?: string | number;
  indrMechUtcnt?: string | number;
  oudrMechUtcnt?: string | number;
  indrAutoUtcnt?: string | number;
  oudrAutoUtcnt?: string | number;
}

export interface BuildingRegisterLookupResult {
  source: "MOLIT_BUILDING_HUB";
  queriedAt: string;
  managementId: string;
  address: string;
  roadAddress: string;
  buildingName: string;
  buildingArea: string;
  disclosure: Pick<LegalDisclosure, "location" | "propertyCategory" | "floor" | "approvalDate" | "parking">;
  raw: BuildingRegisterTitleItem;
}
