"use client";

import { Activity, ArrowRight, Building2, Check, CircleAlert, Database, FileCheck2, ImageIcon, MapPin, MessageSquareText, Search, Sparkles, Upload, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BuildingRegisterLookupResult } from "@/lib/building-register/types";
import type { ParcelAddressInput } from "@/lib/building-register/types";
import { validateDisclosure } from "@/lib/domain/legal-disclosure";
import type { MediaUploadProgress, NewRecord } from "@/lib/domain/repository";
import { PLATFORMS } from "@/lib/domain/types";
import type { Employee, LegalDisclosure, Platform, Property, PropertyKind, WorkspaceMode } from "@/lib/domain/types";
import { accentFor, areaLabel } from "@/lib/supabase/mappers";
import { Badge, automaticDisclosureKeys, disclosureLabel } from "./ui";
import { AddressSearch, type SelectedAddress } from "./address-search";

const steps = ["기본정보", "사진·영상", "건축물대장", "고지사항 입력", "등록 확인"];

const demoDisclosure: LegalDisclosure = { location: "대구광역시 북구 산격동 481-5", contractArea: "79.62㎡", propertyCategory: "다가구주택", transactionType: "월세", floor: "4층 중 2층", availableFrom: "즉시 입주", rooms: "방 1, 욕실 1", approvalDate: "2020. 11. 06.", parking: "총 6대", maintenance: "월 7만원 (수도·인터넷 포함)", direction: "", lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개", measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다." };
const liveDisclosure: LegalDisclosure = { location: "", contractArea: "", propertyCategory: "", transactionType: "월세", floor: "", availableFrom: "", rooms: "", approvalDate: "", parking: "", maintenance: "", direction: "", lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개", measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다." };
const demoCopies: Record<Platform, string> = { naver: "경북대 북문 도보 3분, 채광 좋은 분리형 원룸입니다. 보증금 500만원 / 월 42만원, 관리비 7만원입니다.", daangn: "산격동 북문 가까운 깔끔한 원룸입니다. 직접 촬영한 사진이며 즉시 입주 가능합니다.", instagram: "북문 3분 분리형 원룸. 채광 좋고 생활권이 편리합니다. 500/42, 관리비 7.", tiktok: "북문 3분 원룸을 영상으로 소개합니다. 500/42, 관리비 7.", youtube: "경북대 북문 도보 3분 분리형 원룸 쇼츠입니다." };
const emptyCopies: Record<Platform, string> = { naver: "", daangn: "", instagram: "", tiktok: "", youtube: "" };
const PROPERTY_DRAFT_KEY = "barjung:property-wizard-draft:v1";
type RegistryStatus = "idle" | "loading" | "live" | "demo" | "failed";

function maintenanceDisclosure(value: string): string {
  return value ? `월 ${value}만원` : "";
}

function contractAreaDisclosure(value: string): string {
  const numeric = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  return numeric ? `${numeric}㎡` : "";
}

interface PropertyWizardDraft {
  version: 1;
  step: number;
  title: string;
  type: PropertyKind;
  deposit: string;
  rent: string;
  maintenance: string;
  address: string;
  detailAddress: string;
  selectedAddress: SelectedAddress | null;
  registeredById: string;
  disclosure: LegalDisclosure;
  copies: Record<Platform, string>;
  registryStatus: RegistryStatus;
  registryMessage: string;
  registry: BuildingRegisterLookupResult | null;
  hadPhotos: boolean;
}

function readPropertyDraft(): PropertyWizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROPERTY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PropertyWizardDraft;
    return parsed.version === 1 && typeof parsed.title === "string" && typeof parsed.address === "string" ? parsed : null;
  } catch {
    window.localStorage.removeItem(PROPERTY_DRAFT_KEY);
    return null;
  }
}

interface PropertyWizardProps {
  mode: WorkspaceMode;
  employees: Employee[];
  property?: Property;
  onClose: () => void;
  onSave: (input: NewRecord<Property>, photos: File[], video: File | null, propertyId?: string, onProgress?: (progress: MediaUploadProgress) => void) => Promise<Property>;
  onDelete?: (propertyId: string) => Promise<void>;
  onPublish: (propertyId: string) => void;
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

export function PropertyWizard({ mode, employees, property, onClose, onSave, onDelete, onPublish }: PropertyWizardProps) {
  const demo = mode === "demo";
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.status === "재직"), [employees]);
  const initialDraft = useMemo(() => demo || property ? null : readPropertyDraft(), [demo, property]);
  const [recoveryDraft, setRecoveryDraft] = useState<PropertyWizardDraft | null>(initialDraft);
  const [draftReady, setDraftReady] = useState(demo || !initialDraft);
  const [step, setStep] = useState(0);
  const [optimize, setOptimize] = useState(demo ? 0 : 100);
  const [title, setTitle] = useState(property?.title ?? (demo ? "북문 도보 3분, 깔끔한 분리형 원룸" : ""));
  const [type, setType] = useState<PropertyKind>(property?.type ?? "원룸");
  const [deposit, setDeposit] = useState(property ? String(property.deposit) : demo ? "500" : "");
  const [rent, setRent] = useState(property ? String(property.rent) : demo ? "42" : "");
  const [maintenance, setMaintenance] = useState(property ? String(property.maintenance) : demo ? "7" : "");
  const [address, setAddress] = useState(property?.exactAddress ?? (demo ? "대구광역시 북구 산격동 481-5" : ""));
  const [detailAddress, setDetailAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [registeredById, setRegisteredById] = useState(property?.registeredById ?? activeEmployees[0]?.id ?? employees[0]?.id ?? "");
  const [disclosure, setDisclosure] = useState<LegalDisclosure>(property?.disclosure ?? (demo ? demoDisclosure : liveDisclosure));
  const [copies, setCopies] = useState<Record<Platform, string>>({ ...(demo ? demoCopies : emptyCopies), ...(property?.copies ?? {}), ...(property?.employeeCopy ? { naver: property.employeeCopy } : {}) });
  const [registryStatus, setRegistryStatus] = useState<RegistryStatus>("idle");
  const [registryMessage, setRegistryMessage] = useState(property ? "저장된 건축물대장·고지사항 값입니다. 주소를 다시 선택하면 재조회할 수 있습니다." : "주소 확인 버튼을 누르면 공공데이터 API로 조회합니다.");
  const [registry, setRegistry] = useState<BuildingRegisterLookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(property ? "저장된 매물을 수정하고 있습니다." : "");
  const [persistedProperty, setPersistedProperty] = useState<Property | null>(property ?? null);
  const [existingPhotoCount, setExistingPhotoCount] = useState(property?.photos ?? 0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [existingVideo, setExistingVideo] = useState(property?.hasVideo ?? false);
  const [photoRestoreNotice, setPhotoRestoreNotice] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<MediaUploadProgress | null>(null);

  const changeMaintenance = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    setMaintenance(digits);
    setDisclosure((current) => ({ ...current, maintenance: maintenanceDisclosure(digits) }));
  };

  const saveDraft = () => {
    if (demo || property || !draftReady || typeof window === "undefined") return;
    const hasContent = Boolean(title.trim() || address.trim() || detailAddress.trim() || photos.length || Object.values(copies).some((value) => value.trim()));
    if (!hasContent) {
      window.localStorage.removeItem(PROPERTY_DRAFT_KEY);
      return;
    }
    const payload: PropertyWizardDraft = {
      version: 1, step, title, type, deposit, rent, maintenance, address, detailAddress, selectedAddress, registeredById,
      disclosure, copies, registryStatus: registryStatus === "loading" ? "idle" : registryStatus,
      registryMessage, registry, hadPhotos: photos.length > 0 || photoRestoreNotice,
    };
    window.localStorage.setItem(PROPERTY_DRAFT_KEY, JSON.stringify(payload));
  };

  useEffect(() => { saveDraft(); }, [step, title, type, deposit, rent, maintenance, address, detailAddress, selectedAddress, registeredById, disclosure, copies, registryStatus, registryMessage, registry, photos, photoRestoreNotice, draftReady]);

  useEffect(() => { if (step !== 1 || optimize >= 100) return; const timer = window.setInterval(() => setOptimize((v) => Math.min(100, v + 4)), 70); return () => window.clearInterval(timer); }, [step, optimize]);

  const missing = validateDisclosure(disclosure).map((key) => disclosureLabel[key]);
  const basicsReady = title.trim().length > 0 && address.trim().length > 0;
  const selectedParcel = parcelFromSelectedAddress(selectedAddress);

  const resetAddressDerivedState = (location = "") => {
    setRegistry(null);
    setRegistryStatus("idle");
    setRegistryMessage("주소 확인 버튼을 누르면 공공데이터 API로 조회합니다.");
    setDisclosure((current) => ({
      ...current,
      location,
      contractArea: "",
      propertyCategory: "",
      floor: "",
      availableFrom: "",
      rooms: "",
      approvalDate: "",
      parking: "",
      direction: "",
    }));
  };

  const lookupRegistry = async () => {
    const parcel = parcelFromSelectedAddress(selectedAddress);
    if (!parcel) {
      setRegistryStatus("failed");
      setRegistryMessage("주소 검색 버튼을 눌러 카카오 검색 결과에서 정확한 주소를 먼저 선택하세요.");
      return;
    }
    setRegistryStatus("loading"); setRegistryMessage("건축물대장을 조회하고 있습니다.");
    try {
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
    resetAddressDerivedState(result.roadAddress || result.address);
    setRegistryMessage(`우편번호 ${result.zonecode}${result.buildingName ? ` · ${result.buildingName}` : ""} — 상세주소를 입력한 뒤 건축물대장을 확인하세요.`);
  };

  const changeAddress = (value: string) => {
    setAddress(value);
    setSelectedAddress(null);
    setDetailAddress("");
    resetAddressDerivedState(value);
  };

  const restoreDraft = () => {
    if (!recoveryDraft) return;
    setStep(Math.max(0, Math.min(steps.length - 1, recoveryDraft.step)));
    setTitle(recoveryDraft.title);
    setType(recoveryDraft.type);
    setDeposit(recoveryDraft.deposit);
    setRent(recoveryDraft.rent);
    setMaintenance(recoveryDraft.maintenance);
    setAddress(recoveryDraft.address);
    setDetailAddress(recoveryDraft.detailAddress);
    setSelectedAddress(recoveryDraft.selectedAddress);
    setRegisteredById(recoveryDraft.registeredById);
    setDisclosure({
      ...liveDisclosure,
      ...recoveryDraft.disclosure,
      maintenance: maintenanceDisclosure(recoveryDraft.maintenance),
    });
    setCopies({ ...emptyCopies, ...recoveryDraft.copies });
    setRegistry(recoveryDraft.registry);
    setRegistryStatus(recoveryDraft.registryStatus === "loading" ? "idle" : recoveryDraft.registryStatus);
    setRegistryMessage(recoveryDraft.registryMessage);
    setPhotos([]);
    setPhotoRestoreNotice(recoveryDraft.hadPhotos);
    setRecoveryDraft(null);
    setDraftReady(true);
  };

  const discardDraft = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(PROPERTY_DRAFT_KEY);
    setRecoveryDraft(null);
    setDraftReady(true);
  };

  const closeWizard = () => {
    saveDraft();
    onClose();
  };

  const finish = async () => {
    const employee = employees.find((item) => item.id === registeredById) ?? null;
    const input: NewRecord<Property> = {
      number: property?.number ?? "", title: title.trim(), type, status: property?.status ?? "검토 완료", area: areaLabel(disclosure.location || address),
      exactAddress: [address.trim(), detailAddress.trim()].filter(Boolean).join(" "), publicAddress: disclosure.location || address.trim(),
      deposit: Number(deposit) || 0, rent: Number(rent) || 0, maintenance: Number(maintenance) || 0,
      registeredBy: employee?.name ?? property?.registeredBy ?? "미지정", registeredById: employee?.id ?? property?.registeredById ?? null, createdAt: property?.createdAt ?? "방금 전",
      photos: property?.photos ?? (demo ? 10 : 0), hasVideo: property?.hasVideo ?? demo, videoName: property?.videoName, accent: property?.accent ?? accentFor(`${title}${address}${Date.now()}`), employeeCopy: copies.naver, copies: { ...copies }, disclosure,
      targets: property?.targets ?? PLATFORMS.map((platform) => ({ platform, status: "not_requested", progress: 0 })),
    };
    setSaving(true); setSaveError(""); setSaveSuccess(""); setMediaProgress(photos.length ? { phase: "transferring", processed: 0, total: photos.length } : null);
    try {
      const saved = await onSave(input, photos, video, persistedProperty?.id ?? property?.id, photos.length ? setMediaProgress : undefined);
      setPersistedProperty(saved);
      setExistingPhotoCount(saved.photos);
      setPhotos([]);
      setVideo(null);
      setExistingVideo(saved.hasVideo);
      setSaveSuccess(photos.length || video ? `매물과 사진 ${saved.photos}장·세로 영상 ${saved.hasVideo ? "1개" : "없음"}를 저장했습니다.` : "매물 정보를 저장했습니다.");
      if (typeof window !== "undefined") window.localStorage.removeItem(PROPERTY_DRAFT_KEY);
    }
    catch (error) { setSaveError(error instanceof Error ? error.message : "매물을 저장하지 못했습니다."); }
    finally { setSaving(false); setMediaProgress(null); }
  };

  const removeProperty = async () => {
    const id = persistedProperty?.id ?? property?.id;
    if (!id || !onDelete) return;
    if (!window.confirm("정말 삭제하시겠습니까?\n매물 DB와 Supabase 사진은 삭제되지만 이미 발행된 플랫폼 게시물은 유지됩니다.")) return;
    setSaving(true); setSaveError(""); setSaveSuccess("");
    try { await onDelete(id); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "매물을 삭제하지 못했습니다."); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop"><div className="wizard-modal" role="dialog" aria-modal="true">
      {saving && mediaProgress && <div className="media-optimization-overlay" role="status" aria-live="polite"><div className="media-optimization-dialog"><div className="media-progress-ring" style={{ background: `conic-gradient(var(--green) ${mediaProgress.total ? Math.round((mediaProgress.processed / mediaProgress.total) * 100) : 0}%, #e4ece8 0)` }}><span>{mediaProgress.processed}<small>/ {mediaProgress.total}</small></span></div><h3>{mediaProgress.phase === "transferring" ? "사진을 로컬 실행기로 전달 중" : mediaProgress.phase === "complete" ? "최적화 사진 저장 완료" : "Python 사진 최적화 중"}</h3><p>원본은 고객 PC에서 처리하며 최적화된 JPEG만 Supabase에 저장합니다.</p></div></div>}
      {recoveryDraft && <div className="draft-recovery-overlay" role="alertdialog" aria-modal="true" aria-labelledby="draft-recovery-title"><div className="draft-recovery-box"><FileCheck2 size={28} /><h3 id="draft-recovery-title">작성 중인 값을 불러올까요?</h3><p>저장되지 않은 매물 정보와 진행 단계를 복원합니다.{recoveryDraft.hadPhotos ? " 사진 파일은 보안상 다시 선택해야 합니다." : ""}</p><div><button type="button" className="secondary" onClick={discardDraft}>아니오, 새로 작성</button><button type="button" className="primary" onClick={restoreDraft}>예, 이전 값 불러오기</button></div></div></div>}
      <div className="wizard-head"><div><span className="eyebrow">PROPERTY EDITOR</span><h2>{persistedProperty ? "매물 등록·수정" : "새 매물 등록"}</h2></div><button className="icon-button" aria-label="닫기" onClick={closeWizard}><X size={20} /></button></div>
      <div className="wizard-steps">{steps.map((label, index) => <button type="button" key={label} aria-current={index === step ? "step" : undefined} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)}><span>{index < step ? <Check size={13} /> : index + 1}</span><small>{label}</small></button>)}</div>
      <div className="wizard-body" role="region" aria-label="매물 등록·수정 항목">
        {step === 0 && (
          <div className="form-grid">
            <label className="span-2">매물 제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 북문 도보 3분, 깔끔한 분리형 원룸" /></label>
            <label>매물 유형<select value={type} onChange={(event) => setType(event.target.value as PropertyKind)}><option>원룸</option><option>투룸</option><option>오피스텔</option></select></label>
            <label>거래 형태<select value={disclosure.transactionType} onChange={(event) => setDisclosure((current) => ({ ...current, transactionType: event.target.value }))}><option>월세</option><option>전세</option><option>반전세</option></select></label>
            <label>보증금 (만원)<input inputMode="numeric" value={deposit} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} /></label>
            <label>월세 (만원)<input inputMode="numeric" value={rent} onChange={(event) => setRent(event.target.value.replace(/[^\d]/g, ""))} /></label>
            <label>관리비 (만원)<input inputMode="numeric" value={maintenance} onChange={(event) => changeMaintenance(event.target.value)} /></label>
            <label>등록 직원<select value={registeredById} onChange={(event) => setRegisteredById(event.target.value)}>{employees.length === 0 && <option value="">직원 미등록</option>}{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></label>
            <label className="span-2">정확한 주소<AddressSearch value={address} onChange={changeAddress} onSelect={selectAddress} /></label>
            <label className="span-2">상세주소<input aria-label="상세주소" value={detailAddress} onChange={(event) => setDetailAddress(event.target.value)} placeholder="동·층·호 등 (내부 전용)" /></label>
            <div className={`address-confirm span-2 ${registryStatus === "live" ? "confirmed" : ""}`}><span>{registryStatus === "live" ? "건축물대장 확인 완료 · 자동 입력값을 확인하세요." : selectedParcel ? `선택 완료 · ${selectedAddress?.roadAddress ? "도로명" : "지번"} · ${selectedAddress?.zonecode}` : "주소 검색 버튼을 눌러 검색 결과를 선택해 주세요."}</span><button type="button" onClick={lookupRegistry} disabled={registryStatus === "loading" || !selectedParcel}>{registryStatus === "live" ? <Check size={15} /> : <Search size={15} />} {registryStatus === "loading" ? "조회 중" : registryStatus === "live" ? "확인 완료" : selectedParcel ? "건축물대장 확인" : "주소 선택 필요"}</button></div>
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
            {photoRestoreNotice && <div className="notice photo-restore-notice"><CircleAlert size={17} /><div><strong>사진을 다시 선택해 주세요.</strong><small>브라우저 보안상 닫기 전에 선택했던 로컬 파일은 자동 복원할 수 없습니다.</small></div></div>}
            <label className="drop-zone media-drop-zone"><input aria-label="매물 사진 선택" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { setPhotos(Array.from(event.target.files ?? [])); setPhotoRestoreNotice(false); setSaveSuccess(""); }} /><Upload size={28} /><strong>{photos.length ? `교체할 사진 ${photos.length}장을 선택했습니다` : existingPhotoCount ? `저장된 최적화 사진 ${existingPhotoCount}장` : "현장 사진을 선택하세요"}</strong><small>{existingPhotoCount ? "새 사진을 선택하면 저장 시 기존 사진 전체를 교체합니다." : "저장 시 Windows 로컬 Python이 EXIF를 제거하고 축소한 JPEG만 보관합니다."}</small></label>
            <div className="notice" style={{ marginTop: 12 }}><FileCheck2 size={17} /><div><strong>{photos.length ? "Python 최적화·사진 교체 준비 완료" : existingPhotoCount ? "기존 사진 유지" : "JPG·PNG·WebP, 최대 30장"}</strong><small>{photos.length ? photos.map((file) => file.name).join(" · ") : existingPhotoCount ? "사진을 선택하지 않고 저장하면 현재 사진을 그대로 유지합니다." : "원본은 Supabase에 저장하지 않습니다. 사진 없이도 매물 저장은 가능합니다."}</small></div></div>
            <div className="media-channel-divider"><strong>영상 전용</strong><span>인스타 릴스 · 틱톡 · 유튜브 쇼츠</span></div>
            <label className="drop-zone media-drop-zone video-drop-zone"><input aria-label="세로 영상 선택" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => { setVideo(event.target.files?.[0] ?? null); setSaveSuccess(""); }} /><Video size={28} /><strong>{video ? `새 영상 1개 선택 · ${video.name}` : existingVideo ? "저장된 세로 영상 1개" : "세로 폰 영상을 선택하세요"}</strong><small>{existingVideo ? "새 영상을 선택하면 세 SNS 채널의 공용 영상이 교체됩니다." : "높이가 너비보다 큰 MP4·MOV·WebM 한 개만 저장합니다."}</small></label>
          </div>
        )}
        {step === 2 && (
          <div className="registry-view">
            <div className="registry-search"><Database size={20} /><div><strong>{registryStatus === "live" ? "건축물대장 실조회 완료" : registryStatus === "failed" ? "건축물대장 조회 실패" : demo ? "건축물대장 시안 데이터" : "건축물대장 미조회"}</strong><small>{registryMessage}</small></div><Badge tone={registryStatus === "live" ? "green" : registryStatus === "failed" ? "red" : "amber"}>{registryStatus === "live" ? "실데이터" : registryStatus === "failed" ? "실패" : demo ? "DEMO" : "직접 입력"}</Badge></div>
            <div className="building-choice selected"><span><Building2 size={20} /></span><div><strong>{registry?.address || address || "주소 미입력"}</strong><small>{[disclosure.propertyCategory, disclosure.floor, disclosure.approvalDate && `사용승인 ${disclosure.approvalDate}`].filter(Boolean).join(" · ") || "대장 항목은 다음 단계에서 입력합니다"}</small></div><Check size={18} /></div>
            <div className="auto-fill-note"><Sparkles size={17} /><span>대상물 종류, 건물 층수, 사용승인일, 주차대수를 자동으로 채웁니다. 계약면적·해당 층·방향·관리비는 직원이 확인합니다.</span></div>
            <div className="registry-manual-action"><span>대장 조회값 외 항목은 다음 단계에서 직접 입력합니다.</span><button type="button" className="secondary" onClick={() => setStep(3)}>고지사항 직접 입력</button></div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="legal-banner"><FileCheck2 size={21} /><div><strong>공인중개사법 고지사항</strong><small>자동 조회값과 현장 입력값을 모두 확인해야 배포할 수 있습니다.</small></div><Badge tone={missing.length ? "amber" : "green"}>{missing.length ? `${missing.length}개 확인 필요` : "13/13 확인"}</Badge></div>
            <div className="legal-form">{(Object.keys(disclosureLabel) as Array<keyof LegalDisclosure>).map((key) => { const automatic = registryStatus === "live" && automaticDisclosureKeys.includes(key); const sharedMaintenance = key === "maintenance"; const contractArea = key === "contractArea"; return <label key={key}><span>{disclosureLabel[key]}<em>{automaticDisclosureKeys.includes(key) ? "대장" : "현장"}</em></span>{contractArea ? <div className="unit-input"><input inputMode="decimal" aria-label={`${disclosureLabel[key]} 값`} value={disclosure.contractArea.replace(/㎡/g, "")} placeholder="예: 79.62" onChange={(event) => setDisclosure((current) => ({ ...current, contractArea: contractAreaDisclosure(event.target.value) }))} /><b>㎡</b></div> : <input inputMode={sharedMaintenance ? "numeric" : undefined} value={sharedMaintenance ? maintenance : disclosure[key]} readOnly={automatic} placeholder={key === "direction" ? "예: 남동향 (주실 창 기준)" : sharedMaintenance ? "만원" : ""} onChange={automatic ? undefined : sharedMaintenance ? (event) => changeMaintenance(event.target.value) : (event) => setDisclosure((current) => ({ ...current, [key]: event.target.value }))} />}</label>; })}</div>
            {missing.length > 0 && <div className="error-guide"><CircleAlert size={17} /><span><strong>{missing.join(", ")}</strong> 항목을 입력하면 배포 준비가 완료됩니다.</span>{demo && !disclosure.direction && <button type="button" onClick={() => setDisclosure((current) => ({ ...current, direction: "남동향 (주실 창 기준)" }))}>방향 예시값 입력</button>}</div>}
          </div>
        )}
        {step === 4 && (
          <div className="review-card">
            <div className="review-icon"><Check size={28} /></div>
            <h3>{persistedProperty ? "매물 정보를 확인하고 저장하세요" : "매물 등록 준비가 끝났습니다"}</h3>
            <p>{demo ? "네이버·당근용 사진과 세로 영상, 건축물대장 조회값을 매물에 저장합니다." : "사진은 네이버·당근용으로 최적화하고, 세로 영상 1개는 인스타·틱톡·유튜브 쇼츠용으로 별도 저장합니다."}</p>
            <div className="review-summary"><span><ImageIcon size={16} /> 사진 <strong>{demo ? "10장" : `${photos.length || existingPhotoCount}장`}</strong></span><span><Video size={16} /> 세로 영상 <strong>{video || existingVideo || demo ? "1개" : "없음"}</strong></span><span><MessageSquareText size={16} /> 플랫폼 발행 <strong>별도 진행</strong></span></div>
            <div className="notice"><FileCheck2 size={17} /><div><strong>저장과 플랫폼 발행은 서로 독립적으로 동작합니다.</strong><small>먼저 매물을 저장한 뒤 플랫폼 발행 버튼에서 게시할 채널을 선택합니다.</small></div></div>
            {saveSuccess && <div className="save-success"><Check size={17} /><span>{saveSuccess}</span></div>}
            {saveError && <div className="error-guide"><CircleAlert size={17} /><span>{saveError}</span></div>}
          </div>
        )}
      </div>
      <div className="wizard-footer">
        <div className="wizard-footer-left">{persistedProperty && onDelete && <button type="button" className="danger-button" disabled={saving} onClick={removeProperty}>매물 삭제</button>}<button type="button" className="secondary wizard-previous" onClick={() => (step === 0 ? closeWizard() : setStep(step - 1))}>{step === 0 ? "닫기" : "← 이전 단계"}</button></div>
        <div>
          <span>{step + 1} / {steps.length}</span>
          {step < steps.length - 1
            ? <button className="primary" disabled={(step === 0 && !basicsReady) || (step === 1 && optimize < 100) || (step === 3 && missing.length > 0)} onClick={() => setStep(step + 1)}>다음 <ArrowRight size={16} /></button>
            : <><button type="button" className="secondary" disabled={saving || !persistedProperty} onClick={() => persistedProperty && onPublish(persistedProperty.id)}>플랫폼 발행</button><button className="primary" disabled={saving || !basicsReady || missing.length > 0} onClick={finish}><Check size={16} /> {saving ? "사진 최적화·매물 저장 중" : persistedProperty ? "변경사항 저장" : "매물 등록"}</button></>}
        </div>
      </div>
    </div></div>
  );
}
