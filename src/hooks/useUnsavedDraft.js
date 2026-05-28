import { useEffect, useMemo, useState } from 'react'
import { cloneJson, dataEqualJson } from '../utils/draftState'

/**
 * 마지막 저장본(saved) 대비 화면 draft · 미저장 경고 · 가드 등록
 * @param {{
 *   saved: unknown,
 *   clone?: (saved: unknown) => unknown,
 *   isEqual?: (a: unknown, b: unknown) => boolean,
 *   registerUnsavedGuard?: (screenId: string, checker: (() => boolean) | null) => void,
 *   guardId?: string,
 * }} options
 */
export default function useUnsavedDraft({
  saved,
  clone = cloneJson,
  isEqual = dataEqualJson,
  registerUnsavedGuard,
  guardId,
}) {
  const [draft, setDraft] = useState(() => clone(saved))

  const isDirty = useMemo(() => !isEqual(draft, saved), [draft, saved, isEqual])

  useEffect(() => {
    if (!isDirty) setDraft(clone(saved))
  }, [saved, isDirty, clone])

  useEffect(() => {
    if (!registerUnsavedGuard || !guardId) return undefined
    registerUnsavedGuard(guardId, () => isDirty)
    return () => registerUnsavedGuard(guardId, null)
  }, [isDirty, registerUnsavedGuard, guardId])

  useEffect(() => {
    if (!isDirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  return { draft, setDraft, isDirty }
}
