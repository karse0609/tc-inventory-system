import { useEffect, useState } from 'react'

/**
 * 좁은 뷰포트(휴대폰·PWA) — 입고 전용 UI·엑셀 숨김 등과 동일 기준으로 사용합니다.
 * InTransitPage 카드 레이아웃과 맞추려면 이 MQ만 수정하면 됩니다.
 */
export const MOBILE_SIMPLE_LAYOUT_MQ = '(max-width: 700px)'

/** PWA·휴대폰 창고 입고 전용: 상단 네비에 노출할 뷰 id (PC는 전체 메뉴 유지) */
export const MOBILE_WAREHOUSE_NAV_VIEW_IDS = ['dashboard', 'transit']

export function prefersMobileSimpleLayout() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_SIMPLE_LAYOUT_MQ).matches
}

export function useMobileSimpleLayout() {
  const [isMobile, setIsMobile] = useState(() => prefersMobileSimpleLayout())

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SIMPLE_LAYOUT_MQ)
    const fn = () => setIsMobile(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  return isMobile
}
