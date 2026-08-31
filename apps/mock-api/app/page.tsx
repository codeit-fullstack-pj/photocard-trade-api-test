"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-bundle.js";

const FLOW = [
  "① POST /auth/signup으로 테스트 계정 생성 후 accessToken 발급",
  "② 우측 상단 Authorize에 토큰 입력",
  "③ 카드 생성 → 판매/교환 → 구매·오퍼 → 뽑기 → 알림 흐름 테스트",
];

export default function Home() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    SwaggerUIBundle({
      url: "/openapi.yaml",
      dom_id: "#swagger",
      deepLinking: true,
      persistAuthorization: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 0,
      tryItOutEnabled: true,
    });
  }, []);

  return (
    <main>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-900 px-6 py-8 text-zinc-100"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐶🐱</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Photocard Trade API 테스트</h1>
              <p className="text-sm text-zinc-400">
                목 백엔드 기반 Swagger UI — 실제 서비스와 별도로 동작하며, 서버 재시작 시 데이터가 초기화됩니다.
              </p>
            </div>
          </div>
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } } }}
            className="flex flex-wrap gap-2 text-xs"
          >
            {FLOW.map((step) => (
              <motion.li
                key={step}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                className="rounded-full bg-white/10 px-3 py-1.5"
              >
                {step}
              </motion.li>
            ))}
          </motion.ul>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded bg-black/30 px-2 py-1 font-mono">계정: /auth/signup으로 직접 생성</span>
            <span className="rounded bg-black/30 px-2 py-1 font-mono">소셜: provider + 아무 providerToken</span>
          </div>
        </div>
      </motion.header>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mx-auto max-w-5xl px-2 py-6"
      >
        <div id="swagger" className="rounded-xl bg-white p-2 shadow-sm" />
      </motion.section>
    </main>
  );
}
