"use client";

import { ChevronRight, Filter, Plus, Search } from "lucide-react";
import { useState } from "react";
import type { Customer } from "@/lib/domain/types";
import { Badge } from "./ui";

export function CustomersView({ customers, onAdd, onEdit }: { customers: Customer[]; onAdd: () => void; onEdit: (customer: Customer) => void }) {
  const [query, setQuery] = useState("");
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.interest}`.toLowerCase().includes(query.trim().toLowerCase()));
  const scheduled = customers.filter((customer) => customer.followUp !== "일정 미정");
  return (
    <div className="view-stack">
      <section className="page-heading"><div><span className="eyebrow">CUSTOMER RELATIONSHIP</span><h1>고객관리</h1><p>희망 조건과 상담 메모, 다음 확인 일정을 관리합니다.</p></div><button className="primary" onClick={onAdd}><Plus size={17} /> 고객 등록</button></section>
      <section className="crm-layout">
        <div className="panel customer-list">
          <div className="filters"><label className="search-field"><Search size={16} /><input aria-label="고객 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 전화번호 검색" /></label><button className="filter-button" type="button"><Filter size={15} /> 조건</button></div>
          {visible.length === 0 && <p className="empty-note">{customers.length === 0 ? "등록된 고객이 없습니다." : "검색 결과가 없습니다."}</p>}
          {visible.map((customer, index) => {
            const today = customer.followUp.startsWith("오늘");
            return (
              <button className="customer-row" key={customer.id} onClick={() => onEdit(customer)}>
                <span className={`mini-avatar av-${index % 4}`}>{customer.name[0]}</span>
                <div className="customer-main"><strong>{customer.name}</strong><small>{customer.phone}</small></div>
                <div><small>희망 매물</small><strong>{customer.interest || "-"}</strong></div>
                <div><small>다음 확인</small><strong>{customer.followUp}</strong></div>
                <Badge tone={today ? "amber" : "slate"}>{today ? "오늘 확인" : "상담 중"}</Badge>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </div>
        <aside className="panel crm-insight">
          <span className="eyebrow">SCHEDULE</span><h2>다음 확인 {scheduled.length}건</h2><p>고객별 다음 확인일을 놓치지 않도록 관리합니다.</p>
          <div className="insight-rail"><i />{scheduled.slice(0, 2).map((customer) => <div key={customer.id}><time>{customer.followUp}</time><strong>{customer.name} 고객</strong><small>{customer.note}</small></div>)}</div>
          <button className="secondary" onClick={() => setQuery("")}>전체 고객 보기</button>
        </aside>
      </section>
    </div>
  );
}
