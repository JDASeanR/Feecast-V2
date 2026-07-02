import { useState } from 'react'
import { clsx, fmt } from '../../lib/utils'

const fmtDate = iso => {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}

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
const autoBucket    = days => days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : days <= 120 ? '90-120' : '120+'
const effBucket     = inv => inv.bucketOverride || autoBucket(invAgeDays(inv))
const AR_COLORS     = { '0-30': '#4ade80', '30-60': '#fde047', '60-90': '#fb923c', '90-120': '#f87171', '120+': '#dc2626' }
const BUCKET_LABELS = { '0-30': 'Current', '30-60': '30–60d', '60-90': '60–90d', '90-120': '90–120d', '120+': '120+d' }

// ── Resolution dialog ─────────────────────────────────────────────────────────
function ResolveDialog({ label, onConfirm, onCancel }) {
  const [note, setNote] = useState('')
  const canSubmit = note.trim().length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(30,26,22,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: '#F5F5F1', borderRadius: 8, width: 440, maxWidth: '90vw',
        border: '0.5px solid rgba(61,57,53,0.2)', padding: '24px 28px',
        boxShadow: 'none',
      }}>
        <div style={{ fontFamily: '"League Gothic",sans-serif', fontSize: 22, letterSpacing: '0.03em', color: '#3D3935', marginBottom: 4 }}>
          Resolve Flag
        </div>
        <div style={{ fontSize: 12, color: '#736F4C', marginBottom: 18 }}>{label}</div>

        <label style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#736F4C', display: 'block', marginBottom: 6 }}>
          Resolution note <span style={{ color: '#BD6439' }}>*</span>
        </label>
        <textarea
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="How was this resolved? What action was taken?"
          rows={3}
          style={{
            width: '100%', borderRadius: 4, border: '1px solid rgba(61,57,53,0.25)',
            background: '#fff', padding: '8px 10px', fontSize: 13, color: '#3D3935',
            resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) onConfirm(note.trim()) }}
        />
        <div style={{ fontSize: 11, color: '#b0aca0', marginTop: 4, marginBottom: 20 }}>
          ⌘↵ to confirm
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ fontSize: 12, padding: '6px 16px', borderRadius: 4, border: '1px solid rgba(61,57,53,0.2)', background: 'transparent', color: '#736F4C', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(note.trim())}
            disabled={!canSubmit}
            style={{
              fontSize: 12, padding: '6px 16px', borderRadius: 4, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? '#BD6439' : '#d4cfc9', color: '#fff', fontWeight: 600,
            }}
          >
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FollowUpTab({ appState, mutate, currentUser }) {
  const { projects, invoices } = appState

  const [resolving, setResolving] = useState(null)
  // resolving = { type: 'proj'|'phase'|'ar', projId, phId, invId, label }

  const flaggedProjects = projects.filter(p => !p.archived && !p.done && (p.flag || p.phases.some(ph => ph.flag)))
  const flaggedAR       = invoices.filter(i => !i.paid && i.flag)

  // Resolved history — projects/phases/invoices that were cleared, most recent first
  const resolvedProjects = projects.flatMap(p => {
    const rows = []
    if (!p.flag && p.flagClearedAt) rows.push({ kind: 'project', label: p.project, sub: p.client, pm: p.pm, clearedBy: p.flagClearedBy, clearedAt: p.flagClearedAt, note: p.flagClearedNote })
    p.phases.forEach(ph => {
      if (!ph.flag && ph.flagClearedAt) rows.push({ kind: 'phase', label: p.project, sub: ph.name, pm: p.pm, clearedBy: ph.flagClearedBy, clearedAt: ph.flagClearedAt, note: ph.flagClearedNote })
    })
    return rows
  })
  const resolvedAR = invoices.filter(i => !i.flag && i.flagClearedAt).map(i => ({
    kind: 'ar', label: i.client, sub: `Invoice ${i.invoiceNo}`, pm: i.pm, clearedBy: i.flagClearedBy, clearedAt: i.flagClearedAt, note: i.flagClearedNote,
  }))
  const resolvedHistory = [...resolvedProjects, ...resolvedAR]
    .sort((a, b) => (b.clearedAt || '').localeCompare(a.clearedAt || ''))

  const stamp = (note) => ({
    flag: false,
    flagClearedNote: note,
    flagClearedBy: currentUser || 'unknown',
    flagClearedAt: new Date().toISOString(),
  })

  const handleResolve = (note) => {
    const { type, projId, phId, invId } = resolving
    if (type === 'proj') {
      mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id === projId ? { ...p, ...stamp(note) } : p) }))
    } else if (type === 'phase') {
      mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id !== projId ? p : {
        ...p, phases: p.phases.map(ph => ph.id !== phId ? ph : { ...ph, ...stamp(note) })
      })}))
    } else if (type === 'ar') {
      mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === invId ? { ...i, ...stamp(note) } : i) }))
    }
    setResolving(null)
  }

  const toggleARFlag = (invId) => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === invId ? { ...i, flag: !i.flag } : i) }))
  }
  const markPaid = (invId) => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === invId ? { ...i, paid: !i.paid } : i) }))
  }

  const isEmpty = !flaggedProjects.length && !flaggedAR.length && !resolvedHistory.length

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <i className="ti ti-circle-check text-success text-4xl mb-3" />
        <div className="font-semibold text-sm">All clear</div>
        <div className="text-xs text-olive mt-1">No follow-up items flagged.</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">

      {resolving && (
        <ResolveDialog
          label={resolving.label}
          onConfirm={handleResolve}
          onCancel={() => setResolving(null)}
        />
      )}

      {/* Flagged projects */}
      {flaggedProjects.length > 0 && (
        <section>
          <div className="text-xs font-semibold text-dark uppercase tracking-wider mb-2">
            Projects ({flaggedProjects.length})
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th style={{ width: 32 }}>PM</th>
                  <th style={{ width: 56 }}>Proj #</th>
                  <th>Project / Client</th>
                  <th style={{ width: 48 }}>Status</th>
                  <th>Flag Note</th>
                  <th style={{ width: 80 }}>Fee</th>
                  <th style={{ width: 80 }}>Remaining</th>
                  <th style={{ width: 72 }}>WIP</th>
                </tr>
              </thead>
              <tbody>
                {flaggedProjects.flatMap(p => {
                  const wipPct = Math.round(pWIP(p) * 100)
                  const flaggedPhases = p.phases.filter(ph => ph.flag)

                  return [
                    <tr key={p.id} className="bg-sand-2/50">
                      <td className="px-1">
                        <button
                          onClick={() => p.flag && setResolving({ type: 'proj', projId: p.id, label: `${p.project} — ${p.client}` })}
                          className={clsx('btn btn-icon btn-sm', p.flag && 'text-flag')}
                          title="Resolve flag"
                        >
                          <i className={clsx('ti', p.flag ? 'ti-flag-filled' : 'ti-flag')} style={{ fontSize: 11 }} />
                        </button>
                      </td>
                      <td className="px-2 text-xs text-olive">{p.pm}</td>
                      <td className="px-2 text-xs text-dark-3">{p.projNo}</td>
                      <td className="px-2">
                        <div className="font-semibold text-xs">{p.project}</div>
                        <div className="text-2xs text-olive">{p.client}</div>
                      </td>
                      <td className="px-2 text-center">
                        <span className="text-2xs bg-sand-2 text-olive px-1.5 py-0.5 rounded">{p.status}</span>
                      </td>
                      <td className="px-2">
                        {p.flag && (
                          <div>
                            {p.flagNewProject
                              ? <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>New Project</span>
                              : p.flagNote && <div className="text-xs">{p.flagNote}</div>
                            }
                            {p.flagBy && (
                              <div className="text-2xs text-olive mt-0.5">
                                {p.flagBy}{p.flagAt ? ' · ' + fmtDate(p.flagAt) : ''}
                              </div>
                            )}
                          </div>
                        )}
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
                    ...flaggedPhases.map(ph => (
                      <tr key={`${p.id}-${ph.id}`} className="opacity-80">
                        <td className="px-1" style={{ paddingLeft: 24 }}>
                          <button
                            onClick={() => setResolving({ type: 'phase', projId: p.id, phId: ph.id, label: `${p.project} · ${ph.name}` })}
                            className="btn btn-icon btn-sm text-flag"
                            title="Resolve flag"
                          >
                            <i className="ti ti-flag-filled" style={{ fontSize: 11 }} />
                          </button>
                        </td>
                        <td className="px-2 text-2xs text-dark-3">{ph.scope}</td>
                        <td />
                        <td className="px-2 text-xs text-olive">{ph.name}</td>
                        <td />
                        <td className="px-2">
                          {ph.flagNote && <div className="text-xs">{ph.flagNote}</div>}
                          {ph.flagBy && (
                            <div className="text-2xs text-olive mt-0.5">
                              {ph.flagBy}{ph.flagAt ? ' · ' + fmtDate(ph.flagAt) : ''}
                            </div>
                          )}
                        </td>
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
                        <button
                          onClick={() => setResolving({ type: 'ar', invId: inv.id, label: `${inv.client} · Invoice ${inv.invoiceNo}` })}
                          className="btn btn-icon btn-sm text-flag"
                          title="Resolve flag"
                        >
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

      {/* Resolved history */}
      {resolvedHistory.length > 0 && (
        <section>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            paddingTop: 8, borderTop: '1px solid rgba(61,57,53,0.1)',
          }}>
            <i className="ti ti-circle-check" style={{ fontSize: 14, color: '#736F4C' }} />
            <div className="text-xs font-semibold text-dark uppercase tracking-wider">
              Resolved ({resolvedHistory.length})
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[700px]">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Type</th>
                  <th>Item</th>
                  <th style={{ width: 36 }}>PM</th>
                  <th>Resolution note</th>
                  <th style={{ width: 160 }}>Resolved by</th>
                  <th style={{ width: 160 }}>Resolved at</th>
                </tr>
              </thead>
              <tbody>
                {resolvedHistory.map((r, i) => (
                  <tr key={i} style={{ opacity: 0.75 }}>
                    <td className="px-2">
                      <span className="text-2xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: 'rgba(115,111,76,0.1)', color: '#736F4C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {r.kind === 'ar' ? 'A/R' : r.kind}
                      </span>
                    </td>
                    <td className="px-2">
                      <div className="text-xs font-semibold">{r.label}</div>
                      {r.sub && <div className="text-2xs text-olive">{r.sub}</div>}
                    </td>
                    <td className="px-2 text-xs text-olive">{r.pm}</td>
                    <td className="px-2 text-xs">{r.note || <span className="text-olive italic">—</span>}</td>
                    <td className="px-2 text-2xs text-olive">{r.clearedBy}</td>
                    <td className="px-2 text-2xs text-olive">{fmtDate(r.clearedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
