/**
 * 배포용 `src/data/deployed-inventory-snapshot.json` 생성(시드 기준 초기화).
 * Admin 정본을 반영하려면: npm run merge:deployed-snapshot -- path/to/admin-backup.json
 * 문서: docs/DEPLOYED_INVENTORY_SNAPSHOT.md
 * 실행: npm run gen:deployed-snapshot
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSeedDeliveryPlans, buildSeedInTransit, buildSeedMasterItems } from '../src/data/seedMasterData.js'
import { operationsMeta as defaultOpsMeta } from '../src/data/logisticsSampleData.js'
import { INITIAL_STARTING_INVENTORY, weeklyPlans as sampleWeeklyPlans } from '../src/data/sampleInventoryData.js'
import { storageKeys } from '../src/utils/appPersistence.js'
import { toPlansStorageValue } from '../src/utils/deliveryPlanModel.js'
import { getKoreaCalendarDate } from '../src/utils/timeZones.js'

const APP_DATA_EXPORT_VERSION = 1

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const masterItems = buildSeedMasterItems()
const deliveryPlans = buildSeedDeliveryPlans()
const inTransit = buildSeedInTransit()
const opsMeta = { ...defaultOpsMeta, asOfDate: getKoreaCalendarDate() }

const payload = {
  [storageKeys.master]: masterItems,
  [storageKeys.plans]: toPlansStorageValue(deliveryPlans, {}),
  [storageKeys.transit]: inTransit,
  [storageKeys.ops]: opsMeta,
  [storageKeys.weekly]: sampleWeeklyPlans,
  [storageKeys.starting]: INITIAL_STARTING_INVENTORY,
  [storageKeys.simSource]: 'sample',
  [storageKeys.unitCostsKrw]: {},
  [storageKeys.arrivalLedger]: [],
  [storageKeys.receiptCancelLedger]: [],
}

const outPath = join(root, 'src', 'data', 'deployed-inventory-snapshot.json')

let deployedRevision = 1
try {
  const prev = JSON.parse(readFileSync(outPath, 'utf8'))
  const r = Number(prev.deployedRevision)
  if (Number.isFinite(r) && r >= 1) deployedRevision = r + 1
} catch {
  /* no existing file */
}

const out = {
  tcInvExportVersion: APP_DATA_EXPORT_VERSION,
  /** 기존 파일이 있으면 자동 +1 (시드 재생성만으로도 다른 PC가 새 스냅샷을 받게 함) */
  deployedRevision,
  exportedAt: new Date().toISOString(),
  app: 'tc-inventory-system',
  payload,
}

writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', outPath)
