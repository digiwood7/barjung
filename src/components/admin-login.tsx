"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "로그인에 실패했습니다.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-mark">ㅂ<span>ㅈ</span></div>
        <small>BARJEONG PROPERTY OFFICE</small>
        <h1>관리자 로그인</h1>
        <p>등록된 관리자 계정으로 작업 공간에 접속하세요.</p>
        <label>아이디<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <div className="admin-login-error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />} 로그인</button>
      </form>
    </main>
  );
}
