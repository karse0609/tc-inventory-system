# 배포용 재고 스냅샷 (JSON)

모든 브라우저는 기본적으로 **localStorage**에 재고를 둡니다. PC Admin에서만 수정한 내용이 다른 기기에 자동으로 올라가지 않으면, 각 기기는 예전 시드·예전 localStorage를 보게 됩니다.

## 동작

1. 빌드에 `src/data/deployed-inventory-snapshot.json`이 포함됩니다.
2. 앱 시작 시 `deployedRevision`이 `localStorage`의 `tc-inv-deployed-revision-applied`보다 크면, 스냅샷의 **재고 관련 payload**를 `parseAppDataImport` → `persistInventoryPatchToLocalStorage`로 반영합니다. (사용자 계정은 스냅샷에 없으면 그대로 둡니다.)
3. **새 데이터를 배포할 때마다** `deployedRevision`을 **반드시 1 이상 올리세요.** 같은 revision이면 기존 기기는 덮어쓰지 않습니다.

## Admin 워크플로 (권장)

1. PC Admin에서 Settings(또는 데이터보내기)로 **현재 전체 백업 JSON**을보냅니다.
2. `src/data/deployed-inventory-snapshot.json`을 열고,보낸 JSON의 `tcInvExportVersion`·`payload`에 맞춰 갱신합니다. (또는 `npm run gen:deployed-snapshot`으로 시드와 동일한 기준 파일을 만든 뒤 `payload`만 교체.)
3. `deployedRevision`을 이전보다 크게 설정합니다.
4. 커밋 후 배포합니다.

## 로컬 개발

번들 스냅샷을 적용하지 않으려면 `.env.local`에 다음을 넣습니다.

```bash
VITE_SKIP_DEPLOYED_SNAPSHOT=true
```

## 스냅샷 재생성 (시드와 동일 내용)

```bash
npm run gen:deployed-snapshot
```

Vite와 동일한 모듈 해석을 위해 `vite-node`를 사용합니다.
