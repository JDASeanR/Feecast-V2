import { useState } from 'react'
import { clsx, fmt } from '../../lib/utils'

const CY     = new Date().getFullYear()
const CM     = new Date().getMonth() + 1
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

export default function AllocationWarningsTab({ appState, onNavigate }) {
  const { projects, settings } = appState

  const [filterPM,     setFilterPM]     = useState('all')
  const [collapsedPMs, setCollapsedPMs] = useState({})

  const togglePM = key => setCollapsedPMs(prev => ({ ...prev, [key]: !prev[key] }))

  const warnings = []
  const held     = []
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
        projId: p.id, pm: p.pm, client: p._client || p.client || '—',
        project: p.project, phase: ph.name,
        issue: v, rem: phRem(ph), alloc: phAlloc(ph), fee: phFeeFC(ph)
      })
    })
  })

  const goFix = w => {
    const pmKey     = 'pm-' + w.pm
    const clientKey = `client-${w.pm}-${w.client}`
    try {
      const expPM = JSON.parse(localStorage.getItem('fc_bill.expPM') || '{}')
      expPM[pmKey] = true
      localStorage.setItem('fc_bill.expPM', JSON.stringify(expPM))
      const expClient = JSON.parse(localStorage.getItem('fc_bill.expClient') || '{}')
      expClient[clientKey] = true
      localStorage.setItem('fc_bill.expClient', JSON.stringify(expClient))
      localStorage.setItem('fc_bill.showPhases', 'true')
    } catch {}
    if (onNavigate) onNavigate('billing')
  }

  if (!warnings.length && !held.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <i className="ti ti-circle-check text-success text-4xl mb-3" />
        <div className="font-semibold text-sm">All allocations look good</div>
        <div className="text-xs text-olive mt-1">No under- or over-allocated phases found.</div>
      </div>
    )
  }

  const allPMsInData = [...new Set([...warnings, ...held].map(x => x.pm))].sort()

  const filteredWarnings = filterPM === 'all' ? warnings : warnings.filter(w => w.pm === filterPM)
  const filteredHeld     = filterPM === 'all' ? held     : held.filter(h => h.pm === filterPM)

  const underCount = filteredWarnings.filter(w => w.issue === 'under').length
  const overCount  = filteredWarnings.filter(w => w.issue === 'over').length

  const warnPMs = [...new Set(filteredWarnings.map(w => w.pm))]
  const heldPMs = [...new Set(filteredHeld.map(h => h.pm))]

  return (
    <div>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-sand border-b border-sand-3 px-3 py-2 flex flex-wrap items-center gap-3">
        {allPMsInData.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-olive font-medium">Filter PM</label>
            <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="select text-xs">
              <option value="all">All PMs</option>
              {allPMsInData.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
        )}

        {filteredWarnings.length > 0 && (
          <div className="flex items-center gap-2">
            <i className="ti ti-alert-triangle text-warning" style={{ fontSize: 15 }} />
            <span className="text-xs">
              <strong>{filteredWarnings.length} mismatch{filteredWarnings.length !== 1 ? 'es' : ''}</strong>
              {underCount > 0 && <span className="ml-2 text-warning">{underCount} under</span>}
              {overCount  > 0 && <span className="ml-2 text-flag">{overCount} over</span>}
            </span>
          </div>
        )}
      </div>

      {/* Warnings grouped by PM */}
      {filteredWarnings.length > 0 && (
        <div className="mb-2">
          {warnPMs.map(pm => {
            const rows      = filteredWarnings.filter(w => w.pm === pm)
            const pmUnder   = rows.filter(w => w.issue === 'under').length
            const pmOver    = rows.filter(w => w.issue === 'over').length
            const totalGap  = rows.reduce((s, w) => s + Math.abs(w.alloc - w.rem), 0)
            const collapsed = collapsedPMs[pm]

            return (
              <div key={pm}>
                {/* PM header — matches BillingTab / ProjectsTab */}
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] text-white cursor-pointer hover:bg-[#2a2a2a]"
                  onClick={() => togglePM(pm)}
                >
                  <span className="text-2xs opacity-50">{collapsed ? '▸' : '▾'}</span>
                  <span className="text-2xs opacity-60 uppercase tracking-wider">PM</span>
                  <span className="text-sm font-bold flex-1">{pm}</span>
                  <span className="text-2xs opacity-60 mr-2">{rows.length} issue{rows.length !== 1 ? 's' : ''} · gap {fmt(totalGap)}</span>
                  {pmUnder > 0 && <span className="text-2xs px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300 font-semibold">{pmUnder} under</span>}
                  {pmOver  > 0 && <span className="text-2xs px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-semibold">{pmOver} over</span>}
                </div>

                {!collapsed && (
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Phase</th>
                        <th style={{ width: 80 }}>Remaining</th>
                        <th style={{ width: 80 }}>Allocated</th>
                        <th style={{ width: 80 }}>Gap</th>
                        <th style={{ width: 110 }}>Issue</th>
                        <th style={{ width: 60 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((w, i) => {
                        const gap    = w.alloc - w.rem
                        const isOver = w.issue === 'over'
                        return (
                          <tr key={i}>
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
                            <td className="px-2">
                              <button onClick={() => goFix(w)}
                                className="btn btn-sm text-xs text-terracotta border-terracotta/30 hover:bg-terracotta/10"
                                style={{ whiteSpace: 'nowrap' }}>
                                <i className="ti ti-pencil" style={{ fontSize: 12 }} /> Fix
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Held grouped by PM */}
      {filteredHeld.length > 0 && (
        <div className={filteredWarnings.length > 0 ? 'border-t-2 border-sand-3 mt-2' : ''}>
          {/* Held section label */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sand-2 border-b border-sand-3">
            <i className="ti ti-lock text-olive" style={{ fontSize: 13 }} />
            <span className="text-2xs text-olive font-semibold uppercase tracking-wider">On Hold</span>
            <span className="text-2xs text-olive">— excluded from warnings</span>
          </div>

          {heldPMs.map(pm => {
            const rows      = filteredHeld.filter(h => h.pm === pm)
            const key       = 'held_' + pm
            const collapsed = collapsedPMs[key]

            return (
              <div key={pm}>
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] text-white cursor-pointer hover:bg-[#2a2a2a]"
                  onClick={() => togglePM(key)}
                >
                  <span className="text-2xs opacity-50">{collapsed ? '▸' : '▾'}</span>
                  <span className="text-2xs opacity-60 uppercase tracking-wider">PM</span>
                  <span className="text-sm font-bold flex-1">{pm}</span>
                  <span className="text-2xs opacity-60">{rows.length} phase{rows.length !== 1 ? 's' : ''} on hold</span>
                </div>

                {!collapsed && (
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Phase</th>
                        <th style={{ width: 80 }}>Fee</th>
                        <th style={{ width: 80 }}>Remaining</th>
                        <th style={{ width: 160 }}>Hold Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((h, i) => (
                        <tr key={i} style={{ opacity: 0.7 }}>
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
