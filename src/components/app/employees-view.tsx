"use client";

import { Plus } from "lucide-react";
import type { Employee, Property } from "@/lib/domain/types";
import { Badge, employmentTone } from "./ui";

export function EmployeesView({ employees, properties, onAdd, onEdit }: { employees: Employee[]; properties: Property[]; onAdd: () => void; onEdit: (employee: Employee) => void }) {
  const countFor = (employee: Employee) => properties.filter((property) => property.registeredById === employee.id || (!property.registeredById && property.registeredBy === employee.name)).length;
  return (
    <div className="view-stack">
      <section className="page-heading"><div><span className="eyebrow">TEAM DIRECTORY</span><h1>직원관리</h1><p>매물 등록자와 담당 직원을 관리합니다.</p></div><button className="primary" onClick={onAdd}><Plus size={17} /> 직원 등록</button></section>
      <section className="employee-grid">
        {employees.length === 0 && <p className="empty-note">등록된 직원이 없습니다. 매물 등록 전에 직원을 먼저 등록하세요.</p>}
        {employees.map((employee, index) => (
          <div className="panel employee-card" key={employee.id}>
            <div className={`employee-avatar av-${index % 4}`}>{employee.name[0]}</div>
            <Badge tone={employmentTone(employee.status)}>{employee.status}</Badge>
            <h3>{employee.name}</h3><p>{employee.role}</p><small>{employee.phone}</small>
            <div><span>등록 매물</span><strong>{countFor(employee)}건</strong></div>
            <button className="secondary" onClick={() => onEdit(employee)}>직원 정보 수정</button>
          </div>
        ))}
      </section>
    </div>
  );
}
