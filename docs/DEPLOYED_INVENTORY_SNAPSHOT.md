# 배포 스냅샷(`deployed-inventory-snapshot.json`) — 다른 PC·test와 데이터 맞추기

Admin PC의 **JSON 보내기** 결과를 정본으로 두고, 저장소의 `src/data/deployed-inventory-snapshot.json`에 넣어 빌드·배포하면  
**클라우드 동기(Redis) 없이** 다른 브라우저·다른 PC·test 계정도 **동일 재고 데이터**로 시작(또는 갱신)할 수 있습니다.

## 동작 요약

1. 앱 부팅 시 `src/main.jsx`에서 `applyDeployedInventorySnapshotIfNeeded()`가 실행됩니다.
2. `localStorage`의 `tc-inv-deployed-revision-applied` 값이 **`deployed-inventory-snapshot.json`의 `deployedRevision`보다 작으면**, 번들에 포함된 `payload`로 재고 관련 키를 덮어씁니다.
3. **`VITE_INVENTORY_REMOTE_SYNC=true`** 등으로 **클라우드 동기가 켜진 빌드**에서는 이 스냅샷을 적용하지 않습니다(서버 스냅샷 우선).
4. **`VITE_SKIP_DEPLOYED_SNAPSHOT=true`** 이면 스냅샷 적용을 건너뜁니다.

test·일반 PC 모두 위 규칙이 동일합니다. **Admin만** 설정에서 JSON을보내고, 아래 절차로 배포 파일을 갱신하세요.

---

## 1. Admin에서 JSON보내기

1. Admin 계정으로 로그인 → **설정**.
2. **JSON보내기 / Export JSON**으로 `tc-inv-backup-….json` 파일을 저장합니다.
3. 파일 최상위는 대략 다음 형태여야 합니다.  
   - `tcInvExportVersion`  
   - `payload` (마스터·계획·운송·ops·원가 맵 등 `tc-inv-*` 키들)

---

## 2. 배포 스냅샷 파일에 반영(권장: 스크립트)

저장소 루트에서 Admin이 저장한 파일 경로를 넘깁니다.

```bash
npm run merge:deployed-snapshot -- "C:\path\to\tc-inv-backup-2026-....json"
```

스크립트가 하는 일:

- `payload`를 읽어 `parseAppDataImport`와 동일한 검증을 합니다(버전·키 오류 시 종료).
- 기존 `src/data/deployed-inventory-snapshot.json`의 **`deployedRevision`을 1 증가**시킵니다.
- `exportedAt`을 현재 시각으로 갱신하고, `src/data/deployed-inventory-snapshot.json`을 덮어씁니다.

그다음 **Git에 커밋**하고 **Vercel 등에 재배포**합니다.  
배포 후 사용자가 사이트를 열면(또는 강력 새로고침), `deployedRevision`이 올라간 경우 **오래된 localStorage도** 번들 스냅샷으로 맞춰집니다.

---

## 3. 수동으로 편집할 때(참고)

스크립트 없이 할 경우:

1. Admin JSON에서 **`payload` 객체 전체**를 복사합니다.
2. `src/data/deployed-inventory-snapshot.json`을 열고 **`payload`를 그 내용으로 교체**합니다.
3. **`deployedRevision`을 반드시 이전보다 큰 정수로** 올립니다(예: `3` → `4`).  
   - 올리지 않으면 이미 적용된 PC는 **덮어쓰기를 하지 않습니다**.
4. 필요 시 `exportedAt`을 ISO 시각 문자열로 맞춥니다.
5. `tcInvExportVersion`은 앱이 지원하는 버전과 일치해야 합니다(현재 `1`).

---

## 4. 시드만 다시 만들 때(Admin보내기 없음)

샘플·시드만으로 배포 파일을 초기화할 때:

```bash
npm run gen:deployed-snapshot
```

이 명령은 `deployedRevision`을 스크립트 안의 기본값(현재 `1`)으로 **덮어쓰므로**, 운영 중에는 **`merge:deployed-snapshot`** 으로 Admin 정본을 반영하는 편이 안전합니다.

---

## 5. 다른 PC에 여전히 옛 데이터가 보일 때

- 배포된 JS에 **새 `deployedRevision`**이 포함됐는지(최신 배포·캐시 무효) 확인합니다.
- 브라우저 **강력 새로고침** 또는 시크릿 창으로 확인합니다.
- `VITE_SKIP_DEPLOYED_SNAPSHOT` / 클라우드 동기 플래그가 켜져 있지 않은지 확인합니다.
