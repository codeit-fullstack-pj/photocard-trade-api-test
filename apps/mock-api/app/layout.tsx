import type { Metadata } from "next";
import "swagger-ui-dist/swagger-ui.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photocard Trade API 테스트",
  description: "펫 포토카드 트레이드 서비스 API 명세 테스트 페이지 (목 백엔드)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-zinc-100 antialiased">{children}</body>
    </html>
  );
}
