# pet-card-api

반려동물(강아지/고양이) 사진으로 관상 카드를 만들고 소장·판매·교환하는 서비스의 API 명세와 Swagger UI 테스트 페이지.

## 구조

| 경로 | 설명 |
|---|---|
| [`docs/api-spec.md`](docs/api-spec.md) | API 명세서 (사람용, 한국어) |
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | OpenAPI 3.0 스키마 — Swagger UI가 읽는 단일 소스 |
| `apps/mock-api/` | Swagger UI 테스트 페이지 + 상태 있는 인메모리 목 백엔드 (Next.js, 서비스와 별도 동작) |
| `apps/service/` | 실제 서비스 (추후 구현, Next.js + Tailwind + Motion + Supabase) |

## 테스트 페이지 실행

```bash
cd apps/mock-api
npm install
npm run dev
```

터미널에 표시된 주소에서 Swagger UI로 전체 API를 실행해볼 수 있다 (포트는 자동 할당, Swagger 서버가 상대경로라 어느 포트·배포 환경에서든 동작). 명세 수정은 `openapi/openapi.yaml` 기준으로 반영한다.

시드 데모 계정의 이메일·비밀번호는 `apps/mock-api/.env`로만 주입된다 (`.env.example` 참고). env가 없으면 데모 계정은 로그인 불가 상태로 생성되며, `POST /auth/signup`으로 계정을 만들어 테스트하면 된다.
