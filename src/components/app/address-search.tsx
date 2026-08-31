"use client";

import Script from "next/script";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const POSTCODE_SCRIPT = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

interface PostcodeResult {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  buildingCode: string;
  buildingName: string;
  bcode: string;
  userSelectedType: "R" | "J";
}

interface PostcodeConstructor {
  new(options: { oncomplete(data: PostcodeResult): void; onclose?(): void }): { embed(element: HTMLElement): void };
}

declare global {
  interface Window {
    kakao?: { Postcode?: PostcodeConstructor };
    daum?: { Postcode?: PostcodeConstructor };
  }
}

export interface SelectedAddress {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  buildingCode: string;
  buildingName: string;
  bcode: string;
}

interface AddressSearchProps {
  value: string;
  onChange(value: string): void;
  onSelect(result: SelectedAddress): void;
}

export function AddressSearch({ value, onChange, onSelect }: AddressSearchProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen || !searchContainerRef.current) return;
    const Postcode = window.kakao?.Postcode ?? window.daum?.Postcode;
    if (!Postcode) return;

    new Postcode({
      oncomplete(data) {
        const address = data.userSelectedType === "R"
          ? data.roadAddress || data.address
          : data.jibunAddress || data.address;
        onChange(address);
        onSelect({
          address,
          roadAddress: data.roadAddress,
          jibunAddress: data.jibunAddress,
          zonecode: data.zonecode,
          buildingCode: data.buildingCode,
          buildingName: data.buildingName,
          bcode: data.bcode,
        });
        setSearchOpen(false);
      },
      onclose() {
        setSearchOpen(false);
      },
    }).embed(searchContainerRef.current);
  }, [searchOpen, onChange, onSelect]);

  const openSearch = () => {
    const Postcode = window.kakao?.Postcode ?? window.daum?.Postcode;
    if (!Postcode) {
      setError("주소 검색 도구를 불러오는 중입니다. 잠시 후 다시 눌러주세요.");
      return;
    }
    setError("");
    setSearchOpen(true);
  };

  return (
    <>
      <Script src={POSTCODE_SCRIPT} strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => setError("주소 검색 도구를 불러오지 못했습니다.")} />
      <div className="input-action">
        <input aria-label="정확한 주소" value={value} onChange={(event) => onChange(event.target.value)} placeholder="도로명, 지번 또는 건물명" />
        <button type="button" onClick={openSearch}><Search size={15} /> 주소 검색</button>
      </div>
      {!scriptReady && !error && <small className="address-search-status">국내 주소 검색 도구 준비 중…</small>}
      {error && <small className="address-search-error" role="alert">{error}</small>}
      {searchOpen && (
        <div className="address-search-overlay">
          <div className="address-search-dialog" role="dialog" aria-modal="true" aria-label="주소 검색창">
            <div className="address-search-head">
              <strong>주소 검색</strong>
              <button type="button" className="icon-button" aria-label="주소 검색 닫기" onClick={() => setSearchOpen(false)}><X size={19} /></button>
            </div>
            <div className="address-search-embed" ref={searchContainerRef} />
          </div>
        </div>
      )}
    </>
  );
}
