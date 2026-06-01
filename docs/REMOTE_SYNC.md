# PC · 모바일 공통 재고 동기화 (Vercel + Upstash Redis) — **v2.0 보류**

현재 **베타·안정화 빌드**에서는 클라이언트가 **`VITE_INVENTORY_REMOTE_SYNC=true`일 때만** API를 호출합니다 (`VITE_INVENTORY_SYNC_TOKEN`만으로는 켜지지 않음).  
`vercel.json`의 빌드 env는 기본 **`VITE_INVENTORY_REMOTE_SYNC=false`** 입니다.  
서버의 `api/inventory.js`는 **Redis 연동을 사용하지 않으며** `503 cloud_sync_disabled`만 반환합니다(v2.0에서 재개 예정).

브라우저 `localStorage`는 **기기별**이라 PC와 휴대폰에서 서로 다른 데이터가 보일 수 있습니다.  
v2.0에서 동기를 켜면 **동일한 JSON 스냅샷**을 Upstash Redis에 저장하는 방식을 다시 적용할 수 있습니다.

## 동작 요약 (원격 동기가 켜진 빌드에서만)

- 원격 동기화가 켜져 있으면, 로그인 직후 **첫 `GET /api/inventory`가 끝날 때까지** 메인 화면 대신 동기화 스플래시를 보여 **로컬 `localStorage`가 화면에 먼저 덮어쓰이지 않게** 합니다. **pull이 실패·비JSON 응답·타임아웃이어도** 로컬 데이터를 유지한 채 스플래시를 닫고 대시보드로 진입합니다(동기 오류는 사용자에게 표시하지 않음).
- 로그인 후 **서버에서 스냅샷을 한 번 불러옵니다** (없으면 404 → 로컬 캐시 유지).
- 재고 관련 상태가 바뀌면 **약 1.8초 후 자동으로 서버에 저장**합니다.
- 운송중 화면에서 **입고 처리** 또는 PC에서 **입고 취소**를 완료하면, 짧은 지연 후 **즉시 push → pull** 하여 다른 기기와 맞춥니다.
- **45초마다** + 탭을 다시 보일 때(`visibilitychange`) + 창 포커스(`window` `focus`) 시 서버에서 **다시 불러옵니다**.
- 메인 화면에서 **탭(뷰)을 바꿀 때마다** 한 번 더 `pull` 하여 모바일에서도 최신을 맞춥니다.
- `GET/PUT /api/inventory` 요청은 **`fetch(..., { cache: 'no-store' })`** 로 브라우저 HTTP 캐시를 쓰지 않습니다.
- PWA(Service Worker): `/api/*`는 **NetworkOnly**, HTML 내비게이션은 **NetworkFirst**로 오래된 셸·데이터가 남기 어렵게 했습니다.
- 설정 화면에서 **수동 가져오기 / 보내기**도 가능합니다.

포함 데이터: `buildAppDataSnapshot`과 동일 — 창고(master), 출고 계획, 운송중, 기준일(ops), 주간 시뮬, 원가 맵, 입고 원장, 입고 취소 로그, **사용자 목록(users)**.

## 0. 배포·PWA·디버그 확인

1. **Vercel 최신 배포**: 대시보드 → Deployments에서 최상단 배포의 커밋·시간 확인. CLI는 `npx vercel ls` 등으로 확인 가능합니다.
2. **콘솔 로그(권장 순서)**: DevTools → Console에서 `[tc-inv sync]` 로 필터링합니다.  
   로그인 성공 시 `login:success → will pull...` 이후  
   `runtime:remote-sync`(API URL·동기화 on/off) →  
   `setRemoteHydrated` `{ next: false, reason: 'effect:remote-bootstrap:pre-pull' }` →  
   `bootstrap:pull-begin` → `fetch:request` / `fetch:response` →  
   `pullRemoteInventory:http` → `merge:from-server` →  
   `setRemoteHydrated` `{ next: true, reason: 'effect:remote-bootstrap:after-pull' }` →  
   `remoteHydrated:commit` `{ remoteHydrated: true }`  
   순으로 이어지면, 서버 데이터가 state에 반영된 뒤 UI가 열린 것입니다.
3. **PWA**: 새 빌드 배포 후 SW가 갱신되도록 `registerType: 'autoUpdate'`, 주기적 `registration.update()`(약 4시간), Workbox `cleanupOutdatedCaches`가 적용되어 있습니다. `vercel.json`에서 `index.html`·`manifest`는 **no-cache**에 가깝게 두었습니다.

## 1. Upstash Redis

1. [Vercel Marketplace](https://vercel.com/marketplace) 또는 [Upstash](https://upstash.com/)에서 Redis 생성.
2. **REST URL**과 **REST TOKEN**을 복사합니다.

## 2. Vercel 환경 변수

프로젝트 → **Settings → Environment Variables**에 다음을 추가합니다 (Production / Preview 필요 시).

| 이름 | 설명 |
|------|------|
| `UPSTASH_REDIS_REST_URL` | Upstash 대시보드의 REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST TOKEN |
| `INVENTORY_SYNC_TOKEN` | API 인증용 공유 비밀값 (임의의 긴 문자열) |

클라이언트에서도 같은 토큰이 필요합니다 (아래 `VITE_*`).

## 3. 클라이언트(Vite) 환경 변수

빌드 시 주입됩니다. **Vercel**에서는 동일 이름으로 **Environment Variables**에 추가합니다.

| 이름 | 값 |
|------|-----|
| `VITE_INVENTORY_SYNC_TOKEN` | `INVENTORY_SYNC_TOKEN`과 **동일**한 문자열(원격을 켤 때 필요). **토큰만으로는 동기가 켜지지 않습니다.** |
| `VITE_INVENTORY_REMOTE_SYNC` | **`true`**(문자열)일 때만 클라이언트가 `/api/inventory`를 호출합니다. 기본 빌드는 `vercel.json`에서 `false` |
| `VITE_DEBUG_REMOTE_SYNC` (선택) | `true`이면 fetch 응답 본문 앞부분 등 **추가 디버그 로그** |

> `VITE_*` 값은 번들에 포함됩니다. 내부용·팀 공유 비밀으로 취급하고, 공개 저장소에는 커밋하지 마세요.

## 4. API 라우트

저장소 루트의 `api/inventory.js`가 Vercel Serverless Function으로 배포됩니다.

- **현재(베타 복구 빌드):** `GET`/`PUT` 모두 **503** `{ "ok": false, "error": "cloud_sync_disabled" }` — Upstash·로컬 디스크 미사용.
- **v2.0 예정:** Redis 키 `tc-inventory:snapshot` GET/PUT, 헤더 `x-tc-inv-sync-token: <INVENTORY_SYNC_TOKEN>`.

로컬 `npm run dev`에서는 `/api/inventory`가 없을 수 있습니다. 클라우드 동기를 끄려면 **`VITE_INVENTORY_REMOTE_SYNC`를 `true`로 두지 않거나**, 토큰을 비우면 됩니다.

## 5. 모바일/PWA 메뉴·권한

좁은 화면(가로 **700px 이하**)에서는 상단 탭이 **대시보드·운송중 재고**만 보입니다.  
**운송중 입고 처리**를 쓰려면 해당 계정에 `transit` 메뉴 권한이 있어야 합니다(예: Manager, 또는 사용자 관리에서 `transit` 허용).

## 6. 보안 참고

현재 구조는 **공유 토큰**만으로 API를 보호합니다.  
인터넷에 공개된 배포 URL이라면 토큰 유출 시 데이터가 노출·변조될 수 있으므로, 필요 시 Vercel의 접근 제한·VPN·추후 Supabase Auth 등으로 강화하세요.
