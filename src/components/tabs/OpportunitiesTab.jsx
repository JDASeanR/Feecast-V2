import { useState, useCallback } from 'react'
import { fmt, fmtK, clsx, CY, CM, CUR_MK } from '../../lib/utils'

const OPP_STATUSES = ['01 Radar', '02 Proposal Requested', '03 Proposal Sent', '04 Won', '05 Lost']

const confColor = c => c >= 70 ? '#2d7a3a' : c >= 40 ? '#b45309' : '#c0392b'

function blankMonthly() {
  const obj = {}
  for (let i = 0; i < 24; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    obj[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  return obj
}

function buildMonths() {
  const months = []
  for (let i = -3; i < 24; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), isPast: key < CUR_MK })
  }
  return months
}
const ALL_MONTHS = buildMonths()

// ── Main component ────────────────────────────────────────────────────────────
export default function OpportunitiesTab({ appState, mutate }) {
  const { opportunities, settings, projects } = appState
  const pmList   = (settings.pms || []).map(p => p.name)
  const typeList = settings.projectTypes || []

  const [search,      setSearch]      = useState('')
  const [filterPM,    setFilterPM]    = useState('ALL')
  const [filterSt,    setFilterSt]    = useState('active')
  const [editingOpp,  setEditingOpp]  = useState(null)  // null | opp | 'new'
  const [allocOpp,    setAllocOpp]    = useState(null)  // null | opp
  const [convertingOpp, setConvertingOpp] = useState(null)

  // Active opps for summary bar
  const activeOpps  = opportunities.filter(o => !o.archived && o.status !== '04 Won' && o.status !== '05 Lost')
  const totalRaw    = activeOpps.reduce((s, o) => s + (o.fee || 0), 0)
  const totalWtd    = activeOpps.reduce((s, o) => s + (o.fee || 0) * (o.confidence || 50) / 100, 0)
  const byStatus    = Object.fromEntries(OPP_STATUSES.map(s => [s, activeOpps.filter(o => o.status === s).length]))

  // Filtered list
  let filtered = opportunities.filter(o => {
    if (filterSt === 'active') return !o.archived && o.status !== '04 Won' && o.status !== '05 Lost'
    if (filterSt === 'ALL') return true
    return o.status === filterSt
  })
  if (filterPM !== 'ALL') filtered = filtered.filter(o => o.pm === filterPM)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(o =>
      o.name?.toLowerCase().includes(q) ||
      o.client?.toLowerCase().includes(q) ||
      (o.pm || '').toLowerCase().includes(q))
  }

  // Sort by type order then confidence desc
  const typeOrder = typeList.map(t => t.code)
  filtered = [...filtered].sort((a, b) => {
    const ta = typeOrder.indexOf(a.type || 'SFD'), tb = typeOrder.indexOf(b.type || 'SFD')
    if (ta !== tb) return ta - tb
    return (b.confidence || 50) - (a.confidence || 50)
  })

  // Group by type
  const typeGroups = {}; const typeGroupOrder = []
  filtered.forEach(o => {
    const t = o.type || 'SFD'
    if (!typeGroups[t]) { typeGroups[t] = []; typeGroupOrder.push(t) }
    typeGroups[t].push(o)
  })

  // ── Mutate helpers ────────────────────────────────────────────────────────
  const saveOpp = useCallback(opp => {
    mutate(prev => {
      const exists = prev.opportunities.find(o => o.id === opp.id)
      return {
        ...prev,
        opportunities: exists
          ? prev.opportunities.map(o => o.id === opp.id ? opp : o)
          : [...prev.opportunities, { ...opp, id: prev.nextId, monthly: opp.monthly || blankMonthly() }],
        nextId: exists ? prev.nextId : prev.nextId + 1,
      }
    })
    setEditingOpp(null)
  }, [mutate])

  const updateOppField = useCallback((id, field, value) => {
    mutate(prev => ({
      ...prev,
      opportunities: prev.opportunities.map(o => {
        if (o.id !== id) return o
        const updated = { ...o, [field]: value }
        // Prompt for lost reason
        if (field === 'status' && value === '05 Lost') {
          const reason = prompt('Reason for losing this opportunity (optional):')
          updated.lostReason = reason?.trim() || 'No reason provided'
        }
        return updated
      })
    }))
  }, [mutate])

  const toggleFlag    = id => mutate(prev => ({ ...prev, opportunities: prev.opportunities.map(o => o.id === id ? { ...o, flag: !o.flag } : o) }))
  const toggleArchive = id => mutate(prev => ({ ...prev, opportunities: prev.opportunities.map(o => o.id === id ? { ...o, archived: !o.archived } : o) }))

  const saveAlloc = useCallback((id, monthly) => {
    mutate(prev => ({ ...prev, opportunities: prev.opportunities.map(o => o.id === id ? { ...o, monthly } : o) }))
    setAllocOpp(null)
  }, [mutate])

  const convertToProject = useCallback((opp) => {
    setConvertingOpp(opp)
  }, [])

  const finishConvert = useCallback((projectData) => {
    mutate(prev => {
      const newId = prev.nextId
      const phases = projectData.phases.map((ph, i) => ({ ...ph, id: newId + i + 1 }))
      return {
        ...prev,
        projects: [...prev.projects, { ...projectData, id: newId, phases }],
        opportunities: prev.opportunities.map(o =>
          o.id === convertingOpp.id ? { ...o, status: '04 Won' } : o
        ),
        nextId: newId + phases.length + 1,
      }
    })
    setConvertingOpp(null)
  }, [mutate, convertingOpp])

  return (
    <div className="flex flex-col h-full overflow-auto p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-semibold text-sm">Opportunities Pipeline</div>
          <div className="text-xs text-olive mt-0.5">
            {activeOpps.length} active · Raw: {fmtK(totalRaw)} ·{' '}
            <span className="font-semibold text-terracotta">Weighted: {fmtK(totalWtd)}</span>
          </div>
        </div>
        <button onClick={() => setEditingOpp('new')} className="btn btn-primary text-xs">
          <i className="ti ti-plus" /> New opportunity
        </button>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {OPP_STATUSES.slice(0, 3).map(s => (
          <button key={s}
            onClick={() => setFilterSt(filterSt === s ? 'active' : s)}
            className={clsx(
              'text-center px-3 py-2 rounded border text-xs transition-colors',
              filterSt === s ? 'border-terracotta bg-terracotta/10' : 'border-sand-3 bg-sand-2'
            )}
          >
            <div className="text-lg font-bold text-terracotta leading-none">{byStatus[s] || 0}</div>
            <div className="text-2xs text-olive mt-0.5">{s}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="text" placeholder="Search…" value={search}
          onChange={e => setSearch(e.target.value)} className="input w-40 text-xs" />
        <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All PMs</option>
          {pmList.map(pm => <option key={pm}>{pm}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All statuses</option>
          <option value="active">Active only</option>
          {OPP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full min-w-[800px]">
          <thead>
            <tr>
              <th style={{ width: 60 }} />
              <th style={{ width: 32 }}>PM</th>
              <th>Opportunity / Client</th>
              <th style={{ width: 130 }}>Stage</th>
              <th style={{ width: 80 }}>Est. Fee</th>
              <th style={{ width: 52 }}>Type</th>
              <th style={{ width: 140 }}>Confidence</th>
              <th style={{ width: 80 }}>Wtd Value</th>
              <th style={{ width: 80 }}>Allocation</th>
              <th style={{ width: 80 }}>Target Start</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {typeGroupOrder.length === 0 && (
              <tr><td colSpan={11} className="py-8 text-center text-sm text-olive">
                No opportunities found.
              </td></tr>
            )}
            {typeGroupOrder.map(type => {
              const typeOpps   = typeGroups[type]
              const typeLabel  = typeList.find(t => t.code === type)?.label || type
              const typeFee    = typeOpps.reduce((s, o) => s + (o.fee || 0), 0)
              const typeWtd    = typeOpps.reduce((s, o) => s + Math.round((o.fee || 0) * (o.confidence || 50) / 100), 0)

              return [
                // Type header
                <tr key={`type-${type}`} className="text-vellum" style={{ background: "#3D3935", pointerEvents: "none" }}>
                  <td colSpan={3} className="px-3 py-2">
                    <span className="font-display text-sm tracking-wide">
                      <span className="opacity-50 text-xs mr-2">TYPE</span>
                      {type} — {typeLabel}
                      <span className="font-sans font-normal opacity-50 text-xs ml-2">
                        {typeOpps.length} opportunit{typeOpps.length !== 1 ? 'ies' : 'y'}
                      </span>
                    </span>
                  </td>
                  <td />
                  <td className="px-2 text-right text-xs opacity-70">{fmt(typeFee)}</td>
                  <td colSpan={2} />
                  <td className="px-2 text-right text-xs font-semibold text-terracotta-light">{fmt(typeWtd)}</td>
                  <td colSpan={3} />
                </tr>,

                // Opp rows
                ...typeOpps.map(o => {
                  const conf      = o.confidence || 50
                  const allocTotal = ALL_MONTHS.reduce((s, m) => s + (o.monthly?.[m.key] || 0), 0)
                  const wtd       = Math.round((o.fee || 0) * conf / 100)
                  const isDone    = o.archived || o.status === '04 Won' || o.status === '05 Lost'

                  return (
                    <tr key={o.id} className={clsx(isDone && 'opacity-40')}>
                      {/* Controls */}
                      <td className="px-1">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => toggleFlag(o.id)}
                            className={clsx('btn btn-icon btn-sm', o.flag && 'text-flag')}>
                            <i className={clsx('ti', o.flag ? 'ti-flag-filled' : 'ti-flag')} style={{ fontSize: 11 }} />
                          </button>
                          <button onClick={() => toggleArchive(o.id)}
                            className="btn btn-icon btn-sm text-olive">
                            <i className={clsx('ti', o.archived ? 'ti-archive-off' : 'ti-archive')} style={{ fontSize: 11 }} />
                          </button>
                        </div>
                      </td>

                      {/* PM */}
                      <td className="px-2 text-xs text-olive">{o.pm}</td>

                      {/* Name / client */}
                      <td className="px-2">
                        <div className="font-semibold text-xs truncate max-w-[180px]">{o.name}</div>
                        <div className="text-2xs text-olive">{o.client}</div>
                      </td>

                      {/* Stage dropdown */}
                      <td className="px-1">
                        <select
                          value={o.status}
                          onChange={e => updateOppField(o.id, 'status', e.target.value)}
                          className="text-2xs border border-sand-3 rounded px-1 py-0.5 bg-sand w-full"
                        >
                          {OPP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Fee */}
                      <td className="px-2 text-xs font-semibold">{fmt(o.fee || 0)}</td>

                      {/* Type */}
                      <td className="px-2 text-center">
                        <span className="text-2xs bg-sand-2 text-olive px-1.5 py-0.5 rounded">{o.type || 'SFD'}</span>
                      </td>

                      {/* Confidence slider */}
                      <td className="px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={100} step={5}
                            value={conf}
                            onChange={e => updateOppField(o.id, 'confidence', parseInt(e.target.value))}
                            className="flex-1 h-1 rounded appearance-none cursor-pointer"
                            style={{ accentColor: confColor(conf) }}
                          />
                          <span className="text-xs font-semibold w-8 text-right" style={{ color: confColor(conf) }}>
                            {conf}%
                          </span>
                        </div>
                      </td>

                      {/* Weighted value */}
                      <td className="px-2 text-xs font-semibold text-terracotta">{fmtK(wtd)}</td>

                      {/* Allocation */}
                      <td className="px-1">
                        <button
                          onClick={() => setAllocOpp(o)}
                          className={clsx('btn btn-sm text-2xs', allocTotal > 0 && 'text-blue-600 border-blue-200')}
                        >
                          <i className="ti ti-calendar-stats" style={{ fontSize: 11 }} />
                          {allocTotal > 0 ? fmtK(allocTotal) : 'Allocate'}
                        </button>
                      </td>

                      {/* Target start */}
                      <td className="px-2 text-xs text-olive">
                        {o.targetStart
                          ? new Date(o.targetStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-1">
                        <div className="flex gap-0.5">
                          <button onClick={() => setEditingOpp(o)} className="btn btn-icon btn-sm">
                            <i className="ti ti-edit" style={{ fontSize: 11 }} />
                          </button>
                          {o.status !== '04 Won' && o.status !== '05 Lost' && (
                            <button onClick={() => convertToProject(o)}
                              className="btn btn-icon btn-sm text-success" title="Convert to project">
                              <i className="ti ti-arrow-right" style={{ fontSize: 11 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modals ── */}
      {editingOpp && (
        <OppModal
          opp={editingOpp === 'new' ? null : editingOpp}
          settings={settings}
          onSave={saveOpp}
          onClose={() => setEditingOpp(null)}
        />
      )}

      {allocOpp && (
        <OppAllocModal
          opp={allocOpp}
          onSave={saveAlloc}
          onClose={() => setAllocOpp(null)}
        />
      )}

      {convertingOpp && (
        <ConvertModal
          opp={convertingOpp}
          settings={settings}
          onSave={finishConvert}
          onClose={() => setConvertingOpp(null)}
        />
      )}
    </div>
  )
}

// ── OppModal ──────────────────────────────────────────────────────────────────
function OppModal({ opp: ex, settings, onSave, onClose }) {
  const pmList   = (settings.pms || []).map(p => p.name)
  const typeList = settings.projectTypes || []

  const [form, setForm] = useState(ex ? { ...ex } : {
    pm: pmList[0] || '', name: '', client: '', type: typeList[0]?.code || 'SFD',
    fee: 0, confidence: 50, status: '01 Radar', targetStart: '', notes: '', flag: false
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal title={ex ? 'Edit opportunity' : 'New opportunity'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">PM</label>
          <select value={form.pm} onChange={e => set('pm', e.target.value)} className="select text-xs w-full">
            {pmList.map(pm => <option key={pm}>{pm}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Stage</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="select text-xs w-full">
            {OPP_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="field-label">Client</label>
          <input value={form.client} onChange={e => set('client', e.target.value)} className="input text-xs w-full" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Opportunity name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="field-label">Project type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} className="select text-xs w-full">
            {typeList.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Target start</label>
          <input type="date" value={form.targetStart || ''} onChange={e => set('targetStart', e.target.value)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="field-label">Estimated fee ($)</label>
          <input type="number" value={form.fee || 0} min={0} step={1000}
            onChange={e => set('fee', parseFloat(e.target.value) || 0)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="field-label">Confidence: <strong>{form.confidence || 50}%</strong></label>
          <input type="range" min={0} max={100} step={5} value={form.confidence || 50}
            onChange={e => set('confidence', parseInt(e.target.value))}
            className="w-full mt-1" style={{ accentColor: confColor(form.confidence || 50) }} />
        </div>
        <div className="col-span-2">
          <label className="field-label">Notes</label>
          <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
            className="input text-xs w-full h-16 resize-y" />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={form.flag || false} onChange={e => set('flag', e.target.checked)} />
            Follow-up flag
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-sand-2">
        {ex && (
          <button onClick={() => { if (confirm('Delete this opportunity?')) onSave(null) }}
            className="btn text-xs text-flag mr-auto">
            <i className="ti ti-trash" /> Delete
          </button>
        )}
        <button onClick={onClose} className="btn text-xs">Cancel</button>
        <button onClick={() => onSave(form)} className="btn btn-primary text-xs">
          <i className="ti ti-device-floppy" /> Save
        </button>
      </div>
    </Modal>
  )
}

// ── OppAllocModal ─────────────────────────────────────────────────────────────
function OppAllocModal({ opp, onSave, onClose }) {
  const [monthly, setMonthly] = useState({ ...opp.monthly })

  const fee       = opp.fee || 0
  const conf      = opp.confidence || 50
  const allocated = ALL_MONTHS.reduce((s, m) => s + (monthly[m.key] || 0), 0)
  const wtdAlloc  = Math.round(allocated * conf / 100)
  const pctAlloc  = fee > 0 ? Math.round(allocated / fee * 100) : 0
  const barColor  = pctAlloc >= 100 ? '#2d7a3a' : pctAlloc > 0 ? '#BD6439' : '#dedad0'

  const setMoPct = (mk, pct) => {
    setMonthly(prev => ({ ...prev, [mk]: fee > 0 ? Math.round(fee * pct / 100) : 0 }))
  }

  const splitEvenly = () => {
    const futureMos = ALL_MONTHS.filter(m => m.key >= CUR_MK)
    const perMo = futureMos.length > 0 ? Math.round(fee / futureMos.length) : 0
    const next = { ...monthly }
    futureMos.forEach(m => { next[m.key] = perMo })
    setMonthly(next)
  }

  const clearAlloc = () => {
    const next = { ...monthly }
    ALL_MONTHS.filter(m => m.key >= CUR_MK).forEach(m => { next[m.key] = 0 })
    setMonthly(next)
  }

  const visMos = ALL_MONTHS.filter(m => (monthly[m.key] || 0) > 0 || m.key >= CUR_MK)

  return (
    <Modal title={`${opp.name} — Allocation`} onClose={onClose} wide>
      <div className="text-xs text-olive mb-2">
        Est. fee: <strong>{fmt(fee)}</strong> · Confidence: <strong>{conf}%</strong>
      </div>
      <div className="flex gap-4 text-xs mb-2">
        <span>Allocated: <strong>{fmt(allocated)}</strong> <span className="text-dark-3">({pctAlloc}%)</span></span>
        <span className="text-terracotta">Weighted ({conf}%): <strong>{fmt(wtdAlloc)}</strong></span>
        <span className="text-dark-3">Remaining: <strong>{fmt(fee - allocated)}</strong></span>
      </div>
      <div className="progress-bar mb-3">
        <div className="progress-bar-fill" style={{ width: Math.min(100, pctAlloc) + '%', background: barColor }} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {visMos.map(m => {
          const val = monthly[m.key] || 0
          const pct = fee > 0 ? Math.round(val / fee * 1000) / 10 : 0
          const wtd = Math.round(val * conf / 100)
          return (
            <div key={m.key} className={clsx(
              'border rounded px-2 py-1.5 text-center',
              pct > 0 ? 'border-terracotta/50 bg-terracotta/5' : 'border-sand-3 bg-sand',
              m.key === CUR_MK && 'ring-1 ring-terracotta'
            )}>
              <div className="text-2xs text-olive mb-1">{m.label}</div>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={100} step={5}
                  defaultValue={pct > 0 ? pct : ''}
                  placeholder="0"
                  onChange={e => setMoPct(m.key, parseFloat(e.target.value) || 0)}
                  className="w-12 text-center text-xs border border-sand-3 rounded px-1 py-0.5 focus:outline-none focus:border-terracotta"
                />
                <span className="text-2xs text-dark-3">%</span>
              </div>
              <div className="text-2xs text-olive mt-0.5">{val > 0 ? fmt(val) : '—'}</div>
              {pct > 0 && <div className="text-2xs text-terracotta">wtd: {fmt(wtd)}</div>}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-3 border-t border-sand-2">
        <button onClick={splitEvenly} className="btn text-xs">Split evenly</button>
        <button onClick={clearAlloc} className="btn text-xs">Clear</button>
        <button onClick={() => onSave(opp.id, monthly)} className="btn btn-primary text-xs ml-auto">
          <i className="ti ti-device-floppy" /> Save
        </button>
      </div>
    </Modal>
  )
}

// ── ConvertModal ──────────────────────────────────────────────────────────────
function ConvertModal({ opp, settings, onSave, onClose }) {
  const pmList    = (settings.pms || []).map(p => p.name)
  const scopeList = settings.scopeTypes || []
  const statusList = settings.statusTypes || []
  const typeList  = settings.projectTypes || []
  const clients   = settings.clients || []

  const [form, setForm] = useState({
    pm: opp.pm || pmList[0] || '',
    projNo: '', client: opp.client || '',
    project: opp.name || '',
    type: opp.type || typeList[0]?.code || 'SFD',
    location: 'CA', status: statusList[0]?.code || 'U',
    flag: false, notes: '',
    phases: [{ id: null, name: '', scope: scopeList[0]?.code || 'SD', fee: opp.fee || 0, billed: 0, pct: 0, done: false, flag: false, monthly: {} }]
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal title="Convert to Project" onClose={onClose} wide>
      <div className="bg-terracotta/10 border border-terracotta/30 rounded px-3 py-2 mb-4 text-xs text-terracotta">
        <strong>Converting:</strong> {opp.name} · Est. fee {fmt(opp.fee || 0)} · {opp.confidence || 50}% confidence
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">PM</label>
          <select value={form.pm} onChange={e => set('pm', e.target.value)} className="select text-xs w-full">
            {pmList.map(pm => <option key={pm}>{pm}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Project #</label>
          <input value={form.projNo} onChange={e => set('projNo', e.target.value)} placeholder="Assign project number" className="input text-xs w-full" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Client</label>
          <input value={form.client} onChange={e => set('client', e.target.value)} className="input text-xs w-full" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Project name</label>
          <input value={form.project} onChange={e => set('project', e.target.value)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} className="select text-xs w-full">
            {typeList.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="select text-xs w-full">
            {statusList.map(s => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 text-xs text-olive bg-sand-2 rounded px-3 py-2">
        Phase allocations start blank — define your phase structure and enter allocations in the Billing tab after saving.
      </div>
      <div className="flex gap-2 pt-3 mt-3 border-t border-sand-2">
        <button onClick={onClose} className="btn text-xs">Cancel</button>
        <button onClick={() => onSave(form)} className="btn btn-primary text-xs ml-auto">
          <i className="ti ti-arrow-right" /> Convert to Project
        </button>
      </div>
    </Modal>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50">
      <div className={clsx(
        'bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] w-full',
        wide ? 'max-w-2xl' : 'max-w-lg'
      )}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-sand-2 shrink-0">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="btn btn-icon btn-sm"><i className="ti ti-x" /></button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  )
}
