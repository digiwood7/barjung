import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "바를정 매물 오피스",
  description: "바를정 부동산 매물·고객·채널 배포 관리",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
