import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

let registered = false

/** 앱 전역 1회 — AG Grid Community 모듈 등록 */
export function ensureAgGridModules() {
  if (registered) return
  ModuleRegistry.registerModules([AllCommunityModule])
  registered = true
}
