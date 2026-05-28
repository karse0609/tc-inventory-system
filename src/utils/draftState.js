/** JSON 직렬화 기반 draft 복제·동등 비교 */
export function cloneJson(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map((item) => cloneJson(item))
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = cloneJson(v)
    return out
  }
  return value
}

export function dataEqualJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
