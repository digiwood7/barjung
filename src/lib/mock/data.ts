import { PLATFORMS } from "@/lib/domain/types";
import type { Customer, DistributionTarget, Employee, Platform, Property } from "./types";

const completeTargets = (failed?: Platform): DistributionTarget[] =>
  PLATFORMS.map((platform) => ({
    platform,
    status: failed === platform ? "failed" : "succeeded",
    progress: failed === platform ? 64 : 100,
    error: failed === platform ? "로그인 세션이 만료되었습니다." : undefined,
    url: failed === platform ? undefined : `https://example.com/${platform}/preview`,
  }));

const disclosure = {
  location: "대구광역시 북구 산격동",
  contractArea: "26.42㎡",
  propertyCategory: "다가구주택",
  transactionType: "임대",
  floor: "4층 중 2층",
  availableFrom: "즉시 입주",
  rooms: "방 1, 욕실 1",
  approvalDate: "2020. 11. 06.",
  parking: "총 6대",
  maintenance: "월 7만원 (수도·인터넷·공용관리 포함)",
  direction: "남동향 (주실 창 기준)",
  lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개",
  measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다.",
};

export const properties: Property[] = [
  {
    id: "p1", number: "260829-01", title: "북문 3분, 채광 좋은 분리형 원룸", type: "원룸", status: "광고 중",
    area: "산격동", exactAddress: "대구광역시 북구 산격동 481-5", publicAddress: "대구광역시 북구 산격동",
    deposit: 500, rent: 42, maintenance: 7, registeredBy: "정다혜", createdAt: "오늘 10:24", photos: 12, hasVideo: true, videoName: "room-tour.mp4",
    accent: "linear-gradient(135deg,#7c9bb3,#e5d9c5)", disclosure, targets: completeTargets("youtube"),
  },
  {
    id: "p2", number: "260828-03", title: "정문 생활권, 올수리 투룸", type: "투룸", status: "검토 완료",
    area: "대현동", exactAddress: "대구광역시 북구 대현동 119-2", publicAddress: "대구광역시 북구 대현동",
    deposit: 1000, rent: 58, maintenance: 8, registeredBy: "김민지", createdAt: "어제 16:40", photos: 9, hasVideo: false,
    accent: "linear-gradient(135deg,#b7896b,#f2dfbf)", disclosure: { ...disclosure, location: "대구광역시 북구 대현동", contractArea: "41.18㎡", rooms: "방 2, 욕실 1" },
    targets: PLATFORMS.map((platform) => ({ platform, status: "not_requested", progress: 0 })),
  },
  {
    id: "p3", number: "260827-02", title: "테크노문 신축급 풀옵션 오피스텔", type: "오피스텔", status: "계약 진행",
    area: "복현동", exactAddress: "대구광역시 북구 복현동 573-1", publicAddress: "대구광역시 북구 복현동",
    deposit: 300, rent: 47, maintenance: 10, registeredBy: "정다혜", createdAt: "8월 27일", photos: 15, hasVideo: true,
    accent: "linear-gradient(135deg,#5b6f65,#d7d9cd)", disclosure: { ...disclosure, location: "대구광역시 북구 복현동", propertyCategory: "업무시설(오피스텔)" },
    targets: completeTargets(),
  },
  {
    id: "p4", number: "260826-04", title: "북문 앞 합리적인 반전세 원룸", type: "원룸", status: "등록 대기",
    area: "산격동", exactAddress: "대구광역시 북구 산격동 1327-3", publicAddress: "대구광역시 북구 산격동",
    deposit: 2000, rent: 25, maintenance: 5, registeredBy: "김민지", createdAt: "8월 26일", photos: 8, hasVideo: false,
    accent: "linear-gradient(135deg,#89918f,#d9c9bd)", disclosure: { ...disclosure, contractArea: "", direction: "" },
    targets: PLATFORMS.map((platform) => ({ platform, status: "not_requested", progress: 0 })),
  },
];

export const employees: Employee[] = [
  { id: "e1", name: "정다혜", role: "대표 공인중개사", phone: "010-5749-5555", status: "재직" },
  { id: "e2", name: "김민지", role: "중개보조원", phone: "010-2381-4207", status: "재직" },
  { id: "e3", name: "박서준", role: "현장 매니저", phone: "010-9310-1128", status: "휴직" },
];

export const customers: Customer[] = [
  { id: "c1", name: "이서연", phone: "010-4472-1038", interest: "북문 원룸", budget: "보증금 500 / 월 45 이하", followUp: "오늘 17:30", note: "채광과 조용한 환경을 우선" },
  { id: "c2", name: "최현우", phone: "010-8862-7341", interest: "복현동 투룸", budget: "보증금 1,000 / 월 60", followUp: "내일 11:00", note: "친구와 2인 거주 예정" },
  { id: "c3", name: "윤지수", phone: "010-3204-8719", interest: "오피스텔", budget: "월 55 이하", followUp: "9월 1일", note: "주차 가능 매물 요청" },
];
