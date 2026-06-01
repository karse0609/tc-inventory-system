import snapshot from '../data/deployed-inventory-snapshot.json'
import { parseAppDataImport, persistInventoryPatchToLocalStorage } from './appDataBackup'
import { inventoryRemoteSyncEnabled } from './inventoryRemoteSync'

const LS_KEY = 'tc-inv-deployed-revision-applied'

/**
 * 배포에 포함된 `deployed-inventory-snapshot.json`이 localStorage보다 최신이면
 * 재고 관련 키를 덮어씁니다. (사용자·세션 키는 건드리지 않음)
 * Redis 없이 모든 클라이언트가 동일 스냅샷을 보게 할 때 사용합니다.
 */
export function applyDeployedInventorySnapshotIfNeeded() {
  if (typeof window === 'undefined') return
  /** 서버 JSON 동기화가 켜져 있으면 서버 GET이 단일 소스 — 번들 스냅샷으로 로컬을 덮어쓰지 않음 */
  if (inventoryRemoteSyncEnabled()) return
  if (import.meta.env.VITE_SKIP_DEPLOYED_SNAPSHOT === 'true') return

  const target = Number(snapshot?.deployedRevision ?? 1)
  if (!Number.isFinite(target) || target < 1) return

  let applied = 0
  try {
    applied = Number(localStorage.getItem(LS_KEY) || '0')
  } catch {
    /* ignore */
  }
  if (applied >= target) return

  const wrapped = {
    tcInvExportVersion: snapshot.tcInvExportVersion,
    payload: snapshot.payload,
  }
  const result = parseAppDataImport(wrapped)
  if ('error' in result && result.error) {
    console.warn('[tc-inv deployed-snapshot] skip:', result.error)
    return
  }
  persistInventoryPatchToLocalStorage(result.patch)
  try {
    localStorage.setItem(LS_KEY, String(target))
  } catch {
    /* ignore quota */
  }
}
