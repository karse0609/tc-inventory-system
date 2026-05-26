/** 주요 UI 용어 — 한국어 + English 병기 */

export const L = {
  excelPasteFrom: { ko: 'Excel에서 붙여넣기', en: 'Paste from Excel' },
  excelCopyTo: { ko: 'Excel로 복사', en: 'Copy to Excel' },
  excelClearSelected: { ko: '선택 행 지우기', en: 'Clear Selected Rows' },
  excelRowsSelected: { ko: '행 선택됨', en: 'rows selected' },
  excelClipboardEmpty: {
    ko: '클립보드가 비어 있거나 읽을 수 없습니다.',
    en: 'Clipboard is empty or unreadable.',
  },
  excelPasteDone: {
    ko: '붙여넣기를 반영했습니다. 검증 메시지를 확인하세요.',
    en: 'Paste applied. Check validation messages.',
  },
  excelCopyDone: {
    ko: '클립보드에 복사했습니다.',
    en: 'Copied to clipboard.',
  },
  excelReadonlyGrid: {
    ko: '이 표는 계산 결과만 표시됩니다. 복사만 가능합니다.',
    en: 'This grid is read-only; copy only.',
  },

  pilotItem: { ko: 'Pilot 품목', en: 'Pilot Item' },
  dashboardModelAll: { ko: '전체', en: 'All' },
  dashboardWeekEtaWhCol: { ko: 'ETA 창고', en: 'ETA W/H' },
  dashboardWeekEtaDesc: {
    ko:
      '기준일 기준: ETA Port가 기준일 이전인 미입고(지연)와, 기준일 다음~7일 이내 도착 예정인 행만 표시합니다. Port ETA가 없으면 제외됩니다.',
    en:
      'As-of: overdue (Port ETA on/before as-of, not received) plus Port ETA within the next 7 days. Rows without Port ETA are omitted.',
  },
  dashboardWeekEtaEmpty: {
    ko: '조건에 해당하는 도착 예정 컨테이너가 없습니다.',
    en: 'No containers match the arrival window.',
  },
  asOfDate: { ko: '기준일', en: 'As-of Date' },
  opsQueryDateKst: {
    ko: '조회 기준일(KST)',
    en: 'Query date (KST)',
  },
  dashboardSeattleTime: { ko: 'Seattle Time', en: 'Seattle Time' },
  dashboardKoreaTime: { ko: 'Korea Time (KST)', en: 'Korea Time (KST)' },
  dashboardAsOfSeattleLine: { ko: '기준일(Seattle)', en: 'As-of date (Seattle)' },
  dashboardAsOfKstLine: { ko: '한국시간(KST)', en: 'Korea time (KST)' },
  dashboardAsOfLedgerHint: {
    ko:
      '과거 기준일 창고 재고는 입고 확정(운송중 저장) 시 쌓이는 이력으로 역산합니다. 이력이 없으면 출고 계획만 반영해 근사합니다.',
    en:
      'Past as-of warehouse stock is derived from receipt history when you save in-transit arrivals. Without history, only delivery-plan outbounds adjust the estimate.',
  },
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
    ko: '4주 이상 안정 · 3~4주 주의 · 3주 미만 위험',
    en: '4w+ stable · 3–4w caution · <3w critical',
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
    ko: '시뮬레이션·차트·이력 (출고는 출고 계획 화면에서 수기 입력)',
    en: 'Simulation · chart · history (outbound: manual in Delivery Plan)',
  },
  weeklyDemandTotal: { ko: '주간 수요 합', en: 'Weekly Demand (Σ)' },

  multiItemNote: {
    ko: '선택 모델 기준 · 창고 + 운송중 + 납품 계획 (Multi-SKU)',
    en: 'Per selected model · warehouse + in-transit + delivery plan (Multi-SKU)',
  },

  excelUpload: { ko: 'Excel 업로드', en: 'Excel Upload' },
  restoreSample: { ko: '샘플 복원', en: 'Restore Sample' },

  containers: { ko: '컨테이너', en: 'containers' },
  weeks: { ko: '주', en: 'weeks' },

  /** 공통 버튼 */
  actionCancel: { ko: '취소', en: 'Cancel' },
  actionDelete: { ko: '삭제', en: 'Delete' },

  /** Delivery Plan 화면 — 출고 계획 */
  deliveryPlanScreenTitle: { ko: '출고 계획', en: 'Delivery Plan' },
  deliveryPlanScreenSubtitle: {
    ko: '주차별 출고 수량 수기 입력(품목별)',
    en: 'Manual weekly outbound qty per SKU',
  },
  deliveryPlanPageDesc: {
    ko:
      '기준일 기준 주차(열) × 품목(행) 그리드에 주차별 출고(납품) 수량을 입력합니다. 데이터는 브라우저에 저장되며, 재고 예측은 여기서 입력한 주간 출고와 운송중 입고·창고 재고를 함께 반영합니다.',
    en:
      'Grid: parts × calendar weeks from as-of date. Weekly outbound qty per cell; stored in the browser. Inventory Projection combines this with warehouse stock and timed in-transit arrivals.',
  },
  previousWeeksShown: { ko: '이전 주(표시)', en: 'Past weeks (shown)' },
  futureWeeksShown: { ko: '이후 주(표시)', en: 'Future weeks (shown)' },
  previous12Weeks: { ko: '이전 12주', en: 'Previous 12 weeks' },
  next12Weeks: { ko: '다음 12주', en: 'Next 12 weeks' },
  currentBaseline: { ko: '현재 기준으로', en: 'Current baseline' },
  addSkuRow: { ko: '행 추가', en: 'Add row' },
  save: { ko: '저장', en: 'Save' },
  savedToBrowserStorage: {
    ko: '브라우저 저장소에 저장되었습니다.',
    en: 'Saved to browser storage.',
  },
  columnsCount: { ko: '열', en: 'Columns' },
  viewOffsetWeeks: { ko: '뷰 오프셋', en: 'View offset' },
  deliveryPlanWeeklyQty: { ko: '주간 수량', en: 'Weekly qty' },
  deletePartPlansConfirm: {
    ko: '해당 품번의 주차별 납품계획이 모두 삭제됩니다. 계속 진행하시겠습니까?',
    en: 'All weekly delivery plan data for this part will be deleted. Do you want to continue?',
  },
  deletePartPlansTitle: { ko: '납품 계획 삭제', en: 'Delete delivery plan' },

  /** 화면 제목 */
  warehouseInventoryScreen: { ko: '창고 재고', en: 'Warehouse Inventory' },
  warehouseInventorySubtitle: {
    ko: '해외창고 재고 — 품목별 현재재고·커버리지(주)·주간 수요·안전·리드타임 등 운영 정보만 관리합니다.',
    en: 'Warehouse ops only: stock, coverage weeks, weekly demand, safety, lead time (no unit cost on this screen).',
  },
  inTransitInventoryScreen: { ko: '운송중 재고', en: 'In-Transit Inventory' },
  inTransitSubtitle: {
    ko: 'ETA·컨테이너·품목별 수량. 입고완료 후 저장하면 해외창고 재고에 반영됩니다. 재고 금액은 대시보드에서만 요약 표시됩니다.',
    en: 'ETA, container, qty per SKU. Save after receipt to update warehouse stock. Inventory values are summarized on the Dashboard only.',
  },
  inTransitDeleteConfirm: {
    ko: '정말 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.',
    en: 'Are you sure you want to delete? This cannot be undone.',
  },
  inventoryProjectionScreen: { ko: '재고 예측', en: 'Inventory Projection' },
  inventoryProjectionSubtitle: {
    ko:
      '주차별로 창고 재고에 운송중 입고(ETA 주)를 더하고 출고 계획을 뺀 예상 재고와 주수(커버리지)를 봅니다. 안전재고 주수와 리드타임(일→주)으로 안정·주의·위험을 표시합니다.',
    en:
      'Per week: warehouse + in-transit arrivals by ETA − outbound from Delivery Plan; coverage weeks. Status uses safety weeks + lead time.',
  },
  settingsScreen: { ko: '설정', en: 'Settings' },
  settingsSubtitle: {
    ko:
      '기준일·표시 단위·대시보드 문구 등 운영 설정입니다. 대당 원가(KRW)는 관리자만 이 화면에서 입력합니다. 창고 재고 화면에서는 수량·리드타임·안전재고·주간 수요만 다룹니다.',
    en:
      'Ops settings and dashboard copy. Unit cost (KRW) per SKU is editable here for Admins only. Warehouse Inventory holds qty, lead time, safety, and weekly demand.',
  },
  settingsUnitCostTitle: { ko: '대당 원가 (KRW)', en: 'Unit cost (KRW)' },
  settingsUnitCostHint: {
    ko:
      'Model·Part No별 대당 원가는 관리자만 이 화면에서 입력합니다. 일반 메뉴에는 원가가 노출되지 않으며, 대시보드에는 SKU별 단가 없이 합계 금액만 표시됩니다.',
    en:
      'Admins edit per-SKU unit cost (KRW) here only. Other screens hide cost; the dashboard shows aggregate KRW totals without per-line rates.',
  },
  settingsUnitCostColKrw: { ko: '대당 원가(KRW)', en: 'Unit cost (KRW)' },
  settingsUnitCostEmpty: {
    ko: '창고 재고에 활성 Model·Part가 없습니다. 먼저 품목을 등록하세요.',
    en: 'No active SKUs. Add rows on Warehouse Inventory first.',
  },
  colUnitPrice: { ko: '단가', en: 'Unit Price' },
  warehousePipelineAbbr: { ko: '운송중', en: 'In-transit' },
  openWarehouseInventory: { ko: '창고 재고 화면으로', en: 'Open Warehouse Inventory' },
  projectionLegendShort: {
    ko: 'Inv: 전주 예상 + 해당주 ETA 입고 − 출고계획 · Cov: 예상 ÷ max(출고계획, 주간수요) · Gap: 예상 − 안전재고수량',
    en: 'Inv: prior + ETA arrivals − outbound · Cov: projected ÷ max(plan, weekly demand) · Gap: vs safety qty',
  },
  projectionStatusLabels: {
    critical: { ko: '위험', en: 'Critical' },
    warning: { ko: '주의', en: 'Warning' },
    stable: { ko: '안정', en: 'Stable' },
    na: { ko: '해당없음', en: 'N/A' },
  },

  /** Dashboard 상단 KPI */
  dashboardWarehouseQty: { ko: '창고 재고 수량', en: 'Warehouse stock qty' },
  dashboardWarehouseValue: { ko: '창고 재고 금액', en: 'Warehouse stock value' },
  dashboardInTransitQty: { ko: '운송중 재고 수량', en: 'In-transit stock qty' },
  dashboardInTransitValue: { ko: '운송중 재고 금액', en: 'In-transit stock value' },
  dashboardThisWeekEtaQty: { ko: '이번주 ETA 수량', en: 'This week ETA qty' },
  dashboardDelayContainers: { ko: '지연 컨테이너', en: 'Delay containers' },
  delayOverdue: { ko: '지연', en: 'Overdue' },
  inventoryByPart: { ko: '품번별 재고 현황', en: 'Inventory by part' },
  weeklyDeliveryQty: { ko: '주간 납품', en: 'Weekly delivery' },
}

/** 앱 상단 메뉴 — Dashboard · Warehouse · In-Transit · Delivery Plan · Inventory Projection · Settings */
export const VIEW_LABELS = {
  dashboard: { ko: '대시보드', en: 'Dashboard' },
  master: L.warehouseInventoryScreen,
  transit: L.inTransitInventoryScreen,
  delivery: L.deliveryPlanScreenTitle,
  projection: L.inventoryProjectionScreen,
  settings: L.settingsScreen,
}

/** 한글(English) 단일 문자열 — 버튼·짧은 메뉴 등 */
export function formatKoEn(label) {
  if (!label?.ko) return ''
  return label.en ? `${label.ko}(${label.en})` : label.ko
}
