/**
 * 배포용 `src/data/deployed-inventory-snapshot.json` 생성.
 * 현재 시드(샘플)와 동일한 내용으로 맞춘 뒤, Admin이 Settings에서보낸 JSON으로 덮어쓸 수 있습니다.
 * 실행: npm run gen:deployed-snapshot
 */
import { writeFileSync } from 'node:fs'
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

const out = {
  tcInvExportVersion: APP_DATA_EXPORT_VERSION,
  /** 다른 PC에 새 데이터를 밀어 넣을 때마다 1씩 올리세요. */
  deployedRevision: 1,
  exportedAt: new Date().toISOString(),
  app: 'tc-inventory-system',
  payload,
}

const outPath = join(root, 'src', 'data', 'deployed-inventory-snapshot.json')
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', outPath)
