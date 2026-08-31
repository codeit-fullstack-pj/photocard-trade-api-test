# 펫 카드(가칭) API 명세서

| 항목 | 값 |
|---|---|
| 버전 | v0.1.0 (2026-08-31 초안) |
| Base URL | `/api/v1` (테스트 페이지와 같은 origin — 로컬·배포 공용) |
| 원본 스키마 | [`openapi/openapi.yaml`](../openapi/openapi.yaml) — Swagger UI가 읽는 단일 소스. 수정본은 이 파일 기준으로 반영 |

## 1. 개요

반려동물(강아지/고양이) 사진을 업로드하면 관상 지수를 분석해 카드를 만들고, 카드를 소장·판매·교환하는 서비스의 API.

- 실제 서비스 스택: Next.js 최신 + Tailwind CSS + Motion, 인증·DB·스토리지는 **Supabase** 예정
- 관상 분석은 티처블 머신 모델을 **서버 측에서** 실행 예정. 현재 미구현이므로 목 서버는 더미(랜덤) 점수를 반환
- Swagger UI 테스트 페이지는 서비스와 **별도의 자체 백엔드(상태 있는 인메모리 목)** 로 동작

### Supabase 전환 노트
- 인증은 전 구간 `Authorization: Bearer <JWT>`. 실서비스에서는 Supabase Auth가 토큰을 발급·검증하고, `/auth/*` 대부분은 Supabase SDK 호출로 대체될 수 있음. 목 서버는 동일한 계약을 자체 더미 토큰으로 시뮬레이션
- **ID 전략**: 공개 ID는 `CHAR(6)` 유지, Supabase `auth.users`(UUID)와는 `User.auth_user_id UUID UNIQUE` 매핑 컬럼으로 연결 (RLS 술어는 `auth_user_id` 기준)
- **소셜 로그인**: provider는 `GOOGLE` · `KAKAO` · `NAVER` (변경 가능). 현재의 `providerToken` 직접 전달 계약은 목 전용 단순화 — 실서비스에서 GOOGLE/KAKAO는 Supabase OAuth(리다이렉트 또는 ID 토큰) 흐름, NAVER는 내장 provider가 아니라 커스텀 OIDC 또는 자체 검증이 필요하며, 전환 시 콜백 코드 교환형 계약으로 대체될 수 있음
- `/auth/signup` 즉시 토큰 발급은 이메일 확인 비활성 전제
- 이미지는 카드 ID 기반 경로로 저장·조회. **pixel은 공개 버킷, original은 사설 버킷**(만료 있는 서명 URL 또는 API 프록시 전용) — 스토리지 직접 URL로 원본 접근 통제가 우회되지 않아야 함

## 2. 공통 규약

- **인증**: 표기가 없는 엔드포인트는 모두 Bearer JWT 필수. 401 = 토큰 없음/만료
- **토큰 정책**: refreshToken은 재발급 시 회전(1회용). 비밀번호 변경·회원 탈퇴 시 해당 유저의 모든 refreshToken 무효화. logout은 본인 소유 refreshToken만 무효화
- **레이트리밋**: `/auth/*` 및 비밀번호 변경은 요청 과다 시 429 `TOO_MANY_REQUESTS`
- **ID**: `CHAR(6)`, `[A-Za-z0-9]{6}` (Notification만 BIGSERIAL 숫자)
- **시간**: ISO 8601 (`2026-08-31T12:00:00+09:00`), 기준 시간대 Asia/Seoul
- **페이지네이션**: `?page=1&limit=20` (limit 최대 100) → 응답 `{ "items": [], "page": 1, "limit": 20, "total": 0 }`
- **에러 포맷**: `{ "code": "UPPER_SNAKE", "message": "설명" }`

| HTTP | code | 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 필드 누락/형식 오류 |
| 401 | `UNAUTHORIZED` | 토큰 없음/무효 (비인증으로 원본 이미지 요청 포함) |
| 402 | `INSUFFICIENT_POINT` | 포인트 부족 |
| 403 | `FORBIDDEN` | 남의 리소스 접근(원본 이미지, 수정/삭제 등) |
| 404 | `NOT_FOUND` | 리소스 없음 (타인의 알림은 존재 비노출을 위해 404) |
| 409 | `EMAIL_EXISTS` | 가입: 이메일 중복 |
| 409 | `ALREADY_ON_SALE` | 이미 판매/교환 게시 중인 카드 (판매 등록·카드 삭제·오퍼 시) |
| 409 | `NOT_ON_SALE` | 종료·취소된 판매글에 대한 구매/오퍼/수정/취소/수락 |
| 409 | `WRONG_SALE_TYPE` | 판매글 유형에 맞지 않는 행동 (교환글 구매, 판매글 오퍼) |
| 409 | `SELF_DEAL` | 자기 판매글 구매/오퍼 |
| 409 | `DAILY_LIMIT_EXCEEDED` | 무료 생성 한도 소진 (`usePoint: true`로 재시도 안내) |
| 409 | `PROVIDER_ALREADY_LINKED` | 이미 연동된 소셜 provider |
| 409 | `LAST_PROVIDER` | 마지막 로그인 수단 해지 시도 |
| 409 | `NO_PASSWORD_ACCOUNT` | 소셜 전용 계정의 비밀번호 변경 |
| 409 | `EXCHANGE_NOT_PENDING` | 대기 상태가 아닌 오퍼에 수락/거절/취소 |
| 409 | `OFFER_CARD_UNAVAILABLE` | 수락 시점에 오퍼 카드의 소유권이 오퍼러에게 없음 (해당 오퍼 자동 CANCELED) |
| 429 | `DRAW_COOLDOWN` | 오늘 뽑기 이미 사용 (`nextDrawAt` 포함) |
| 429 | `TOO_MANY_REQUESTS` | 레이트리밋 |

## 3. 도메인 규칙

### 3.1 관상 지수와 태그
분석 결과는 카테고리별 4개 지수의 % (합 100). 점수 내림차순 배열로 응답하며 `Card.Field`(JSONB)에 그대로 저장.

| category | code | label |
|---|---|---|
| DOG | `ENERGIZER` | 에너자이저 |
| DOG | `MY_WAY` | 마이웨이 |
| DOG | `CAPITALIST_SMILE` | 자본주의 미소 |
| DOG | `GRUMPY_BEAST` | 심기불편 맹수 |
| CAT | `UDADA` | 우다다 |
| CAT | `PRICKLY` | 까칠도도 |
| CAT | `CHURU_HUNTER` | 츄르헌터 |
| CAT | `PUNY_HUMAN` | 하찮은 닝겐 |

- `scores` 예시: `[{ "code": "UDADA", "label": "우다다", "percent": 41.3 }, ...]`
- **Tag** = 상위 2개 label을 공백으로 연결. 예: `"우다다 츄르헌터"`

### 3.2 카드 생성 (원샷 플로우)
`POST /cards` 한 번으로 **업로드 → 분석 → 태그 산정 → 도트 변환 → 카드 생성**이 모두 수행된다.

- 생성 한도: **하루 무료 5개** (Asia/Seoul 자정 리셋). 초과분은 **개당 100포인트**
- 한도 소진 후 `usePoint: true` 없이 요청하면 409 `DAILY_LIMIT_EXCEEDED`, `usePoint: true`인데 포인트가 부족하면 402
- `todayCreatedCount` = 오늘 생성에 **성공한 횟수** (생성 시점에 증가하며, 이후 카드 삭제·소유권 이전과 무관 — 삭제로 한도를 되돌릴 수 없다)
- 응답은 `{ card, point, pointUsed }` — 포인트 차감 여부와 잔액을 함께 반환 (구매 응답과 대칭)
- 카드는 생성 시 판매 상태가 아니며, 판매글(`POST /sales`) 등록을 통해서만 거래에 노출된다
- `createdOwnerNickname`은 **생성 시점 닉네임 스냅샷** (이후 닉네임 변경과 무관). 생성자 식별은 별도 `Created_By`(User ID)로 저장

### 3.3 이미지
- 업로드 허용: `image/jpeg` `image/png` `image/webp`, 최대 10MB
- 저장·조회 모두 카드 고유 ID 기반: `GET /cards/{cardId}/image?type=pixel|original` (기본 `pixel`)
- `pixel`(도트 변환본): 공개. 판매글 등 외부 노출은 항상 도트 이미지 사용
- `original`(원본): **카드 소유자만**. 비인증 요청 = 401, 인증했으나 비소유자 = 403
- 카드 상세(`GET /cards/{cardId}`)는 공개 표현(Card)만 반환하며 원본 URL을 포함하지 않는다. 소유자용 표현(CardOwned)은 `/users/me/cards`와 소유자 전용 응답에서 제공

### 3.4 포인트 뽑기
- `POST /points/draw`: **하루 1회** (Asia/Seoul 자정 리셋), 랜덤 포인트 지급
- 지급표(예시, 조정 가능): 10P 50% · 20P 30% · 50P 15% · 100P 5%
- 중복 시도 시 429 + `nextDrawAt`

### 3.5 거래
- `SALE`(포인트 판매): `price` 필수. 구매 시 구매자 포인트 차감 → 판매자 지급, 카드 소유권 이전, 판매글 `SOLD`
- `EXCHANGE`(교환): `wishCategory`/`wishDescription`으로 희망 조건 명시. 오퍼 수락 시 두 카드 소유권 맞교환, 판매글 `EXCHANGED`, 나머지 대기 오퍼 자동 `REJECTED`
- **오퍼 카드 정합성**: 오퍼는 카드를 잠그지 않는다. 같은 카드로 여러 판매글에 동시 오퍼할 수 있고, 오퍼에 걸린 카드의 판매 등록·삭제도 가능하되 그 시점에 해당 카드의 PENDING 오퍼는 자동 `CANCELED`. 수락 시 서버가 오퍼 카드의 현재 소유권(`Owner == Offerer`)을 재검증하며, 실패하면 409 `OFFER_CARD_UNAVAILABLE` + 해당 오퍼 자동 `CANCELED`
- 판매글 취소(`DELETE /sales/{saleId}`) 시 `CANCELED`, 대기 오퍼 자동 `REJECTED`
- 카드당 활성(ON_SALE) 판매글은 1건 (DB 부분 유니크 인덱스로 강제, §5)
- 종료된 판매글도 공개 조회 유지 — 카드 소유자 ID·닉네임은 공개 프로필 요소로 간주한다
- enum — `sale_status`: `ON_SALE / SOLD / EXCHANGED / CANCELED`, `exchange_status`: `PENDING / ACCEPTED / REJECTED / CANCELED`
- **목록 조회**: `status` 다중 체크(미전달 시 `ON_SALE`) · `category`(미전달 시 둘다) · `trait` 다중 선택(선택 지수가 카드의 최고 지수 2개에 포함, OR) · 검색 `q`(판매글 제목·설명 + 카드 제목·태그) · 정렬 `sort`(`LATEST` 기본 / `OLDEST` / `PRICE_ASC` / `PRICE_DESC` — 가격 정렬 시 price 없는 EXCHANGE형은 후순위 최신순) · `limit` = 페이지당 최대 표시 개수

### 3.6 알림
- 소유 이벤트 발생 시 서버가 생성. 본인 알림만 접근 가능 (타인 알림은 404)
- `type`별 `targetId` 의미:

| type | 상황 | targetId |
|---|---|---|
| `SALE_SOLD` | 내 판매글 판매됨 | saleId |
| `EXCHANGE_OFFERED` | 내 판매글에 오퍼 | saleId |
| `SALE_CANCELED` | 오퍼 넣은 판매글 취소 | saleId |
| `EXCHANGE_ACCEPTED` | 내 오퍼 수락됨 | exchangeId |
| `EXCHANGE_REJECTED` | 내 오퍼 거절됨 | exchangeId |

- 삭제는 **소프트 삭제**: 유저 화면(목록)에서만 사라지고 테이블에는 유지
- `unreadCount` 정합성: **미읽음 상태의 알림을 소프트 삭제하면 차감**, 이미 읽은 알림 삭제는 무변 (읽음 처리와 이중 차감 없음)

### 3.7 계정
- 소셜 **신규 가입** 시: nickname은 제공자 프로필 이름에서 유래(없거나 중복이면 `user-` + 랜덤 접미사 자동 생성), name은 제공자 실명(없으면 nickname과 동일값). 이후 `PATCH /users/me`로 변경 가능 — `User.Name`·`Nickname` 모두 NOT NULL 유지
- **회원 탈퇴 = 소프트 삭제 + 익명화**: 이메일·비밀번호·소셜 연동은 파기하고 닉네임은 "탈퇴한 사용자"로 치환하되 유저 행은 유지(거래 이력 보존). 진행 중 판매글 `CANCELED`, 보낸 PENDING 오퍼 `CANCELED`, 받은 PENDING 오퍼 `REJECTED` 처리. 보유 카드는 소프트 삭제(거래 이력이 참조하는 카드는 하드 삭제 금지)

## 4. 엔드포인트

### Auth
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/signup` | — | 이메일 가입 (email, password, name, nickname) → 유저 + 토큰 |
| POST | `/auth/login` | — | 이메일 로그인 → 토큰 |
| POST | `/auth/social` | — | 소셜 로그인/가입 (provider, providerToken) → 토큰 + `isNewUser` |
| POST | `/auth/refresh` | — | refreshToken → 토큰 재발급 (회전) |
| POST | `/auth/logout` | ✔ | 본인 소유 refreshToken 무효화 |

토큰 응답: `{ "accessToken", "refreshToken", "expiresIn", "user": {...} }`

### User
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/users/me` | ✔ | 내 정보: id, name, nickname, email(소셜 전용 계정은 null), point, providers[], unreadCount, todayCreatedCount, dailyFreeLimit(5), lastDrawAt, createdAt |
| PATCH | `/users/me` | ✔ | name, nickname 수정 |
| PATCH | `/users/me/password` | ✔ | currentPassword, newPassword (소셜 전용 계정 409, 성공 시 전 토큰 무효화) |
| POST | `/users/me/providers` | ✔ | 소셜 추가 연동 (provider, providerToken) |
| DELETE | `/users/me/providers/{provider}` | ✔ | 연동 해지 (마지막 수단이면 409 `LAST_PROVIDER`) |
| DELETE | `/users/me` | ✔ | 회원 탈퇴 (§3.7 소프트 삭제·익명화) |
| GET | `/users/me/cards` | ✔ | 내 보유 카드 전체 (판매 여부 무관, `category` 필터, `sale` 요약·원본 이미지 URL 포함) |
| GET | `/users/me/exchanges` | ✔ | 내가 보낸 오퍼 목록 (`?status=` 필터, 대상 판매글 요약 포함) |

### Card
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/cards` | ✔ | **생성 원샷**: multipart(`image`, `title`, `category`, `description?`, `usePoint?`) → 201 `{ card, point, pointUsed }` |
| GET | `/cards/{cardId}` | — | 카드 상세 (공개 표현, 원본 URL 미포함) |
| PATCH | `/cards/{cardId}` | ✔ | title, description 수정 (소유자만) |
| DELETE | `/cards/{cardId}` | ✔ | 소프트 삭제 (소유자만, 판매 게시 중이면 409, PENDING 오퍼는 자동 CANCELED) |
| GET | `/cards/{cardId}/image` | 조건부 | `?type=pixel`(기본, 공개) / `?type=original`(소유자만: 비인증 401, 비소유자 403) — 이미지 바이너리 |

카드 응답 공통: `{ id, owner, ownerNickname, createdOwnerNickname, title, category, tag, scores[], description, imageUrl, createdAt, updatedAt }` (소유자 표현 CardOwned는 `originalImageUrl`, `sale` 요약 추가)

### Sale
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/sales` | ✔ | 판매글 등록 — SALE: (cardId, type, title, price, description?) / EXCHANGE: (cardId, type, title, wishCategory?, wishDescription?, description?) |
| GET | `/sales` | — | 목록. 필터 `type`·`status[]`·`category`·`trait[]`·`sellerId` + 검색 `q` + 정렬 `sort` + 페이지네이션 (§3.5) |
| GET | `/sales/{saleId}` | — | 상세 (카드 정보 포함) |
| PATCH | `/sales/{saleId}` | ✔ | 판매자 수정 (title, description, price, wish* — ON_SALE만) |
| DELETE | `/sales/{saleId}` | ✔ | 취소 → CANCELED, 대기 오퍼 REJECTED |
| POST | `/sales/{saleId}/purchase` | ✔ | 구매 (SALE 전용): 포인트 이동 + 소유권 이전 + SOLD |
| POST | `/sales/{saleId}/exchanges` | ✔ | 교환 오퍼 (EXCHANGE 전용: offerCardId, message?) |
| GET | `/sales/{saleId}/exchanges` | ✔ | 오퍼 목록 (판매자만) |

### Exchange
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/exchanges/{exchangeId}/accept` | ✔ | 수락 (판매자): 소유권 재검증 → 카드 맞교환 + EXCHANGED |
| POST | `/exchanges/{exchangeId}/reject` | ✔ | 거절 (판매자) |
| DELETE | `/exchanges/{exchangeId}` | ✔ | 오퍼 취소 (오퍼러, PENDING만) → CANCELED |

### Point
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/points/draw` | ✔ | 하루 1회 뽑기 → `{ earned, point, nextDrawAt }` (재시도 429) |

### Notification
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/notifications` | ✔ | 목록 (`?unreadOnly=`, 페이지네이션, 소프트 삭제분 제외) |
| PATCH | `/notifications/{notificationId}/read` | ✔ | 개별 읽음 |
| POST | `/notifications/read-all` | ✔ | 전체 읽음 |
| DELETE | `/notifications/{notificationId}` | ✔ | 개별 소프트 삭제 |
| DELETE | `/notifications` | ✔ | 전체 소프트 삭제 |

## 5. 데이터 모델 매핑과 DDL 수정 제안

전달받은 DDL(User·Card·Sale·Exchange·Notification)을 기준으로 삼되, 확정된 요구사항을 수용하려면 아래 변경이 필요하다.

### User
| 제안 | 근거 |
|---|---|
| `Name VARCHAR(30) NOT NULL` 추가 (소셜 가입 시 자동 채움, §3.7) | 실명/닉네임 분리 확정 |
| `Image_Limit` → `Daily_Free_Limit INT NOT NULL DEFAULT 5` (기본값 3→5, 의미 = 하루 무료 생성 한도) | 하루 무료 5개 확정 |
| `Daily_Created_Count INT NOT NULL DEFAULT 0` + `Daily_Count_Date DATE` 추가 (Asia/Seoul 기준 리셋) | 오늘 생성 수 집계 근거. 카드 삭제·소유권 이전으로 한도를 우회할 수 없어야 함 |
| `Deleted_At TIMESTAMPTZ NULL` 추가 | 탈퇴 = 소프트 삭제·익명화 (거래 이력 보존) |
| `auth_user_id UUID UNIQUE` 추가 | Supabase Auth(UUID) 매핑, RLS 술어 기준 |
| `CREATE UNIQUE INDEX ON "User" (lower(Email)) WHERE Email IS NOT NULL;` | 409 `EMAIL_EXISTS`를 동시 요청에서도 보장 (Email은 소셜 전용 계정 때문에 NULL 허용 유지) |
| `provider`/`provider_id` 컬럼 **제거** → `User_Provider` 테이블로 이관 | 다중 연동(추가/해지) 불가 구조 해소 |

### User_Provider (신설)
`(ID, User_ID CHAR(6) NN, Provider VARCHAR(50) NN CHECK(GOOGLE/KAKAO/NAVER), Provider_ID VARCHAR(255) NN, Created_At)`
- `UNIQUE (Provider, Provider_ID)` — `/auth/social` 계정 조회용
- `UNIQUE (User_ID, Provider)` — 중복 연동 409 보장용

### Card
| 제안 | 근거 |
|---|---|
| `Created_By CHAR(6) NOT NULL` 추가 (생성자 User ID; `CreatedOwner`는 생성 시점 닉네임 스냅샷으로 유지) | 소유권 이전 후에도 생성자 추적 |
| `Tag VARCHAR(30) NOT NULL`, `Field JSONB NOT NULL` 승격 | 원샷 생성에서 항상 채워짐 — API required 계약과 일치 |
| `Deleted_At TIMESTAMPTZ NULL` 추가 (소프트 삭제) | SOLD/EXCHANGED 이력이 참조하는 카드는 하드 삭제 금지 (FK 파손 방지) |
| 이미지 컬럼 불필요 — ID 기반 스토리지 경로 규약 (`cards/{id}/original.*` 사설, `cards/{id}/pixel.*` 공개) | 이미지 저장·조회를 카드 ID로 확정, §1 전환 노트 |

### Sale / Exchange / Notification
| 제안 | 근거 |
|---|---|
| `Sale.Title VARCHAR(20) NOT NULL` 승격 | 요청·응답 모두 필수 |
| `CREATE UNIQUE INDEX ON "Sale" (Card_ID) WHERE Status = 'ON_SALE';` | 카드당 활성 판매글 1건을 동시 요청에서도 보장 |
| `Notification.Deleted_At TIMESTAMPTZ NULL` 추가 | 소프트 삭제 (화면에서만 제거, 테이블 유지) |

## 6. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1.0 | 2026-08-31 | 초안. DDL 기반 + 카드 원샷 생성/도트 이미지/소프트 삭제/뽑기·한도 규칙. 5차원 적대적 검토(확정 28건) 반영. 판매 목록 필터·검색·정렬 확장 |
