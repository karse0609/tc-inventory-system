import snapshot from '../data/deployed-inventory-snapshot.json'
import { parseAppDataImport, persistInventoryPatchToLocalStorage } from './appDataBackup'
import { inventoryRemoteSyncEnabled } from './inventoryRemoteSync'

const LS_REVISION_KEY = 'tc-inv-deployed-revision-applied'
const LS_EXPORTED_AT_KEY = 'tc-inv-deployed-snapshot-exported-at'
export const DEPLOYED_SNAPSHOT_APPLIED_NOTICE_KEY = 'tc-inv-deployed-snapshot-applied-notice'

function readLocalAppliedMeta() {
  let revision = 0
  let exportedAt = ''
  try {
    revision = Number(localStorage.getItem(LS_REVISION_KEY) || '0')
    if (!Number.isFinite(revision)) revision = 0
    exportedAt = String(localStorage.getItem(LS_EXPORTED_AT_KEY) || '')
  } catch {
    /* ignore */
  }
  return { revision, exportedAt }
}

function readSnapshotMeta() {
  const revision = Number(snapshot?.deployedRevision ?? 0)
  const exportedAt = typeof snapshot?.exportedAt === 'string' ? snapshot.exportedAt : ''
  return {
    revision: Number.isFinite(revision) && revision >= 1 ? revision : 0,
    exportedAt,
  }
}

/** @returns {boolean} 번들 스냅샷이 localStorage에 기록된 적용 시점보다 최신인지 */
function isSnapshotNewer(target, applied) {
  if (target.revision > 0) {
    if (applied.revision > 0 && applied.revision > target.revision) return false
    if (target.revision > applied.revision) return true
  }

  const targetMs = target.exportedAt ? Date.parse(target.exportedAt) : NaN
  const appliedMs = applied.exportedAt ? Date.parse(applied.exportedAt) : NaN
  if (Number.isFinite(targetMs)) {
    if (!Number.isFinite(appliedMs)) return true
    return targetMs > appliedMs
  }

  return false
}

function writeLocalAppliedMeta(target) {
  try {
    if (target.revision > 0) {
      localStorage.setItem(LS_REVISION_KEY, String(target.revision))
    }
    if (target.exportedAt) {
      localStorage.setItem(LS_EXPORTED_AT_KEY, target.exportedAt)
    }
  } catch {
    /* ignore quota */
  }
}

/**
 * 배포에 포함된 `deployed-inventory-snapshot.json`이 localStorage보다 최신이면
 * 재고 관련 키를 덮어씁니다. (사용자·세션 키는 건드리지 않음)
 * Redis 없이 모든 클라이언트가 동일 스냅샷을 보게 할 때 사용합니다.
 * @returns {{ applied: boolean }}
 */
export function applyDeployedInventorySnapshotIfNeeded() {
  if (typeof window === 'undefined') return { applied: false }
  /** 서버 JSON 동기화가 켜져 있으면 서버 GET이 단일 소스 — 번들 스냅샷으로 로컬을 덮어쓰지 않음 */
  if (inventoryRemoteSyncEnabled()) return { applied: false }
  if (import.meta.env.VITE_SKIP_DEPLOYED_SNAPSHOT === 'true') return { applied: false }

  const target = readSnapshotMeta()
  const applied = readLocalAppliedMeta()
  if (!target.revision && !target.exportedAt) return { applied: false }
  if (!isSnapshotNewer(target, applied)) return { applied: false }

  const wrapped = {
    tcInvExportVersion: snapshot.tcInvExportVersion,
    payload: snapshot.payload,
  }
  const result = parseAppDataImport(wrapped)
  if ('error' in result && result.error) {
    console.warn('[tc-inv deployed-snapshot] skip:', result.error)
    return { applied: false }
  }

  persistInventoryPatchToLocalStorage(result.patch)
  writeLocalAppliedMeta(target)

  try {
    sessionStorage.setItem(DEPLOYED_SNAPSHOT_APPLIED_NOTICE_KEY, '1')
  } catch {
    /* ignore */
  }

  return { applied: true }
}

/** 부팅 시 스냅샷이 적용됐으면 알림을 한 번만 소비합니다. */
export function consumeDeployedSnapshotAppliedNotice() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(DEPLOYED_SNAPSHOT_APPLIED_NOTICE_KEY) !== '1') return false
    sessionStorage.removeItem(DEPLOYED_SNAPSHOT_APPLIED_NOTICE_KEY)
    return true
  } catch {
    return false
  }
}
