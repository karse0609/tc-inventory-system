# 배포용 재고 스냅샷 (`deployed-inventory-snapshot.json`)

Redis 없이 **배포된 사이트를 여는 모든 PC·모바일**이 같은 재고 데이터를 보려면, Admin PC의 최신 내용을 **JSON으로 뽑아** 저장소의 스냅샷 파일에 넣고 **다시 배포**해야 합니다. 브라우저마다 `localStorage`가 따로라서, 이 절차 없이는 기기별로 예전 데이터가 남습니다.

---

## 1. Admin PC에서 최신 데이터를 JSON으로 추출

### 방법 A (권장): 앱 설정 화면에서보내기

1. **Admin 계정**으로 PC 브라우저에서 앱에 로그인합니다.
2. 화면에서 **설정(Settings)** 으로 이동합니다.
3. **「브라우저 데이터 백업 / 가져오기」** 영역에서 **「JSON보내기」**(라벨: `Export JSON`)를 클릭합니다.
4. 브라우저가 `tc-inv-backup-날짜시간.json` 형태의 파일을 다운로드합니다.  
   이 파일이 **현재 화면에 반영된 상태**(마스터·출고계획·운송중·운영 메타·주간계획·입고 이력 등)를 담은 백업입니다.  
   (앱이 `localStorage`에 저장한 내용과 동일한 스냅샷을 `buildAppDataSnapshot`으로 묶습니다.)

### 방법 B: 개발자 도구에서 직접 보기(비권장)

`tc-inv-*` 키를 수동으로 복사하는 것은 실수하기 쉬우므로, 가능하면 **방법 A**만 사용하세요.

---

## 2. 추출한 JSON과 배포용 파일 형식 맞추기

다운로드한 백업은 대략 다음 모양입니다.

```json
{
  "tcInvExportVersion": 1,
  "exportedAt": "2026-...",
  "app": "tc-inventory-system",
  "payload": {
    "tc-inv-master-items": [ ... ],
    "tc-inv-delivery-plans": { ... },
    ...
  }
}
```

배포 스냅샷 파일 `src/data/deployed-inventory-snapshot.json`에는 **위와 같은 필드에 더해** 아래가 필요합니다.

| 필드 | 설명 |
|------|------|
| `tcInvExportVersion` | 백업 파일과 **동일**하게 두면 됩니다. |
| `payload` | 백업의 **`payload` 객체 전체**를 그대로 쓰거나, 필요한 키만 골라 넣습니다. |
| `deployedRevision` | **정수**. 이전 배포보다 **반드시 크게** 올려야 다른 기기가 새 데이터를 덮어씁니다. |
| `exportedAt` | 사람이 읽기 위한 타임스탬프(ISO 문자열) 권장. |
| `app` | `"tc-inventory-system"` 권장. |

### 사용자(`tc-inv-users`)를 넣을지

- **재고·계획만** 모든 기기에 맞추고, 계정은 기기마다 두고 싶다면: `payload`에서 **`tc-inv-users` 키를 삭제**한 뒤 스냅샷에 넣습니다. (배포 시 부트스트랩은 `users`가 없으면 계정 저장소를 건드리지 않습니다.)
- **사용자 목록·권한까지** 동일하게 맞추려면: 백업의 `payload`에 포함된 **`tc-inv-users`를 그대로** 둡니다.

---

## 3. `deployed-inventory-snapshot.json`에 반영하는 절차

1. 저장소에서 `src/data/deployed-inventory-snapshot.json`을 엽니다.
2. Admin에서 받은 백업 JSON을 에디터로 엽니다.
3. 배포 파일을 다음처럼 맞춥니다.
   - `tcInvExportVersion` ← 백업과 동일
   - `payload` ← 백업의 `payload` 전체(또는 재고 관련 키만)로 **교체**
   - `deployedRevision` ← **이전 값보다 1 이상 증가** (예: 3 → 4)
   - `exportedAt` ← 필요 시 현재 시각으로 갱신
   - `app` ← `"tc-inventory-system"` 유지
4. JSON 문법 오류가 없는지 저장합니다. (쉼표·중괄호 확인)

> **참고:** 시드와 동일한 “빈 템플릿”만 다시 만들고 싶을 때는  
> `npm run gen:deployed-snapshot`  
> 으로 파일을 재생성한 뒤, `payload`만 Admin 백업으로 바꾸고 `deployedRevision`만 올리면 됩니다.

---

## 4. 배포 후 다른 PC·모바일에서 어떻게 갱신되는지

1. `npm run build` 후 호스팅에 **새 정적 파일**을 올립니다.
2. 사용자가 **새 버전의 앱**(JS 번들)을 받으면, 시작 시 `deployedRevision`이  
   브라우저의 `localStorage` 키 `tc-inv-deployed-revision-applied`보다 **크면**  
   스냅샷의 `payload`가 `localStorage`의 재고 관련 키에 **한 번 적용**됩니다.
3. **같은 `deployedRevision`으로 다시 배포하면** 이미 적용된 기기는 다시 덮어쓰지 않으므로, 데이터를 바꿀 때마다 **revision을 꼭 올려야** 합니다.

PWA/캐시를 쓰는 모바일은 **새 배포를 받을 때까지** 예전 번들을 쓸 수 있으므로, 필요하면 브라우저에서 사이트 새로고침·캐시 비우기·앱 업데이트를 안내하세요.

---

## 5. “저장할 때마다 자동으로 JSON 파일 갱신”에 대해

지금 구조에서는 **브라우저만으로는 Git 안의 `deployed-inventory-snapshot.json`을 직접 쓸 수 없습니다.**  
운영 절차는 다음 중 하나입니다.

- **수동(권장, Redis 없음):** 위 1~4단계를 **배포 직전**에 수행합니다.
- **자동화(선택):** CI나 스크립트가 Admin이 올린 백업 파일을 받아 `deployed-inventory-snapshot.json`을 갱신하고 빌드·배포하도록 파이프라인을 만듭니다. (별도 구현)

---

## 로컬 개발 시 스냅샷 끄기

로컬에서 번들에 포함된 스냅샷을 적용하지 않으려면 `.env.local`에 다음을 넣습니다.

```bash
VITE_SKIP_DEPLOYED_SNAPSHOT=true
```

## 시드와 동일한 스냅샷만 재생성

```bash
npm run gen:deployed-snapshot
```
