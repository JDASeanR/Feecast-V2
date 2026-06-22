import { clsx } from '../../lib/utils'
import { fmt } from '../../lib/utils'

// Re-use phase calc helpers (same as ProjectsTab)
const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const phCAEst  = ph => ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : 0
const phFeeFC  = ph => ph.scope === 'CA' ? phCAEst(ph) : (ph.fee || 0)
function phYTD(ph) {
  let s = 0
  for (let m = 1; m < CM; m++) {
    const mk = `${CY}-${String(m).padStart(2, '0')}`
    s += ph.monthly?.[mk] || 0
  }
  return s
}
const phRem  = ph => Math.max(0, phFeeFC(ph) - (ph.billed || 0) - phYTD(ph))
const pFee   = p => (p.phases || []).reduce((s, ph) => s + phFeeFC(ph), 0)
const pBil   = p => (p.phases || []).reduce((s, ph) => s + (ph.billed || 0), 0)
const pYTD   = p => (p.phases || []).reduce((s, ph) => s + phYTD(ph), 0)
const pRem   = p => pFee(p) - pBil(p) - pYTD(p)
const pWIP   = p => { const f = pFee(p); return f > 0 ? (pBil(p) + pYTD(p)) / f : 0 }

// AR helpers
function invAgeDays(inv) {
  const ino = String(inv.invoiceNo || '')
  if (ino.length >= 6) {
    const yr = +ino.slice(0, 4), mo = +ino.slice(4, 6)
    if (yr > 2000 && mo >= 1 && mo <= 12) {
      const d = new Date(yr, mo - 1, 1)
      d.setDate(d.getDate() + 30)
      return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
    }
  }
  return 0
}
const autoBucket = days => days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : days <= 120 ? '90-120' : '120+'
const effBucket  = inv => inv.bucketOverride || autoBucket(invAgeDays(inv))
const AR_COLORS  = { '0-30': '#4ade80', '30-60': '#fde047', '60-90': '#fb923c', '90-120': '#f87171', '120+': '#dc2626' }
const BUCKET_LABELS = { '0-30': 'Current', '30-60': '30–60d', '60-90': '60–90d', '90-120': '90–120d', '120+': '120+d' }

export default function FollowUpTab({ appState, mutate }) {
  const { projects, invoices } = appState

  const flaggedProjects = projects.filter(p => !p.archived && !p.done && (p.flag || p.phases.some(ph => ph.flag)))
  const flaggedAR       = invoices.filter(i => !i.paid && i.flag)

  if (!flaggedProjects.length && !flaggedAR.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <i className="ti ti-circle-check text-success text-4xl mb-3" />
        <div className="font-semibold text-sm">All clear</div>
        <div className="text-xs text-olive mt-1">No follow-up items flagged.</div>
      </div>
    )
  }

  const toggleProjFlag = (projId) => {
    mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id === projId ? { ...p, flag: !p.flag } : p) }))
  }
  const togglePhaseFlag = (projId, phId) => {
    mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id !== projId ? p : {
      ...p, phases: p.phases.map(ph => ph.id !== phId ? ph : { ...ph, flag: !ph.flag })
    })}))
  }
  const toggleARFlag = (invId) => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === invId ? { ...i, flag: !i.flag } : i) }))
  }
  const markPaid = (invId) => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === invId ? { ...i, paid: !i.paid } : i) }))
  }

  return (
    <div className="p-4 space-y-6">

      {/* Flagged projects */}
      {flaggedProjects.length > 0 && (
        <section>
          <div className="text-xs font-semibold text-dark uppercase tracking-wider mb-2">
            Projects ({flaggedProjects.length})
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[700px]">
              <thead>
                <tr>
                  <th style={{ width: 60 }} />
                  <th style={{ width: 32 }}>PM</th>
                  <th style={{ width: 56 }}>Proj #</th>
                  <th>Project / Client</th>
                  <th style={{ width: 48 }}>Status</th>
                  <th style={{ width: 80 }}>Fee</th>
                  <th style={{ width: 80 }}>Remaining</th>
                  <th style={{ width: 72 }}>WIP</th>
                </tr>
              </thead>
              <tbody>
                {flaggedProjects.flatMap(p => {
                  const wip    = pWIP(p)
                  const wipPct = Math.round(wip * 100)
                  const flaggedPhases = p.phases.filter(ph => ph.flag)

                  return [
                    <tr key={p.id} className="bg-sand-2/50">
                      <td className="px-1">
                        <div className="flex gap-0.5">
                          <button onClick={() => toggleProjFlag(p.id)}
                            className={clsx('btn btn-icon btn-sm', p.flag && 'text-flag')}>
                            <i className={clsx('ti', p.flag ? 'ti-flag-filled' : 'ti-flag')} style={{ fontSize: 11 }} />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 text-xs text-olive">{p.pm}</td>
                      <td className="px-2 text-xs text-dark-3">{p.projNo}</td>
                      <td className="px-2">
                        <div className="font-semibold text-xs">{p.project}</div>
                        <div className="text-2xs text-olive">{p.client}</div>
                        {p.notes && <div className="text-2xs text-dark-3 italic">{p.notes}</div>}
                      </td>
                      <td className="px-2 text-center">
                        <span className="text-2xs bg-sand-2 text-olive px-1.5 py-0.5 rounded">{p.status}</span>
                      </td>
                      <td className="px-2 text-xs">{fmt(pFee(p))}</td>
                      <td className="px-2 text-xs text-olive">{fmt(pRem(p))}</td>
                      <td className="px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{wipPct}%</span>
                          <div className="progress-bar flex-1">
                            <div className="progress-bar-fill bg-terracotta" style={{ width: Math.min(100, wipPct) + '%' }} />
                          </div>
                        </div>
                      </td>
                    </tr>,
                    // Flagged phases
                    ...flaggedPhases.map(ph => (
                      <tr key={`${p.id}-${ph.id}`} className="opacity-80">
                        <td className="px-1" style={{ paddingLeft: 24 }}>
                          <button onClick={() => togglePhaseFlag(p.id, ph.id)}
                            className="btn btn-icon btn-sm text-flag">
                            <i className="ti ti-flag-filled" style={{ fontSize: 11 }} />
                          </button>
                        </td>
                        <td className="px-2 text-2xs text-dark-3">{ph.scope}</td>
                        <td />
                        <td className="px-2 text-xs text-olive" colSpan={2}>{ph.name}</td>
                        <td className="px-2 text-xs">{fmt(ph.fee)}</td>
                        <td className="px-2 text-xs text-olive">{fmt(phRem(ph))}</td>
                        <td className="px-2 text-xs">{ph.pct || 0}%</td>
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Flagged A/R */}
      {flaggedAR.length > 0 && (
        <section>
          <div className="text-xs font-semibold text-dark uppercase tracking-wider mb-2">
            A/R Follow-up ({flaggedAR.length})
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[600px]">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th style={{ width: 28 }} />
                  <th>Client / Project</th>
                  <th style={{ width: 36 }}>PM</th>
                  <th style={{ width: 80 }}>Invoice</th>
                  <th style={{ width: 80 }} className="text-right">Amount</th>
                  <th style={{ width: 100 }}>Age</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flaggedAR.map(inv => {
                  const bucket = effBucket(inv)
                  const days   = invAgeDays(inv)
                  return (
                    <tr key={inv.id}>
                      <td className="px-1">
                        <button onClick={() => markPaid(inv.id)} className="btn btn-icon btn-sm text-success">
                          <i className="ti ti-check" style={{ fontSize: 11 }} />
                        </button>
                      </td>
                      <td className="px-1">
                        <button onClick={() => toggleARFlag(inv.id)} className="btn btn-icon btn-sm text-flag">
                          <i className="ti ti-flag-filled" style={{ fontSize: 11 }} />
                        </button>
                      </td>
                      <td className="px-2">
                        <div className="font-semibold text-xs">{inv.client}</div>
                        <div className="text-2xs text-olive">{inv.project}</div>
                      </td>
                      <td className="px-2 text-xs text-olive">{inv.pm}</td>
                      <td className="px-2 text-xs">{inv.invoiceNo}</td>
                      <td className="px-2 text-right text-xs font-semibold">{fmt(inv.amount)}</td>
                      <td className="px-2">
                        <span className="text-2xs px-1.5 py-0.5 rounded font-semibold"
                          style={{ color: AR_COLORS[bucket], background: AR_COLORS[bucket] + '20' }}>
                          {BUCKET_LABELS[bucket]}
                        </span>
                        <span className="text-2xs text-dark-3 ml-1">{days}d</span>
                      </td>
                      <td className="px-2">
                        {inv.committed && (
                          <div className="text-2xs text-olive flex items-center gap-1 mb-0.5">
                            <i className="ti ti-calendar-check" style={{ fontSize: 10 }} />
                            {inv.committedDate}
                          </div>
                        )}
                        {inv.status && <div className="text-2xs text-dark-3">{inv.status}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
