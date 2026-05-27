import { useCallback, useEffect, useState } from 'react'
import { MOBILE_SIMPLE_LAYOUT_MQ } from '../utils/mobileLayout'
import './PwaInstallHint.css'

const DISMISS_KEY = 'tc-inv-pwa-install-dismissed'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  )
}

export default function PwaInstallHint() {
  const [visible, setVisible] = useState(false)
  const [deferred, setDeferred] = useState(null)
  const [isIos] = useState(
    () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent),
  )

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode */
    }
    setVisible(false)
    setDeferred(null)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandaloneDisplay()) return
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      /* ignore */
    }

    const mq = window.matchMedia(MOBILE_SIMPLE_LAYOUT_MQ)
    const applyMq = () => {
      if (!mq.matches) {
        setVisible(false)
        return
      }
      if (isStandaloneDisplay()) {
        setVisible(false)
        return
      }
      setVisible(true)
    }
    applyMq()
    mq.addEventListener('change', applyMq)
    return () => mq.removeEventListener('change', applyMq)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const onBip = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [visible])

  const onInstallClick = useCallback(async () => {
    if (!deferred || typeof deferred.prompt !== 'function') return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch {
      /* 사용자 취소 등 */
    }
    dismiss()
  }, [deferred, dismiss])

  if (!visible) return null

  return (
    <div className="pwa-install-hint" role="region" aria-label="앱 설치 안내">
      <div className="pwa-install-hint__inner">
        <p className="pwa-install-hint__text">
          홈 화면에 추가하여 앱처럼 사용하세요.
          {isIos ? (
            <span className="pwa-install-hint__sub">
              {' '}
              Safari <strong>공유</strong> → <strong>홈 화면에 추가</strong>
            </span>
          ) : (
            <span className="pwa-install-hint__sub">
              {' '}
              Chrome <strong>⋮</strong> 메뉴 → <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>
            </span>
          )}
        </p>
        <div className="pwa-install-hint__actions">
          {deferred ? (
            <button type="button" className="btn btn--primary pwa-install-hint__btn" onClick={onInstallClick}>
              앱 설치
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost pwa-install-hint__btn" onClick={dismiss}>
            닫기
          </button>
        </div>
      </div>
      <button
        type="button"
        className="pwa-install-hint__close"
        onClick={dismiss}
        aria-label="안내 닫기"
      >
        ×
      </button>
    </div>
  )
}
