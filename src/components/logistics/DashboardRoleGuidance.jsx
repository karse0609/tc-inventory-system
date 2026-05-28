import { L } from '../../i18n/labels'
import BilingualLabel from '../BilingualLabel'

/**
 * 대시보드 상단 안내 — Admin: 시스템·저장소, 일반 사용자: 사용 안내·용어
 */
export default function DashboardRoleGuidance({ isAdmin, showLedgerHint }) {
  if (isAdmin) {
    return (
      <>
        {showLedgerHint ? (
          <p className="dashboard__as-of-hint" role="note">
            <BilingualLabel label={L.dashboardAsOfLedgerHint} as="span" />
          </p>
        ) : null}
        <p className="dashboard__scope-note">
          <BilingualLabel label={L.multiItemNote} as="span" />
        </p>
      </>
    )
  }

  const terms = [
    L.dashboardUserTermWarehouse,
    L.dashboardUserTermInTransit,
    L.dashboardUserTermDeliveryPlan,
    L.dashboardUserTermCoverage,
  ]

  return (
    <aside className="dashboard__user-guide" role="note" aria-labelledby="dashboard-user-guide-title">
      <h2 id="dashboard-user-guide-title" className="dashboard__user-guide-heading">
        <BilingualLabel label={L.dashboardUserGuideTitle} as="span" />
      </h2>
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
  )
}
