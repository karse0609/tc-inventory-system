/** TC TECH 재고관리 — 샘플 주간 계획·이력 (다품목: modelName 필드) */

import { PILOT_MODEL_NAME } from '../config/products'
import { withModelName } from '../utils/inventoryHelpers'

export const INITIAL_STARTING_INVENTORY = 12_500

const rawWeeklyPlans = [
  {
    week: '2026-W18',
    label: '18주차',
    periodStart: '2026-04-28',
    tcShipment: 1_200,
    oeiInbound: 3_200,
    weeklyOutbound: 2_800,
    nci: 150,
    planNote: '정기 OEI 입고',
    status: 'completed',
  },
  {
    week: '2026-W19',
    label: '19주차',
    periodStart: '2026-05-05',
    tcShipment: 900,
    oeiInbound: 2_400,
    weeklyOutbound: 3_100,
    nci: 80,
    planNote: '주간 출고 피크',
    status: 'completed',
  },
  {
    week: '2026-W20',
    label: '20주차',
    periodStart: '2026-05-12',
    tcShipment: 1_500,
    oeiInbound: 4_100,
    weeklyOutbound: 2_650,
    nci: 200,
    planNote: '대량 OEI + NCI 반영',
    status: 'current',
  },
  {
    week: '2026-W21',
    label: '21주차',
    periodStart: '2026-05-19',
    tcShipment: 800,
    oeiInbound: 1_800,
    weeklyOutbound: 2_900,
    nci: 0,
    planNote: '출고 집중 주간',
    status: 'planned',
  },
  {
    week: '2026-W22',
    label: '22주차',
    periodStart: '2026-05-26',
    tcShipment: 1_100,
    oeiInbound: 3_600,
    weeklyOutbound: 2_400,
    nci: 120,
    planNote: '월말 재고 보충',
    status: 'planned',
  },
  {
    week: '2026-W23',
    label: '23주차',
    periodStart: '2026-06-02',
    tcShipment: 950,
    oeiInbound: 2_200,
    weeklyOutbound: 3_200,
    nci: 90,
    planNote: '분기 말 출고',
    status: 'planned',
  },
]

export const weeklyPlans = withModelName(rawWeeklyPlans, PILOT_MODEL_NAME)

const rawHistoryEvents = [
  {
    id: 'H-001',
    date: '2026-05-08',
    week: '2026-W19',
    type: 'OEI입고',
    quantity: 2_400,
    operator: '김재고',
    memo: '정기 OEI 입고 완료',
  },
  {
    id: 'H-002',
    date: '2026-05-10',
    week: '2026-W19',
    type: '주간출고',
    quantity: -1_550,
    operator: '이출고',
    memo: '1차 주간 출고',
  },
  {
    id: 'H-003',
    date: '2026-05-12',
    week: '2026-W20',
    type: 'NCI',
    quantity: 200,
    operator: '박계획',
    memo: 'NCI 반영 조정',
  },
  {
    id: 'H-004',
    date: '2026-05-14',
    week: '2026-W20',
    type: '주간출고',
    quantity: -1_100,
    operator: '이출고',
    memo: '2차 주간 출고',
  },
  {
    id: 'H-005',
    date: '2026-05-15',
    week: '2026-W20',
    type: '시뮬레이션',
    quantity: 0,
    operator: '시스템',
    memo: '시작 재고 시나리오 검토',
  },
]

export const historyEvents = withModelName(rawHistoryEvents, PILOT_MODEL_NAME)

export const dashboardMeta = {
  title: 'TC TECH 재고관리',
  subtitle: 'Inventory Management Dashboard',
  safetyStock: 8_000,
  unit: 'EA',
  /** 기본 기준일 (진행 주차 없을 때) */
  asOfDate: '2026-05-12',
  timezone: 'Asia/Seoul',
  timezoneLabel: 'KST (Asia/Seoul)',
}
