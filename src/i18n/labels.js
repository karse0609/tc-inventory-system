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
  excelUpload: { ko: '엑셀 업로드', en: 'Upload Excel' },
  excelDownload: { ko: '엑셀 다운로드', en: 'Download Excel' },
  excelUploadApplied: {
    ko: '엑셀 업로드를 반영했습니다.',
    en: 'Excel upload applied.',
  },
  excelExportDone: {
    ko: '엑셀 파일을 다운로드했습니다.',
    en: 'Excel file downloaded.',
  },
  pageSearchModel: { ko: '모델명', en: 'Model name' },
  pageSearchPartNo: { ko: '부품번호', en: 'Part No' },
  pageSearchDescription: { ko: '품명', en: 'Description' },
  pageSearchUser: { ko: '사용자 검색', en: 'User search' },
  userManagementTitle: { ko: '사용자 관리', en: 'User Management' },
  userManagementHint: {
    ko: '관리자만 접근 가능합니다. 비밀번호는 SHA-256으로 저장됩니다(로컬 전용).',
    en: 'Admins only. Passwords are stored as SHA-256 (local only).',
  },
  userManagementAdd: { ko: '사용자 추가', en: 'Add user' },
  userIdCol: { ko: '사용자 ID', en: 'User ID' },
  passwordCol: { ko: '비밀번호', en: 'Password' },
  nameCol: { ko: '이름', en: 'Name' },
  roleCol: { ko: '역할', en: 'Role' },
  activeCol: { ko: '활성', en: 'Active' },
  menusCol: { ko: '메뉴', en: 'Menus' },
  pageSearchButton: { ko: '검색', en: 'Search' },
  pageSearchReset: { ko: '초기화', en: 'Reset' },

  pilotItem: { ko: 'Pilot 품목', en: 'Pilot Item' },
  dashboardModelAll: { ko: '전체', en: 'All' },
  dashboardWeekEtaWhCol: { ko: 'ETA 창고', en: 'ETA W/H' },
  dashboardWeekEtaDesc: {
    ko: 'Port ETA가 조회 기준일 이전 또는 당일이고, 아직 입고 처리되지 않은 운송중 재고만 표시합니다.',
    en: 'Shows only in-transit rows where Port ETA is on or before the query date and not yet received.',
  },
  dashboardWeekEtaEmpty: {
    ko: '조건에 해당하는 운송중 재고가 없습니다.',
    en: 'No in-transit rows match this view.',
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
  todayStatus: { ko: '오늘 현황', en: 'Today Status' },
  todayShipment: { ko: '오늘 TC 출발', en: 'Today Shipment' },
  inTransitContainers: { ko: '운송중 컨테이너', en: 'In Transit Containers' },
  thisWeekEta: { ko: '이번주 도착 예정', en: 'This Week ETA' },
  thisWeekDelivery: { ko: '이번주 납품', en: 'This Week Delivery' },
  currentInventory: { ko: '현재재고', en: 'Current Inventory' },
  coverageWeeks: { ko: '커버리지', en: 'Coverage Weeks' },

  inTransitTable: { ko: '운송중 현황', en: 'IN TRANSIT TABLE' },
  model: { ko: '모델', en: 'Model' },
  containerNo: { ko: '컨테이너', en: 'Container No' },
  partNo: { ko: '품번', en: 'Part No' },
  qty: { ko: '수량', en: 'Qty' },
  etdTcTech: { ko: 'ETD TC', en: 'ETD TC' },
  etdPort: { ko: 'ETD Port', en: 'ETD Port' },
  etaPort: { ko: 'ETA Port', en: 'ETA Port' },
  etaWh: { ko: 'ETA W/H', en: 'ETA W/H' },
  deliveryLocation: { ko: '배송지', en: 'Location' },
  remark: { ko: '비고', en: 'Remark' },
  arrived: { ko: '입고', en: 'Arrived' },
  forwarder: { ko: '포워더', en: 'Forwarder' },
  hbl: { ko: 'HBL', en: 'HBL' },
  tcTechNo: { ko: 'TC No', en: 'TC No' },
  status: { ko: '상태', en: 'Status' },

  thisWeekEtaSection: { ko: '이번주 도착 예정', en: 'This Week ETA' },
  delayWarning: { ko: '비고 있음', en: 'Note' },
  onTime: { ko: '정상', en: 'On Time' },

  deliveryPlan: { ko: '납품 계획', en: 'DELIVERY PLAN' },
  fromItemPlans: { ko: 'Part별 집계', en: 'Aggregated from item plans' },
  plannedQty: { ko: '계획 수량', en: 'Planned Qty' },
  confirmedQty: { ko: '확정 수량', en: 'Confirmed Qty' },
  week: { ko: '주차', en: 'Week' },

  inventoryStatus: { ko: '재고 현황', en: 'Inventory Status' },
  planBasedCoverage: { ko: '납품계획 기준', en: 'vs Delivery Plan' },
  demandBasedCoverage: {
    ko: '재고 ÷ 주간 수요',
    en: 'Stock ÷ Weekly Demand',
  },
  flowCoverageHeroHint: {
    ko: '현재재고 ÷ 마스터 주간 수요',
    en: 'Current stock ÷ master weekly demand',
  },
  plannedDelivery: { ko: '계획 납품', en: 'Planned Delivery' },
  confirmedDelivery: { ko: '확정 납품', en: 'Confirmed Delivery' },
  weeklyDemandShort: { ko: '주간 수요', en: 'Weekly Demand' },
  inventoryValue: { ko: '재고 금액', en: 'Inventory Value' },
  minManagementWeeks: { ko: '최소 관리 기준', en: 'Min. Target' },
  coverageLegend: {
    ko: '2주 미만 위험 · 2~3주 미만 주의 · 3~6주 미만 안정 · 6주 이상 과잉',
    en: '<2w critical · 2–3w warning · 3–6w stable · 6w+ overstock',
  },
  description: { ko: '품명', en: 'Description' },
  currentStock: { ko: '현재재고', en: 'Current Stock' },
  weeklyDemand: { ko: '주간 수요', en: 'Weekly Demand' },
  safetyStockWeeks: { ko: '안전재고(주)', en: 'Safety (weeks)' },
  leadTimeDays: { ko: '리드타임(일)', en: 'Lead time (days)' },
  warehouseAddItem: { ko: '품목 추가', en: 'Add item' },
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

  dashboardUserGuideTitle: { ko: '사용 안내', en: 'User Guide' },
  dashboardUserGuideBody: {
    ko:
      '이 화면은 모델별 재고 현황을 확인하는 대시보드입니다. 상단 모델 필터를 선택하면 해당 모델의 창고 재고, 운송중 재고, 출고 계획, 재고 예측을 확인할 수 있습니다.',
    en:
      'This dashboard shows inventory status by model. Select a model filter to check warehouse stock, in-transit stock, delivery plan, and inventory projection.',
  },
  dashboardUserTermsTitle: { ko: '용어 설명', en: 'Terms' },
  dashboardUserTermWarehouse: {
    ko: '창고 재고: 현재 창고에 보관 중인 수량',
    en: 'Warehouse Stock: Quantity currently stored in the warehouse',
  },
  dashboardUserTermInTransit: {
    ko: '운송중 재고: 선적 후 아직 창고에 입고되지 않은 수량',
    en: 'In-Transit Stock: Quantity shipped but not yet received at the warehouse',
  },
  dashboardUserTermDeliveryPlan: {
    ko: '출고 계획: 향후 출고 예정 수량',
    en: 'Delivery Plan: Planned outbound quantity',
  },
  dashboardUserTermCoverage: {
    ko: '커버리지: 현재 재고로 운영 가능한 예상 기간',
    en: 'Coverage: Estimated available operating period based on inventory',
  },

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
      '기준일 기준 주차(열) × 품목(행)에 주차별 출고(납품) 수량을 입력합니다. 각 주차 열 헤더의「출고확정」에 체크한 뒤 저장하면 해당 주에 입력된 모든 품번 수량이 창고 재고에서 차감되며, 재저장 시에는 이전 확정분과의 차이만 반영됩니다(헤더 체크 해제 후 저장 시 해당 주 전체 복원). 데이터는 브라우저에 저장되며 재고 예측·역산은 확정 반영분을 이중 차감하지 않도록 계산합니다.',
    en:
      'Grid: parts × weeks from as-of date. Enter weekly outbound qty; use the week-column header “Ship confirm”, then Save to deduct all SKUs in that week from warehouse stock. Re-save applies only the delta vs the last saved confirmation; clearing the week header check and Save restores stock for that week. Plans persist in the browser. Projection and as-of math treat confirmed qty as already reflected in warehouse so it is not subtracted twice.',
  },
  deliveryPlanPageDescRemote: {
    ko:
      '기준일 기준 주차(열) × 품목(행)에 주차별 출고(납품) 수량을 입력합니다. 주차 헤더「출고확정」체크 후 저장 시 해당 주 전체 품번이 창고 재고에 반영되며(차이만 재반영), 서버 동기화가 켜져 있으면 공유 스냅샷에도 반영됩니다.',
    en:
      'Grid: parts × weeks. Use the week header Ship confirm and Save to update warehouse stock for all SKUs in that week (delta-based). With server sync on, edits merge into the shared snapshot.',
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
  savedAfterEditWithRemote: {
    ko: '저장했습니다. 로컬 캐시에 반영되었으며 곧 서버 공유 스냅샷으로 동기화됩니다.',
    en: 'Saved to local cache; the shared server snapshot will update shortly.',
  },
  columnsCount: { ko: '열', en: 'Columns' },
  viewOffsetWeeks: { ko: '뷰 오프셋', en: 'View offset' },
  deliveryPlanWeeklyQty: { ko: '주간 수량', en: 'Weekly qty' },
  deliveryPlanWeekShipConfirm: {
    ko: '출고확정',
    en: 'Ship confirm',
  },
  deliveryPlanShipShort: { ko: '확정', en: 'Ship' },
  deliveryPlanShipConfirmCheckbox: {
    ko: '이 주차 출고 확정(저장 시 창고 재고 반영)',
    en: 'Confirm outbound for this week (warehouse applies on Save)',
  },
  deliveryPlanInsufficientStock: {
    ko: '창고 재고가 부족하여 저장할 수 없습니다.',
    en: 'Insufficient warehouse stock to save.',
  },
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
    ko: 'ETA·컨테이너·품목별 수량. 입고 체크 후 저장하면 창고 재고에 반영되며 행은 입고완료로 보관됩니다. 운송중 탭에는 미입고 건만, 입고 이력 탭에서 과거 확정 내역을 조회합니다.',
    en: 'ETA, container, qty per SKU. Save after receipt updates warehouse stock; rows are kept as received history. Use tabs to switch between in-transit and receipt history.',
  },
  unsavedNavigateConfirm: {
    ko: '저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?',
    en: 'You have unsaved changes. Leave without saving?',
  },
  /** @deprecated use unsavedNavigateConfirm */
  inTransitUnsavedNavigateConfirm: {
    ko: '저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?',
    en: 'You have unsaved changes. Leave without saving?',
  },
  inTransitDeleteConfirm: {
    ko: '정말 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.',
    en: 'Are you sure you want to delete? This cannot be undone.',
  },
  inTransitShipmentUpload: {
    ko: '선적 일정 업로드',
    en: 'Shipment upload',
  },
  transitRowsToAdd: {
    ko: '추가 행 수',
    en: 'Rows to add',
  },
  transitAddRowsButton: {
    ko: '행 추가',
    en: 'Add rows',
  },
  transitActionCol: { ko: '작업', en: 'Act' },
  transitRowDelete: { ko: '삭제', en: 'Del' },
  transitTabActive: { ko: '운송중 재고', en: 'In-transit stock' },
  transitTabHistory: { ko: '입고 이력 조회', en: 'Receipt history' },
  transitSearchSection: { ko: '검색', en: 'Search' },
  transitSearchModel: { ko: '모델명', en: 'Model name' },
  transitSearchPartNo: { ko: '부품번호', en: 'Part No' },
  transitSearchContainer: { ko: '컨테이너 No', en: 'Container No' },
  transitSearchDelivery: { ko: '배송지', en: 'Delivery location' },
  transitSearchButton: { ko: '검색', en: 'Search' },
  transitSearchReset: { ko: '초기화', en: 'Reset' },
  transitArrivedSaveHint: {
    ko: '저장 시 입고완료 처리되어 운송중 목록에서 숨겨지고, 입고 이력에서 조회됩니다.',
    en: 'Save marks as received: hidden from in-transit list; visible in receipt history.',
  },
  receiptDateCol: { ko: '입고일자', en: 'Receipt date' },
  receivedByCol: { ko: '처리자', en: 'Received by' },
  receivedAtCol: { ko: '처리일시', en: 'Processed at' },
  transitHistoryEmpty: {
    ko: '입고 완료된 이력이 없습니다.',
    en: 'No receipt history yet.',
  },
  receiptCancelButton: { ko: '입고 취소', en: 'Cancel receipt' },
  /** 입고 이력 테이블·모바일 카드: 입고 취소 대상 표시용 컬럼/행 라벨 */
  receiptCancelColumn: { ko: '입고 취소', en: 'Cancel receipt' },
  receiptCancelPickRow: { ko: '입고 취소 대상으로 표시', en: 'Mark for receipt cancellation' },
  receiptCancelConfirm: {
    ko: '선택한 입고 내역을 취소하고 운송중 재고로 되돌리시겠습니까?',
    en: 'Cancel selected receipts and move rows back to in-transit?',
  },
  receiptCancelSuccess: {
    ko: '입고 취소가 완료되었습니다.',
    en: 'Receipt cancellation completed.',
  },
  receiptCancelNoneSelected: {
    ko: '입고 취소할 항목을 선택해 주세요.',
    en: 'Please select one or more receipt lines to cancel.',
  },
  receiptCancelInsufficientStock: {
    ko: '창고 재고가 부족하여 입고 취소할 수 없습니다.',
    en: 'Cannot cancel receipt: warehouse stock is insufficient.',
  },
  /** 모바일 입고 전용 — {n} = 건수 */
  mobileInboundHint: {
    ko: '검색 후 입고된 건만 체크하고, 하단 버튼으로 확정하세요. Excel·대량 편집은 PC에서 이용해 주세요.',
    en: 'Search, tick received lines, then confirm below. Use a PC for Excel and bulk edits.',
  },
  mobileInboundNoneChecked: {
    ko: '입고 처리할 항목에 체크해 주세요.',
    en: 'Check at least one item to receive.',
  },
  mobileInboundConfirm: {
    ko: '선택한 {n}건을 입고완료 처리하고 창고 재고에 반영할까요?',
    en: 'Mark {n} selected line(s) as received and update warehouse stock?',
  },
  mobileInboundProcessButton: {
    ko: '선택 {n}건 입고 처리',
    en: 'Receive {n} selected',
  },
  mobileInboundEmpty: {
    ko: '표시할 운송중 재고가 없습니다. 검색 조건을 바꿔 보세요.',
    en: 'No in-transit lines to show. Try adjusting search.',
  },
  inventoryProjectionScreen: { ko: '재고 예측', en: 'Inventory Projection' },
  inventoryProjectionSubtitle: {
    ko:
      '주차별로 창고 재고에 운송중 입고(ETA Port+7일 해당 주)를 더하고 출고 계획을 뺀 예상 재고를 봅니다. 커버리지(주)는 해당 주 말 예상재고 ÷ 그 주 출고계획(0이면 표시 없음)입니다.',
    en:
      'Per week: warehouse + in-transit (ETA Port + 7 in that week) − outbound from Delivery Plan. Coverage = week-end projected ÷ that week’s plan (no plan → dash).',
  },
  inventoryProjectionSubtitleRemote: {
    ko:
      '현재 앱에 로드된 창고·운송중·출고 계획(서버 동기화 시 공유 스냅샷 + 로컬 캐시)을 주차별로 합산합니다. 운송중 입고는 ETA Port+7일 규칙으로 해당 주에 반영됩니다.',
    en:
      'Uses loaded warehouse, in-transit, and delivery-plan data (shared snapshot when sync is on, plus local cache). In-transit inbound is placed in weeks using the ETA Port + 7 days rule.',
  },
  projectionFutureWeeksLabel: { ko: '표시 주차(미래)', en: 'Future weeks' },
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
  settingsDataBackupTitle: { ko: '브라우저 데이터 백업 / 가져오기', en: 'Browser data backup / import' },
  settingsDataBackupHint: {
    ko:
      '창고·출고 계획·운송중·기준일·원가 맵·입고 이력 원장 등은 모두 이 PC의 브라우저 localStorage에만 저장됩니다. 배포 사이트(Vercel)는 별도 저장소이므로 localhost와 숫자가 다를 수 있습니다. 아래 JSON으로보낸 뒤 배포 사이트 설정에서 가져오면 동일 데이터를 볼 수 있습니다.',
    en:
      'Warehouse, plans, in-transit, as-of date, unit-cost map, ledgers, etc. are stored only in this browser’s localStorage. Each deployed site has its own storage, so totals can differ from localhost. Export JSON here and import it on the other site to mirror data.',
  },
  settingsDataBackupHintRemote: {
    ko:
      '클라우드 동기화가 켜져 있으면 공통 스냅샷이 서버에 있습니다. 아래 JSON은 파일 백업·이전·복구용이며, 보낸 뒤 다른 기기에서 가져오면 그 시점 스냅샷과 동일한 화면을 볼 수 있습니다. 일상적인 PC↔모바일 맞춤은 설정의 “보내기/불러오기”로 충분합니다.',
    en:
      'With cloud sync on, the shared snapshot lives on the server. JSON export/import is for file backup, migration, or recovery—importing on another device reproduces that snapshot. For day-to-day PC↔mobile alignment, use Push/Pull in Settings.',
  },
  settingsDataExportButton: { ko: 'JSON보내기', en: 'Export JSON' },
  settingsDataImportButton: { ko: 'JSON 가져오기', en: 'Import JSON' },
  settingsDataImportConfirm: {
    ko: '가져오면 백업에 포함된 항목으로 덮어씁니다. 계속할까요?',
    en: 'Import will overwrite matching datasets from the backup. Continue?',
  },
  settingsDataImportParseError: {
    ko: 'JSON을 읽을 수 없습니다. 파일 형식을 확인하세요.',
    en: 'Could not read JSON. Check the file format.',
  },
  settingsDataImportDone: {
    ko: '가져오기를 반영했습니다. 필요 시 대시보드로 이동해 수치를 확인하세요.',
    en: 'Import applied. Open the dashboard to verify figures.',
  },
  settingsRemoteSyncTitle: { ko: '클라우드 동기화 (PC·모바일 공통)', en: 'Cloud sync (PC & mobile)' },
  settingsRemoteSyncHint: {
    ko:
      'Vercel에 배포한 사이트에서 Upstash Redis와 API를 설정하면, 이 브라우저의 localStorage는 캐시로만 쓰고 공통 스냅샷이 서버에 저장됩니다. PC와 휴대폰/PWA가 같은 데이터를 봅니다. 자세한 환경 변수는 저장소 docs/REMOTE_SYNC.md를 참고하세요.',
    en:
      'On Vercel, configure Upstash Redis and server env vars so this app uses a shared snapshot while localStorage stays a cache. PC and phone/PWA then see the same data. See docs/REMOTE_SYNC.md in the repo.',
  },
  settingsRemoteDisabled: {
    ko: '동기화 비활성: VITE_INVENTORY_REMOTE_SYNC=true 및 토큰이 없으면 기존처럼 이 기기 localStorage만 사용합니다.',
    en: 'Sync off: without VITE_INVENTORY_REMOTE_SYNC=true and a token, only this device’s localStorage is used.',
  },
  settingsRemoteActive: {
    ko: '동기화 사용 중 — 변경 후 약 1.8초 뒤 서버에 반영되며, 주기적으로 서버에서 불러옵니다.',
    en: 'Sync on — changes push to the server after ~1.8s; we also pull periodically and when you return to the tab.',
  },
  remoteSyncBannerOff: {
    ko:
      '서버 동기화 비활성 — 재고·출고 계획·운송중 등은 이 브라우저에만 저장됩니다. 다른 PC·배포 사이트(Vercel)와 수치가 다를 수 있습니다. 맞추려면 설정에서 클라우드 동기화를 켜거나 JSON으로 옮기세요.',
    en:
      'Server sync is off — inventory data stays only in this browser. Totals may differ from another PC or your deployed site. Enable cloud sync in Settings or move data via JSON export/import.',
  },
  remoteSyncBannerOn: {
    ko: '서버 동기화 사용 중 — 저장 후 잠시 뒤 공유 스냅샷에 반영되며, “지금 서버로 보내기” 후 다른 기기에서 “서버에서 지금 불러오기”를 하면 동일 화면이 됩니다.',
    en:
      'Server sync is on — changes merge into the shared snapshot shortly. After “Push to server now”, use “Pull from server now” on another device to match exactly.',
  },
  settingsRemotePull: { ko: '서버에서 지금 불러오기', en: 'Pull from server now' },
  settingsRemotePush: { ko: '지금 서버로 보내기', en: 'Push to server now' },
  settingsRemoteBusy: { ko: '처리 중…', en: 'Working…' },
  settingsRemoteLastPull: { ko: '마지막 가져오기', en: 'Last pull' },
  settingsRemoteLastPush: { ko: '마지막 보내기', en: 'Last push' },
  settingsRemoteServerTime: { ko: '서버 스냅샷 시각', en: 'Server snapshot time' },
  warehousePipelineAbbr: { ko: '운송중', en: 'In-transit' },
  openWarehouseInventory: { ko: '창고 재고 화면으로', en: 'Open Warehouse Inventory' },
  projectionLegendShort: {
    ko: 'Inv: 전주 예상 + 해당주(ETA Port+7일 입고) − 출고계획 · Cov: 예상 ÷ max(출고계획, 주간수요) · Gap: 예상 − 안전재고수량',
    en: 'Inv: prior + inbound (ETA Port+7d in week) − outbound plan · Cov: projected ÷ max(plan, weekly demand) · Gap: vs safety qty',
  },
  projectionLegendRiskBands: {
    ko: '2주 미만 위험 · 2~3주 미만 주의 · 3~6주 미만 안정 · 6주 이상 과잉',
    en: '<2w critical · 2–3w warning · 3–6w stable · 6w+ overstock',
  },
  projectionLegendStatusScope: {
    ko: '위험/주의/안정/과잉 뱃지는 품번별 ETA Port+7일 입고가 있는 마지막 주차까지만 표시됩니다. 이후 주차는 수치만 표시합니다.',
    en: 'Risk badges appear only through the last week with an ETA Port+7 in-transit receipt per SKU. Later weeks show figures only.',
  },
  projectionStatusLabels: {
    critical: { ko: '위험', en: 'Critical' },
    warning: { ko: '주의', en: 'Warning' },
    stable: { ko: '안정', en: 'Stable' },
    overstock: { ko: '과잉', en: 'Overstock' },
    na: { ko: '해당없음', en: 'N/A' },
  },

  /** Dashboard 상단 KPI */
  dashboardWarehouseQty: { ko: '창고 재고 수량', en: 'Warehouse Stock Qty' },
  dashboardWarehouseValue: { ko: '창고 재고 금액', en: 'Warehouse Stock Value' },
  dashboardInTransitQty: { ko: '운송중 재고 수량', en: 'In-Transit Stock Qty' },
  dashboardInTransitValue: { ko: '운송중 재고 금액', en: 'In-Transit Stock Value' },
  /** 대시보드 KPI 아래: 집계 조건·저장소 설명 */
  dashboardInTransitQtyFootnote: {
    ko:
      '이 수량은 이 브라우저에만 저장된 운송중 행을 사용합니다. 도메인마다 저장소가 달라 localhost와 배포 사이트 수치가 다를 수 있습니다. 합산에는 상단 모델·운영 기준일(as-of)·미입고 행만 포함됩니다. 동일 화면을 보려면 설정의 JSON 백업/가져오기 또는 클라우드 동기화를 이용하세요.',
    en:
      'This qty uses in-transit rows stored only in this browser; each origin has separate storage, so numbers may differ from another site. The sum includes the selected model, ops as-of rules, and lines not marked arrived. Use JSON backup/import or cloud sync in Settings to align environments.',
  },
  dashboardInTransitQtyFootnoteRemote: {
    ko:
      '운송중 수량은 현재 앱에 로드된 운송중 행(서버 공유 스냅샷 + 로컬 캐시)을 기준으로 합니다. 합산에는 상단 모델·운영 기준일(as-of)·입고 체크되지 않은 행만 포함됩니다.',
    en:
      'In-transit qty uses loaded rows (shared server snapshot plus local cache). The sum includes the selected model, ops as-of rules, and lines not marked arrived.',
  },
  dashboardThisWeekEtaQty: { ko: '이번주 ETA 수량', en: 'This Week ETA Qty' },
  dashboardDelayContainers: { ko: '지연 컨테이너', en: 'Delay containers' },
  delayOverdue: { ko: '지연', en: 'Overdue' },
  inventoryByPart: { ko: '품번별 재고 현황', en: 'Inventory by Part' },
  /** 품번별 재고 표 — 참고용 운송중(미입고) 수량 열 */
  inventoryTableInTransit: { ko: '운송중', en: 'In-Transit' },
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

/** 한 줄 병기 — aria-label, placeholder, option 등 */
export function formatKoEnInline(label) {
  if (!label?.ko) return ''
  return label.en ? `${label.ko}(${label.en})` : label.ko
}

/** 상태 메시지 등 — 줄바꿈 병기 (영문은 괄호) */
export function formatKoEn(label) {
  if (!label?.ko) return ''
  return label.en ? `${label.ko}\n(${label.en})` : label.ko
}
