"use client";

import { Activity, ArrowRight, Building2, Check, CircleAlert, Database, FileCheck2, ImageIcon, MapPin, MessageSquareText, Search, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BuildingRegisterLookupResult } from "@/lib/building-register/types";
import type { ParcelAddressInput } from "@/lib/building-register/types";
import { validateDisclosure } from "@/lib/domain/legal-disclosure";
import type { NewRecord } from "@/lib/domain/repository";
import { PLATFORMS } from "@/lib/domain/types";
import type { Employee, LegalDisclosure, Platform, Property, PropertyKind, WorkspaceMode } from "@/lib/domain/types";
import { accentFor, areaLabel } from "@/lib/supabase/mappers";
import { Badge, PlatformLogo, automaticDisclosureKeys, disclosureLabel, platformName } from "./ui";
import { AddressSearch, type SelectedAddress } from "./address-search";

const steps = ["기본정보", "사진 최적화", "건축물대장", "고지사항", "채널 원고", "등록 확인"];

const demoDisclosure: LegalDisclosure = { location: "대구광역시 북구 산격동 481-5", contractArea: "79.62㎡", propertyCategory: "다가구주택", transactionType: "월세", floor: "4층 중 2층", availableFrom: "즉시 입주", rooms: "방 1, 욕실 1", approvalDate: "2020. 11. 06.", parking: "총 6대", maintenance: "월 7만원 (수도·인터넷 포함)", direction: "", lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개", measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다." };
const liveDisclosure: LegalDisclosure = { location: "", contractArea: "", propertyCategory: "", transactionType: "월세", floor: "", availableFrom: "", rooms: "", approvalDate: "", parking: "", maintenance: "", direction: "", lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개", measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다." };
const demoCopies: Record<Platform, string> = { naver: "경북대 북문 도보 3분, 채광 좋은 분리형 원룸입니다. 보증금 500만원 / 월 42만원, 관리비 7만원입니다.", instagram: "북문 3분 분리형 원룸. 채광 좋고 생활권이 편리합니다. 500/42, 관리비 7.", daangn: "산격동 북문 가까운 깔끔한 원룸입니다. 직접 촬영한 사진이며 즉시 입주 가능합니다.", zigbang: "경북대 북문 인근 / 분리형 원룸 / 풀옵션 / 즉시입주" };
const emptyCopies: Record<Platform, string> = { naver: "", instagram: "", daangn: "", zigbang: "" };

interface PropertyWizardProps {
  mode: WorkspaceMode;
  employees: Employee[];
  onClose: () => void;
  onFinish: (input: NewRecord<Property>, photos: File[]) => Promise<void> | void;
}

function parcelFromSelectedAddress(selected: SelectedAddress | null): Omit<ParcelAddressInput, "address"> | null {
  if (!selected || !/^\d{10}$/.test(selected.bcode)) return null;
  const lot = selected.jibunAddress.match(/(?:^|\s)(산\s*)?(\d+)(?:-(\d+))?\s*$/);
  if (!lot) return null;
  return {
    sigunguCd: selected.bcode.slice(0, 5),
    bjdongCd: selected.bcode.slice(5),
    platGbCd: lot[1] ? "1" : "0",
    bun: lot[2],
    ji: lot[3] || "0",
  };
}

export function PropertyWizard({ mode, employees, onClose, onFinish }: PropertyWizardProps) {
  const demo = mode === "demo";
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.status === "재직"), [employees]);
  const [step, setStep] = useState(0);
  const [optimize, setOptimize] = useState(demo ? 0 : 100);
  const [title, setTitle] = useState(demo ? "북문 도보 3분, 깔끔한 분리형 원룸" : "");
  const [type, setType] = useState<PropertyKind>("원룸");
  const [deposit, setDeposit] = useState(demo ? "500" : "");
  const [rent, setRent] = useState(demo ? "42" : "");
  const [maintenance, setMaintenance] = useState(demo ? "7" : "");
  const [address, setAddress] = useState(demo ? "대구광역시 북구 산격동 481-5" : "");
  const [detailAddress, setDetailAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [registeredById, setRegisteredById] = useState(activeEmployees[0]?.id ?? employees[0]?.id ?? "");
  const [disclosure, setDisclosure] = useState<LegalDisclosure>(demo ? demoDisclosure : liveDisclosure);
  const [copies, setCopies] = useState<Record<Platform, string>>(demo ? demoCopies : emptyCopies);
  const [registryStatus, setRegistryStatus] = useState<"idle" | "loading" | "live" | "demo" | "failed">("idle");
  const [registryMessage, setRegistryMessage] = useState("주소 확인 버튼을 누르면 공공데이터 API로 조회합니다.");
  const [registry, setRegistry] = useState<BuildingRegisterLookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => { if (step !== 1 || optimize >= 100) return; const timer = window.setInterval(() => setOptimize((v) => Math.min(100, v + 4)), 70); return () => window.clearInterval(timer); }, [step, optimize]);

  const missing = validateDisclosure(disclosure).map((key) => disclosureLabel[key]);
  const copyCount = PLATFORMS.filter((platform) => copies[platform].trim()).length;
  const basicsReady = title.trim().length > 0 && address.trim().length > 0;

  const lookupRegistry = async () => {
    setRegistryStatus("loading"); setRegistryMessage("건축물대장을 조회하고 있습니다.");
    try {
      const parcel = parcelFromSelectedAddress(selectedAddress);
      const response = await fetch("/api/building-register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, ...parcel }) });
      const payload = await response.json() as BuildingRegisterLookupResult & { message?: string };
      if (!response.ok) throw new Error(payload.message || "조회 실패");
      setRegistry(payload);
      setDisclosure((current) => ({ ...current, ...payload.disclosure }));
      setRegistryStatus("live"); setRegistryMessage("국토교통부 건축HUB에서 최신 값을 조회했습니다.");
    } catch (error) {
      setRegistry(null);
      const message = error instanceof Error ? error.message : "조회 실패";
      if (message.includes("API 키") || message.includes("연결")) {
        setRegistryStatus("demo"); setRegistryMessage(demo ? "시안 데이터입니다. 고객 API 키 연결 후 실제 값으로 교체됩니다." : "공공데이터 API 키가 없어 자동 조회를 건너뜁니다. 대장 항목을 직접 입력하세요.");
        if (!demo) setDisclosure((current) => ({ ...current, location: current.location || address }));
      } else {
        setRegistryStatus("failed"); setRegistryMessage(message);
      }
    }
  };

  const selectAddress = (result: SelectedAddress) => {
    setSelectedAddress(result);
    setDetailAddress("");
    setRegistry(null);
    setRegistryStatus("idle");
    setRegistryMessage(`우편번호 ${result.zonecode}${result.buildingName ? ` · ${result.buildingName}` : ""} — 상세주소를 입력한 뒤 건축물대장을 확인하세요.`);
    setDisclosure((current) => ({ ...current, location: result.roadAddress || result.address }));
  };

  const finish = async () => {
    const employee = employees.find((item) => item.id === registeredById) ?? null;
    const input: NewRecord<Property> = {
      number: "", title: title.trim(), type, status: "검토 완료", area: areaLabel(disclosure.location || address),
      exactAddress: [address.trim(), detailAddress.trim()].filter(Boolean).join(" "), publicAddress: disclosure.location || address.trim(),
      deposit: Number(deposit) || 0, rent: Number(rent) || 0, maintenance: Number(maintenance) || 0,
      registeredBy: employee?.name ?? "미지정", registeredById: employee?.id ?? null, createdAt: "방금 전",
      photos: demo ? 10 : photos.length, accent: accentFor(`${title}${address}${Date.now()}`), employeeCopy: copies.naver, copies: { ...copies }, disclosure,
      targets: PLATFORMS.map((platform) => ({ platform, status: "not_requested", progress: 0 })),
    };
    setSaving(true); setSaveError("");
    try { await onFinish(input, photos); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "매물을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop"><div className="wizard-modal" role="dialog" aria-modal="true">
      <div className="wizard-head"><div><span className="eyebrow">NEW PROPERTY</span><h2>새 매물 등록</h2></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
      <div className="wizard-steps">{steps.map((label, index) => <div key={label} className={index === step ? "active" : index < step ? "done" : ""}><span>{index < step ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}</div>
      <div className="wizard-body">
        {step === 0 && (
          <div className="form-grid">
            <label className="span-2">매물 제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 북문 도보 3분, 깔끔한 분리형 원룸" /></label>
            <label>매물 유형<select value={type} onChange={(event) => setType(event.target.value as PropertyKind)}><option>원룸</option><option>투룸</option><option>오피스텔</option></select></label>
            <label>거래 형태<select value={disclosure.transactionType} onChange={(event) => setDisclosure((current) => ({ ...current, transactionType: event.target.value }))}><option>월세</option><option>전세</option><option>반전세</option></select></label>
            <label>보증금 (만원)<input inputMode="numeric" value={deposit} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} /></label>
            <label>월세 (만원)<input inputMode="numeric" value={rent} onChange={(event) => setRent(event.target.value.replace(/[^\d]/g, ""))} /></label>
            <label>관리비 (만원)<input inputMode="numeric" value={maintenance} onChange={(event) => setMaintenance(event.target.value.replace(/[^\d]/g, ""))} /></label>
            <label>등록 직원<select value={registeredById} onChange={(event) => setRegisteredById(event.target.value)}>{employees.length === 0 && <option value="">직원 미등록</option>}{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></label>
            <label className="span-2">정확한 주소<AddressSearch value={address} onChange={(value) => { setAddress(value); setSelectedAddress(null); setRegistryStatus("idle"); }} onSelect={selectAddress} /></label>
            <label className="span-2">상세주소<input aria-label="상세주소" value={detailAddress} onChange={(event) => setDetailAddress(event.target.value)} placeholder="동·층·호 등 (내부 전용)" /></label>
            <div className="address-confirm span-2"><span>{selectedAddress ? `선택 완료 · ${selectedAddress.roadAddress ? "도로명" : "지번"} · ${selectedAddress.zonecode}` : "검색 결과에서 주소를 선택해 주세요."}</span><button type="button" onClick={lookupRegistry} disabled={registryStatus === "loading" || !address.trim()}><Search size={15} /> {registryStatus === "loading" ? "조회 중" : "건축물대장 확인"}</button></div>
            <div className="notice span-2"><MapPin size={16} /><div><strong>외부 주소는 플랫폼마다 다르게 공개됩니다.</strong><small>{registryMessage}</small></div></div>
          </div>
        )}
        {step === 1 && demo && (
          <div>
            <div className="drop-zone"><Upload size={28} /><strong>현장 사진 10장을 불러왔습니다</strong><small>Windows 로컬 Python이 원본을 압축한 뒤 Supabase로 전송합니다.</small></div>
            <div className="optimization-box"><div className="optimization-head"><span><Sparkles size={17} /> 로컬 최적화</span><strong>{optimize}%</strong></div><div className="progress"><i style={{ width: `${optimize}%` }} /></div><div className="photo-jobs">{["IMG_4821.HEIC", "IMG_4822.HEIC", "IMG_4823.HEIC"].map((name, index) => <div key={name}><span className="file-thumb"><ImageIcon size={15} /></span><div><strong>{name}</strong><small>10.4MB → {index === 1 ? "648KB" : "712KB"} · EXIF 제거</small></div>{optimize > (index + 1) * 25 ? <Check size={16} /> : <Activity size={16} />}</div>)}</div></div>
          </div>
        )}
        {step === 1 && !demo && (
          <div>
            <label className="drop-zone media-drop-zone"><input aria-label="매물 사진 선택" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotos(Array.from(event.target.files ?? []))} /><Upload size={28} /><strong>{photos.length ? `현장 사진 ${photos.length}장을 선택했습니다` : "현장 사진을 선택하세요"}</strong><small>매물 등록 시 Windows 로컬 Python이 EXIF를 제거하고 축소한 JPEG만 Supabase에 올립니다.</small></label>
            <div className="notice" style={{ marginTop: 12 }}><FileCheck2 size={17} /><div><strong>{photos.length ? "Python 최적화 준비 완료" : "JPG·PNG·WebP, 최대 30장"}</strong><small>{photos.length ? photos.map((file) => file.name).join(" · ") : "원본은 Supabase에 저장하지 않습니다. 사진 없이도 매물 등록은 가능합니다."}</small></div></div>
          </div>
        )}
        {step === 2 && (
          <div className="registry-view">
            <div className="registry-search"><Database size={20} /><div><strong>{registryStatus === "live" ? "건축물대장 실조회 완료" : registryStatus === "failed" ? "건축물대장 조회 실패" : demo ? "건축물대장 시안 데이터" : "건축물대장 미조회"}</strong><small>{registryMessage}</small></div><Badge tone={registryStatus === "live" ? "green" : registryStatus === "failed" ? "red" : "amber"}>{registryStatus === "live" ? "실데이터" : registryStatus === "failed" ? "실패" : demo ? "DEMO" : "직접 입력"}</Badge></div>
            <div className="building-choice selected"><span><Building2 size={20} /></span><div><strong>{registry?.address || address || "주소 미입력"}</strong><small>{[disclosure.propertyCategory, disclosure.floor, disclosure.approvalDate && `사용승인 ${disclosure.approvalDate}`].filter(Boolean).join(" · ") || "대장 항목은 다음 단계에서 입력합니다"}</small></div><Check size={18} /></div>
            <div className="auto-fill-note"><Sparkles size={17} /><span>대상물 종류, 건물 층수, 사용승인일, 주차대수를 자동으로 채웁니다. 계약면적·해당 층·방향·관리비는 직원이 확인합니다.</span></div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="legal-banner"><FileCheck2 size={21} /><div><strong>공인중개사법 고지사항</strong><small>자동 조회값과 현장 입력값을 모두 확인해야 배포할 수 있습니다.</small></div><Badge tone={missing.length ? "amber" : "green"}>{missing.length ? `${missing.length}개 확인 필요` : "13/13 확인"}</Badge></div>
            <div className="legal-form">{(Object.keys(disclosureLabel) as Array<keyof LegalDisclosure>).map((key) => { const automatic = registryStatus === "live" && automaticDisclosureKeys.includes(key); return <label key={key}><span>{disclosureLabel[key]}<em>{automaticDisclosureKeys.includes(key) ? "대장" : "현장"}</em></span><input value={disclosure[key]} readOnly={automatic} placeholder={key === "direction" ? "예: 남동향 (주실 창 기준)" : ""} onChange={automatic ? undefined : (event) => setDisclosure((current) => ({ ...current, [key]: event.target.value }))} /></label>; })}</div>
            {missing.length > 0 && <div className="error-guide"><CircleAlert size={17} /><span><strong>{missing.join(", ")}</strong> 항목을 입력하면 배포 준비가 완료됩니다.</span>{demo && !disclosure.direction && <button type="button" onClick={() => setDisclosure((current) => ({ ...current, direction: "남동향 (주실 창 기준)" }))}>방향 예시값 입력</button>}</div>}
          </div>
        )}
        {step === 4 && (
          <div className="copy-grid">{PLATFORMS.map((platform) => <div className="copy-card" key={platform}><div><PlatformLogo platform={platform} compact /><strong>{platformName[platform]}</strong><Badge tone="blue">직접 작성</Badge></div><textarea aria-label={`${platformName[platform]} 게시 원고`} value={copies[platform]} onChange={(event) => setCopies((current) => ({ ...current, [platform]: event.target.value }))} placeholder={`${platformName[platform]}에 올릴 원고를 직접 작성하세요.`} /><small><ShieldCheck size={12} /> 검증된 법정 고지는 게시 시 수정 불가 영역으로 자동 첨부</small></div>)}</div>
        )}
        {step === 5 && (
          <div className="review-card">
            <div className="review-icon"><Check size={28} /></div>
            <h3>매물 등록 준비가 끝났습니다</h3>
            <p>{demo ? "최적화 사진 10장, 건축물대장 조회값, 직원 작성 원고를 저장합니다." : "매물 저장 후 사진을 Python으로 최적화하고 네이버 글쓰기 작업으로 이동합니다."}</p>
            <div className="review-summary"><span><ImageIcon size={16} /> 사진 <strong>{demo ? "6.8MB" : `${photos.length}장`}</strong></span><span><FileCheck2 size={16} /> 고지사항 <strong>{13 - missing.length}/13</strong></span><span><MessageSquareText size={16} /> 채널 원고 <strong>{copyCount}개</strong></span></div>
            <div className="notice"><FileCheck2 size={17} /><div><strong>현재 검수 후 배포 모드입니다.</strong><small>등록 후 매물 상세에서 원고를 확인하고 전체 배포를 실행합니다.</small></div></div>
            {saveError && <div className="error-guide"><CircleAlert size={17} /><span>{saveError}</span></div>}
          </div>
        )}
      </div>
      <div className="wizard-footer">
        <button className="secondary" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "취소" : "이전"}</button>
        <div>
          <span>{step + 1} / {steps.length}</span>
          {step < steps.length - 1
            ? <button className="primary" disabled={(step === 0 && !basicsReady) || (step === 1 && optimize < 100) || (step === 3 && missing.length > 0)} onClick={() => setStep(step + 1)}>다음 <ArrowRight size={16} /></button>
            : <button className="primary" disabled={saving} onClick={finish}><Check size={16} /> {saving ? "사진 최적화·저장 중" : demo ? "매물 등록" : "등록 후 네이버 글쓰기"}</button>}
        </div>
      </div>
    </div></div>
  );
}
