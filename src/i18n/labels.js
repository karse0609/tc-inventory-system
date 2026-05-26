/** 주요 UI 용어 — 한국어 + English 병기 */

export const L = {
  pilotItem: { ko: 'Pilot 품목', en: 'Pilot Item' },
  asOfDate: { ko: '기준일', en: 'As-of Date' },
  timezone: { ko: '기준 시간대', en: 'Timezone' },
  modelTotal: { ko: '모델 전 Part 합', en: 'All parts (model)' },

  // Logistics dashboard
  todayStatus: { ko: '오늘 현황', en: 'TODAY STATUS' },
  todayShipment: { ko: '오늘 TC 출발', en: 'Today Shipment' },
  inTransitContainers: { ko: '운송중 컨테이너', en: 'In Transit Containers' },
  thisWeekEta: { ko: '이번주 도착 예정', en: 'This Week ETA' },
  thisWeekDelivery: { ko: '이번주 납품', en: 'This Week Delivery' },
  currentInventory: { ko: '현재재고', en: 'Current Inventory' },
  coverageWeeks: { ko: '커버리지', en: 'Coverage Weeks' },

  inTransitTable: { ko: '운송중 현황', en: 'IN TRANSIT TABLE' },
  model: { ko: '모델', en: 'Model' },
  containerNo: { ko: '컨테이너 No', en: 'Container No' },
  partNo: { ko: '부품번호', en: 'Part No' },
  qty: { ko: '수량', en: 'Qty' },
  etdTcTech: { ko: 'ETD TC TECH', en: 'ETD TC TECH' },
  etdPort: { ko: 'ETD Port', en: 'ETD Port' },
  etaPort: { ko: 'ETA Port', en: 'ETA Port' },
  etaWh: { ko: 'ETA W/H', en: 'ETA W/H' },
  deliveryLocation: { ko: '배송지', en: 'Delivery Location' },
  remark: { ko: '비고', en: 'Remark' },
  arrived: { ko: '입고', en: 'Arrived' },
  forwarder: { ko: '포워더', en: 'Forwarder' },
  hbl: { ko: 'HBL', en: 'HBL' },
  tcTechNo: { ko: 'TC TECH No.', en: 'TC TECH No.' },
  status: { ko: '상태', en: 'Status' },

  thisWeekEtaSection: { ko: '이번주 도착 예정', en: 'THIS WEEK ETA' },
  delayWarning: { ko: '비고 있음', en: 'Note' },
  onTime: { ko: '정상', en: 'On Time' },

  deliveryPlan: { ko: '납품 계획', en: 'DELIVERY PLAN' },
  fromItemPlans: { ko: 'Part별 집계', en: 'Aggregated from item plans' },
  plannedQty: { ko: '계획 수량', en: 'Planned Qty' },
  confirmedQty: { ko: '확정 수량', en: 'Confirmed Qty' },
  week: { ko: '주차', en: 'Week' },

  inventoryStatus: { ko: '재고 현황', en: 'INVENTORY STATUS' },
  planBasedCoverage: { ko: '납품계획 기준', en: 'vs Delivery Plan' },
  demandBasedCoverage: {
    ko: '재고 ÷ 주간 수요',
    en: 'Stock ÷ Weekly Demand',
  },
  plannedDelivery: { ko: '계획 납품', en: 'Planned Delivery' },
  confirmedDelivery: { ko: '확정 납품', en: 'Confirmed Delivery' },
  weeklyDemandShort: { ko: '주간 수요', en: 'Weekly Demand' },
  inventoryValue: { ko: '재고 금액', en: 'Inventory Value' },
  minManagementWeeks: { ko: '최소 관리 기준', en: 'Min. Target' },
  coverageLegend: {
    ko: '2주 미만 위험 · 2~4주 주의 · 4주+ 안정',
    en: '<2w Critical · 2–4w Warning · 4w+ Stable',
  },
  description: { ko: '품명', en: 'Description' },
  currentStock: { ko: '현재재고', en: 'Current Stock' },
  weeklyDemand: { ko: '주간 수요', en: 'Weekly Demand' },
  gap: { ko: '부족분', en: 'Gap' },
  safetyStock: { ko: '안전재고(4주)', en: 'Safety Stock (4wk)' },
  safetyStockPerMaster: {
    ko: '안전재고 = 주간 수요 × Master의 Safety 주차',
    en: 'Safety stock = Weekly demand × safety weeks (Master Data)',
  },
  warehouseInventoryValue: { ko: '창고 재고 금액', en: 'Warehouse Inventory Value' },
  inTransitInventoryValue: { ko: '운송중 재고 금액', en: 'In-Transit Inventory Value' },
  totalInventoryValue: { ko: '전체 재고 금액', en: 'Total Inventory Value' },

  inventoryTrend: { ko: '재고 추이', en: 'Inventory Trend' },
  weekEndInventory: { ko: '주말재고', en: 'Week-end Inventory' },
  formula: {
    ko: '재고[n] = 재고[n−1] + OEI입고 − 주간출고 + NCI',
    en: 'Inv[n] = Inv[n−1] + OEI In − Weekly Del. + NCI',
  },

  rawData: { ko: '주차별 상세 Raw Data', en: 'Weekly Raw Data' },
  showRawData: { ko: '상세 데이터 펼치기', en: 'Show raw data' },
  hideRawData: { ko: '상세 데이터 접기', en: 'Hide raw data' },
  showDataManagement: { ko: 'Data Management 펼치기', en: 'Expand Data Management' },
  hideDataManagement: { ko: 'Data Management 접기', en: 'Collapse Data Management' },
  dataManagementHint: {
    ko: '시뮬레이션·차트·이력 (Excel은 Forecast Upload)',
    en: 'Simulation · chart · history (Excel: Forecast Upload)',
  },
  weeklyDemandTotal: { ko: '주간 수요 합', en: 'Weekly Demand (Σ)' },

  multiItemNote: {
    ko: 'Master Data + Delivery Plan 기준 · Multi-SKU (model + part)',
    en: 'Driven by Master Data + Delivery Plan · Multi-SKU (model + part)',
  },

  excelUpload: { ko: 'Excel 업로드', en: 'Excel Upload' },
  restoreSample: { ko: '샘플 복원', en: 'Restore Sample' },

  containers: { ko: '컨테이너', en: 'containers' },
  weeks: { ko: '주', en: 'weeks' },
}
