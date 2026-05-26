/**
 * 다품목 확장용 제품 카탈로그 (Multi-SKU)
 * modelName + Excel 시트명 매핑
 */

export const PILOT_MODEL_NAME = 'GS1930E'

/** 대시보드 모델 셀렉터 «전체» — `filterByModel` 등과 동일한 값으로 사용 */
export const ALL_MODELS_VALUE = '__ALL_MODELS__'

/** @typedef {{ modelName: string, sheetName: string, displayName: string, pilot: boolean, enabled: boolean, safetyStock?: number }} ProductConfig */

/** @type {ProductConfig[]} */
export const PRODUCT_CATALOG = [
  {
    modelName: 'GS1930E',
    sheetName: 'GS1930E',
    displayName: 'GS1930E',
    pilot: true,
    enabled: true,
    safetyStock: 8_000,
  },
  {
    modelName: 'S45XC',
    sheetName: 'S45XC',
    displayName: 'S45XC',
    pilot: false,
    enabled: true,
    safetyStock: 5_000,
  },
  {
    modelName: 'S85XC',
    sheetName: 'S85XC',
    displayName: 'S85XC',
    pilot: false,
    enabled: true,
    safetyStock: 6_000,
  },
  {
    modelName: 'GS30E',
    sheetName: 'GS30E',
    displayName: 'GS30E',
    pilot: false,
    enabled: false,
    safetyStock: 8_000,
  },
]

export function getProduct(modelName) {
  return PRODUCT_CATALOG.find((p) => p.modelName === modelName) ?? null
}

export function getPilotProduct() {
  return (
    PRODUCT_CATALOG.find((p) => p.pilot && p.enabled) ??
    PRODUCT_CATALOG.find((p) => p.enabled) ??
    PRODUCT_CATALOG[0]
  )
}

export function getEnabledProducts() {
  return PRODUCT_CATALOG.filter((p) => p.enabled)
}

/** Excel 파서용 시트명 */
export function getExcelSheetName(modelName = PILOT_MODEL_NAME) {
  return getProduct(modelName)?.sheetName ?? modelName
}
