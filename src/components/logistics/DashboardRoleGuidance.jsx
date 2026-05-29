import { useId, useState } from 'react'
import { L } from '../../i18n/labels'
import BilingualLabel from '../BilingualLabel'

/**
 * 대시보드 안내 — KPI 아래, 기본 접힘. Admin: 시스템·저장소, 일반: 사용 안내·용어
 */
export default function DashboardRoleGuidance({
  isAdmin,
  showLedgerHint,
  inventoryRemoteSyncEnabled,
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const titleLabel = isAdmin ? L.dashboardSystemNotesTitle : L.dashboardUserGuideTitle
  const toggleLabel = open ? L.dashboardGuideCollapse : L.dashboardGuideExpand

  const terms = [
    L.dashboardUserTermWarehouse,
    L.dashboardUserTermInTransit,
    L.dashboardUserTermDeliveryPlan,
    L.dashboardUserTermCoverage,
  ]

  return (
    <section className="dashboard__guide-shell" aria-label={formatTitle(titleLabel)}>
      <div className="dashboard__guide-bar">
        <h2 className="dashboard__guide-bar-title">
          <BilingualLabel label={titleLabel} as="span" />
        </h2>
        <button
          type="button"
          className="dashboard__guide-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <BilingualLabel label={toggleLabel} as="span" />
        </button>
      </div>
      {open ? (
        <div id={panelId} className="dashboard__guide-panel">
          {isAdmin ? (
            <>
              <p className="dashboard__scope-note dashboard__scope-note--in-panel">
                <BilingualLabel label={L.multiItemNote} as="span" />
              </p>
              {showLedgerHint ? (
                <p className="dashboard__as-of-hint dashboard__as-of-hint--in-panel" role="note">
                  <BilingualLabel label={L.dashboardAsOfLedgerHint} as="span" />
                </p>
              ) : null}
              <p className="dashboard__kpi-footnote dashboard__kpi-footnote--in-panel page__hint">
                <BilingualLabel
                  label={
                    inventoryRemoteSyncEnabled
                      ? L.dashboardInTransitQtyFootnoteRemote
                      : L.dashboardInTransitQtyFootnote
                  }
                  as="span"
                />
              </p>
            </>
          ) : (
            <aside className="dashboard__user-guide" role="note">
              <p className="dashboard__user-guide-lead">
                <BilingualLabel label={L.dashboardUserGuideBody} as="span" />
              </p>
              <h3 className="dashboard__user-guide-subheading">
                <BilingualLabel label={L.dashboardUserTermsTitle} as="span" />
              </h3>
              <ul className="dashboard__user-guide-terms">
                {terms.map((label) => (
                  <li key={label.ko}>
                    <BilingualLabel label={label} as="span" />
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      ) : null}
    </section>
  )
}

function formatTitle(label) {
  return `${label.ko} · ${label.en}`
}
