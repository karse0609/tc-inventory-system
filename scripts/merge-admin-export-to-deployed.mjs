/**
 * Admin PC에서보낸 JSON(전체 envelope)을 `src/data/deployed-inventory-snapshot.json`에 반영합니다.
 * `deployedRevision`은 기존 파일 값보다 1 큰 값으로 자동 설정합니다(다른 PC·test의 localStorage가 번들 스냅샷으로 덮어쓰이도록).
 *
 * 사용법:
 *   npm run merge:deployed-snapshot -- path/to/tc-inv-backup-xxxx.json
 *   npx vite-node scripts/merge-admin-export-to-deployed.mjs path/to/backup.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseAppDataImport } from '../src/utils/appDataBackup.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const snapshotPath = join(root, 'src', 'data', 'deployed-inventory-snapshot.json')

const adminPath = process.argv[2]
if (!adminPath) {
  console.error('Usage: npm run merge:deployed-snapshot -- <admin-export.json>')
  process.exit(1)
}

let raw
try {
  raw = JSON.parse(readFileSync(adminPath, 'utf8'))
} catch (e) {
  console.error('Failed to read or parse JSON:', adminPath, e?.message || e)
  process.exit(1)
}

const payload = raw?.payload != null && typeof raw.payload === 'object' ? raw.payload : null
if (!payload) {
  console.error('Admin export must contain a top-level "payload" object.')
  process.exit(1)
}

const wrapped = {
  tcInvExportVersion: raw.tcInvExportVersion ?? 1,
  payload,
}
const result = parseAppDataImport(wrapped)
if ('error' in result && result.error) {
  console.error('Backup does not pass parseAppDataImport:', result.error)
  process.exit(1)
}

let prevRev = 0
try {
  const prev = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  prevRev = Number(prev.deployedRevision)
  if (!Number.isFinite(prevRev) || prevRev < 0) prevRev = 0
} catch {
  /* no existing file */
}

const nextRev = prevRev + 1

const out = {
  tcInvExportVersion: wrapped.tcInvExportVersion,
  deployedRevision: nextRev,
  exportedAt: new Date().toISOString(),
  app: typeof raw.app === 'string' ? raw.app : 'tc-inventory-system',
  payload,
}

writeFileSync(snapshotPath, JSON.stringify(out, null, 2), 'utf8')
console.log('OK:', snapshotPath)
console.log('  deployedRevision:', prevRev, '→', nextRev)
console.log('  (Commit this file and redeploy so all browsers apply the new snapshot on next load.)')
