import { clsx } from '../../lib/utils'
import { fmt } from '../../lib/utils'

const CY  = new Date().getFullYear()
const CM  = new Date().getMonth() + 1
const CUR_MK = `${CY}-${String(CM).padStart(2, '0')}`

const phCAEst = ph => ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : 0
const phFeeFC = ph => ph.scope === 'CA' ? phCAEst(ph) : (ph.fee || 0)
function phYTD(ph) {
  let s = 0
  for (let m = 1; m < CM; m++) {
    const mk = `${CY}-${String(m).padStart(2, '0')}`
    s += ph.monthly?.[mk] || 0
  }
  return s
}
const phRem   = ph => Math.max(0, phFeeFC(ph) - (ph.billed || 0) - phYTD(ph))
const phAlloc = ph => Object.entries(ph.monthly || {})
  .filter(([mk]) => mk >= CUR_MK).reduce((s, [, v]) => s + (v || 0), 0)
const phVal   = ph => {
  const r = phRem(ph)
  if (r <= 0) return null
  const a = phAlloc(ph)
  return Math.abs(a - r) < 1 ? null : a > r ? 'over' : 'under'
}

const HOLD_LABELS = { 'not-authorized': 'Not Authorized', 'awaiting-approval': 'Awaiting Approval' }
const HOLD_ICONS  = { 'not-authorized': 'ti-lock', 'awaiting-approval': 'ti-clock' }

export default function AllocationWarningsTab({ appState }) {
  const { projects } = appState

  const warnings = []
  const held = []
  projects.filter(p => !p.archived && !p.done).forEach(p => {
    p.phases.forEach(ph => {
      if (ph.holdStatus) {
        const r = phRem(ph)
        if (r > 0) held.push({
          pm: p.pm, project: p.project, phase: ph.name,
          holdStatus: ph.holdStatus, rem: r, fee: phFeeFC(ph)
        })
        return
      }
      const v = phVal(ph)
      if (v) warnings.push({
        projId: p.id, pm: p.pm, project: p.project, phase: ph.name,
        issue: v, rem: phRem(ph), alloc: phAlloc(ph), fee: phFeeFC(ph)
      })
    })
  })

  if (!warnings.length && !held.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <i className="ti ti-circle-check text-success text-4xl mb-3" />
        <div className="font-semibold text-sm">All allocations look good</div>
        <div className="text-xs text-olive mt-1">No under- or over-allocated phases found.</div>
      </div>
    )
  }

  const underCount = warnings.filter(w => w.issue === 'under').length
  const overCount  = warnings.filter(w => w.issue === 'over').length

  return (
    <div className="p-4">
      {warnings.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <i className="ti ti-alert-triangle text-warning text-xl" />
            <div className="text-xs">
              <strong>{warnings.length} allocation mismatch{warnings.length !== 1 ? 'es' : ''}</strong>
              {underCount > 0 && <span className="ml-2 text-warning">{underCount} under-allocated</span>}
              {overCount > 0 && <span className="ml-2 text-flag">{overCount} over-allocated</span>}
            </div>
          </div>

          <table className="data-table w-full">
            <thead>
              <tr>
                <th style={{ width: 40 }}>PM</th>
                <th>Project</th>
                <th>Phase</th>
                <th style={{ width: 80 }}>Remaining</th>
                <th style={{ width: 80 }}>Allocated</th>
                <th style={{ width: 80 }}>Gap</th>
                <th style={{ width: 100 }}>Issue</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w, i) => {
                const gap = w.alloc - w.rem
                const isOver = w.issue === 'over'
                return (
                  <tr key={i}>
                    <td className="px-2 text-xs text-olive">{w.pm}</td>
                    <td className="px-2 text-xs font-semibold">{w.project}</td>
                    <td className="px-2 text-xs text-olive">{w.phase}</td>
                    <td className="px-2 text-xs">{fmt(w.rem)}</td>
                    <td className="px-2 text-xs">{fmt(w.alloc)}</td>
                    <td className="px-2 text-xs font-semibold" style={{ color: isOver ? '#c0392b' : '#b45309' }}>
                      {isOver ? '+' : ''}{fmt(gap)}
                    </td>
                    <td className="px-2">
                      <span className={clsx(
                        'text-2xs px-2 py-0.5 rounded font-semibold',
                        isOver ? 'bg-red-50 text-flag' : 'bg-orange-50 text-warning'
                      )}>
                        {isOver ? 'Over-allocated' : 'Under-allocated'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {held.length > 0 && (
        <div className={warnings.length > 0 ? 'mt-6' : ''}>
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)' }}>
            <i className="ti ti-lock" style={{ fontSize: 18, color: '#6b7280' }} />
            <div className="text-xs">
              <strong>{held.length} phase{held.length !== 1 ? 's' : ''} on hold</strong>
              <span className="ml-2" style={{ color: '#6b7280' }}>Excluded from allocation warnings</span>
            </div>
          </div>

          <table className="data-table w-full">
            <thead>
              <tr>
                <th style={{ width: 40 }}>PM</th>
                <th>Project</th>
                <th>Phase</th>
                <th style={{ width: 80 }}>Fee</th>
                <th style={{ width: 80 }}>Remaining</th>
                <th style={{ width: 160 }}>Hold Reason</th>
              </tr>
            </thead>
            <tbody>
              {held.map((h, i) => (
                <tr key={i} style={{ opacity: 0.7 }}>
                  <td className="px-2 text-xs text-olive">{h.pm}</td>
                  <td className="px-2 text-xs font-semibold">{h.project}</td>
                  <td className="px-2 text-xs text-olive">{h.phase}</td>
                  <td className="px-2 text-xs">{fmt(h.fee)}</td>
                  <td className="px-2 text-xs">{fmt(h.rem)}</td>
                  <td className="px-2">
                    <span className="text-2xs px-2 py-0.5 rounded font-semibold flex items-center gap-1 w-fit"
                      style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>
                      <i className={clsx('ti', HOLD_ICONS[h.holdStatus])} style={{ fontSize: 10 }} />
                      {HOLD_LABELS[h.holdStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
