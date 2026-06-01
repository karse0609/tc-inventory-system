import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** @returns {string} */
export function defaultInventorySnapshotPath() {
  return join(process.cwd(), 'data', 'live-inventory.json')
}

/** @returns {string} */
export function resolveInventorySnapshotPath() {
  const fromEnv = process.env.INVENTORY_SNAPSHOT_FILE?.trim()
  return fromEnv || defaultInventorySnapshotPath()
}

/**
 * @returns {Promise<Record<string, unknown> | null>} null if 파일 없음
 */
export async function readInventorySnapshotFromDisk() {
  const filePath = resolveInventorySnapshotPath()
  try {
    const text = await readFile(filePath, 'utf8')
    return JSON.parse(text)
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
    if (code === 'ENOENT') return null
    throw e
  }
}

/**
 * @param {Record<string, unknown>} body - { tcInvExportVersion, payload, ... }
 * @returns {Promise<{ updatedAt: string }>}
 */
export async function writeInventorySnapshotToDisk(body) {
  const filePath = resolveInventorySnapshotPath()
  await mkdir(dirname(filePath), { recursive: true })
  const envelope = {
    ...body,
    updatedAt: new Date().toISOString(),
  }
  await writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8')
  return { updatedAt: envelope.updatedAt }
}
