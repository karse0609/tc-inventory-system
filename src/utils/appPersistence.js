const KEYS = {
  master: 'tc-inv-master-items',
  plans: 'tc-inv-delivery-plans',
  transit: 'tc-inv-in-transit',
  ops: 'tc-inv-operations-meta',
  weekly: 'tc-inv-weekly-plans',
  starting: 'tc-inv-starting-inventory',
  simSource: 'tc-inv-sim-source',
}

export function loadJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export const storageKeys = KEYS
