import { useState, useCallback } from 'react'
import { fmt, fmtK, clsx, useLocalPref } from '../../lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
const AR_BUCKETS = ['0-30', '30-60', '60-90', '90-120', '120+']
const AR_COLORS  = { '0-30': '#4ade80', '30-60': '#fde047', '60-90': '#fb923c', '90-120': '#f87171', '120+': '#dc2626' }
const BUCKET_LABELS = { '0-30': 'Current (0–30 days)', '30-60': '30–60 Days', '60-90': '60–90 Days', '90-120': '90–120 Days', '120+': '120+ Days' }

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (inv.invoiceDate) return Math.max(0, Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / 86400000) - 30)
  return 0
}

const autoBucket = days => days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : days <= 120 ? '90-120' : '120+'
const effBucket  = inv => inv.bucketOverride || autoBucket(invAgeDays(inv))

function invDateLabel(inv) {
  const ino = String(inv.invoiceNo || '')
  if (ino.length >= 6) {
    const yr = ino.slice(0, 4), mo = +ino.slice(4, 6)
    if (+yr > 2000 && mo >= 1 && mo <= 12)
      return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo - 1] + ' ' + yr
  }
  return inv.invoiceDate || '—'
}

// ── ARTab ─────────────────────────────────────────────────────────────────────
export default function ARTab({ appState, mutate }) {
  const { invoices, settings } = appState
  const pmList = (settings.pms || []).map(p => p.name)

  const [search,     setSearch]    = useState('')
  const [filterPM,   setFilterPM]  = useLocalPref('ar.filterPM', 'ALL')
  const [filterBucket, setFilterBucket] = useLocalPref('ar.filterBucket', 'ALL')
  const [showPaid,   setShowPaid]  = useLocalPref('ar.showPaid', false)
  const [showFlagged, setShowFlagged] = useLocalPref('ar.showFlagged', false)
  const [sortKey,    setSortKey]   = useLocalPref('ar.sortKey', 'days')
  const [sortDir,    setSortDir]   = useLocalPref('ar.sortDir', -1)
  const [editingInv, setEditingInv] = useState(null)

  const open    = invoices.filter(i => !i.paid)
  const paidCt  = invoices.filter(i => i.paid).length
  const flagCt  = open.filter(i => i.flag).length

  // Bucket totals
  const bucketTotals = {}, bucketCounts = {}
  AR_BUCKETS.forEach(b => { bucketTotals[b] = 0; bucketCounts[b] = 0 })
  open.forEach(i => { const b = effBucket(i); bucketTotals[b] += i.amount || 0; bucketCounts[b]++ })
  const tot    = Object.values(bucketTotals).reduce((s, v) => s + v, 0)
  const pastDue = tot - (bucketTotals['0-30'] || 0)
  const totNC  = open.filter(i => !i.committed).reduce((s, i) => s + (i.amount || 0), 0)
  const totC   = open.filter(i => i.committed).reduce((s, i) => s + (i.amount || 0), 0)

  // Donut chart
  const R = 32, cx = 44, cy = 44, circ = 2 * Math.PI * R
  let off = 0
  const segs = AR_BUCKETS.map(b => {
    const p = tot > 0 ? (bucketTotals[b] || 0) / tot : 0
    const len = p * circ
    const s = { b, len, off, color: AR_COLORS[b] }
    off += len
    return s
  }).filter(s => s.len > 0)

  // Filter list
  let list = showPaid ? invoices.filter(i => i.paid) : [...open]
  if (filterPM !== 'ALL')     list = list.filter(i => i.pm === filterPM)
  if (filterBucket !== 'ALL') list = list.filter(i => effBucket(i) === filterBucket)
  if (showFlagged)            list = list.filter(i => i.flag)
  if (search) {
    const q = search.toLowerCase()
    list = list.filter(i =>
      i.client?.toLowerCase().includes(q) ||
      i.project?.toLowerCase().includes(q) ||
      String(i.invoiceNo || '').includes(q) ||
      (i.pm || '').toLowerCase().includes(q))
  }

  // Sort
  list = [...list].sort((a, b) => {
    if (sortKey === 'days')   return sortDir * (invAgeDays(b) - invAgeDays(a))
    if (sortKey === 'amount') return sortDir * ((b.amount || 0) - (a.amount || 0))
    if (sortKey === 'client') return sortDir * (a.client || '').localeCompare(b.client || '')
    if (sortKey === 'pm')     return sortDir * (a.pm || '').localeCompare(b.pm || '')
    if (sortKey === 'status') return sortDir * (a.status || '').localeCompare(b.status || '')
    return invAgeDays(b) - invAgeDays(a)
  })

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(-1) }
  }
  const sortIcon = key => sortKey === key ? (sortDir === -1 ? ' ↓' : ' ↑') : ''

  // ── Mutate helpers ────────────────────────────────────────────────────────
  const saveInv = useCallback(inv => {
    mutate(prev => {
      const exists = prev.invoices.find(i => i.id === inv.id)
      return {
        ...prev,
        invoices: exists
          ? prev.invoices.map(i => i.id === inv.id ? inv : i)
          : [...prev.invoices, { ...inv, id: prev.nextId }],
        nextId: exists ? prev.nextId : prev.nextId + 1,
      }
    })
    setEditingInv(null)
  }, [mutate])

  const markPaid = useCallback(id => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === id ? { ...i, paid: !i.paid } : i) }))
  }, [mutate])

  const toggleFlag = useCallback(id => {
    mutate(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === id ? { ...i, flag: !i.flag } : i) }))
  }, [mutate])

  // Grouped view (no filters active)
  const isGrouped = filterBucket === 'ALL' && !showPaid && !search && filterPM === 'ALL' && !showFlagged

  return (
    <div className="flex flex-col h-full overflow-auto p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm">A/R Collections</div>
        <button onClick={() => setEditingInv('new')} className="btn btn-primary text-xs">
          <i className="ti ti-plus" /> Add invoice
        </button>
      </div>

      {/* Visual summary */}
      <div className="flex items-center gap-6 mb-4 p-4 bg-white rounded-lg border border-sand-3 flex-wrap">
        {/* Donut */}
        <div className="relative shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#eceae3" strokeWidth="13" />
            {segs.map((s, i) => (
              <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                stroke={s.color} strokeWidth="13"
                strokeDasharray={`${s.len} ${circ - s.len}`}
                strokeDashoffset={-s.off + circ / 4}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-xs font-bold">{fmtK(tot)}</div>
            <div className="text-2xs text-olive">total A/R</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          {AR_BUCKETS.map(b => {
            const amt = bucketTotals[b] || 0, cnt = bucketCounts[b] || 0
            const pct = tot > 0 ? Math.round(amt / tot * 100) : 0
            return (
              <button key={b}
                onClick={() => setFilterBucket(filterBucket === b ? 'ALL' : b)}
                className={clsx(
                  'flex items-center gap-2 text-xs px-2 py-0.5 rounded transition-colors text-left',
                  filterBucket === b ? 'bg-sand-2' : 'hover:bg-sand'
                )}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: AR_COLORS[b] }} />
                <span className="flex-1 text-olive">{BUCKET_LABELS[b]}</span>
                <span className="font-semibold">{fmt(amt)}</span>
                <span className="text-dark-3 text-2xs">{pct}%·{cnt}</span>
              </button>
            )
          })}
        </div>

        {/* Stats */}
        <div className="flex gap-6 ml-auto">
          <div className="text-right">
            <div className="text-2xs text-olive mb-0.5">Past due</div>
            <div className="text-lg font-bold text-flag">{fmt(pastDue)}</div>
            <div className="text-2xs text-olive mt-2 mb-0.5">Current</div>
            <div className="text-base font-bold text-success">{fmt(bucketTotals['0-30'] || 0)}</div>
          </div>
          <div className="text-right border-l border-sand-3 pl-6">
            <div className="text-2xs text-olive mb-0.5">No Commitment</div>
            <div className="text-lg font-bold text-terracotta">{fmt(totNC)}</div>
            <div className="text-2xs text-olive mt-2 mb-0.5">Commitment</div>
            <div className="text-base font-bold text-olive">{fmt(totC)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="text" placeholder="Search…" value={search}
          onChange={e => setSearch(e.target.value)} className="input w-40 text-xs" />
        <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All PMs</option>
          {pmList.map(pm => <option key={pm}>{pm}</option>)}
        </select>
        <select value={filterBucket} onChange={e => setFilterBucket(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All buckets</option>
          {AR_BUCKETS.map(b => <option key={b} value={b}>{BUCKET_LABELS[b]}</option>)}
        </select>
        <button onClick={() => setShowFlagged(p => !p)}
          className={clsx('btn text-xs', showFlagged && 'btn-active text-flag')}>
          <i className={clsx('ti', showFlagged ? 'ti-flag-filled' : 'ti-flag')} />
          {flagCt > 0 && ` ${flagCt}`}
        </button>
        <button onClick={() => setShowPaid(p => !p)}
          className={clsx('btn text-xs', showPaid && 'btn-active')}>
          {showPaid ? 'Hide paid' : `Paid (${paidCt})`}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full min-w-[800px]">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th style={{ width: 28 }} />
              <th onClick={() => toggleSort('client')} className="cursor-pointer hover:text-dark">
                Client / Project{sortIcon('client')}
              </th>
              <th onClick={() => toggleSort('pm')} className="cursor-pointer hover:text-dark" style={{ width: 36 }}>
                PM{sortIcon('pm')}
              </th>
              <th style={{ width: 80 }}>Invoice</th>
              <th style={{ width: 56 }}>Proj #</th>
              <th onClick={() => toggleSort('amount')} className="cursor-pointer hover:text-dark text-right" style={{ width: 80 }}>
                Amount{sortIcon('amount')}
              </th>
              <th style={{ width: 80 }}>Inv. Date</th>
              <th onClick={() => toggleSort('days')} className="cursor-pointer hover:text-dark" style={{ width: 110 }}>
                Age{sortIcon('days')}
              </th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer hover:text-dark" style={{ width: 150 }}>
                Status{sortIcon('status')}
              </th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={11} className="py-8 text-center text-sm text-olive">No invoices match filters</td></tr>
            )}
            {isGrouped
              ? AR_BUCKETS.map(b => {
                  const grp = list.filter(i => effBucket(i) === b)
                  if (!grp.length) return null
                  return [
                    <tr key={`hdr-${b}`}>
                      <td colSpan={11} className="px-3 py-1.5 bg-sand-2 text-2xs font-semibold text-olive uppercase tracking-wider border-t border-sand-3">
                        <span style={{ color: AR_COLORS[b] }}>●</span> {BUCKET_LABELS[b]} — {grp.length} invoice{grp.length !== 1 ? 's' : ''} · {fmt(bucketTotals[b] || 0)}
                      </td>
                    </tr>,
                    ...grp.map(inv => <InvoiceRow key={inv.id} inv={inv} onPaid={markPaid} onFlag={toggleFlag} onEdit={setEditingInv} />)
                  ]
                })
              : list.map(inv => <InvoiceRow key={inv.id} inv={inv} onPaid={markPaid} onFlag={toggleFlag} onEdit={setEditingInv} />)
            }
          </tbody>
        </table>
      </div>

      {editingInv && (
        <InvoiceModal
          inv={editingInv === 'new' ? null : editingInv}
          settings={settings}
          onSave={saveInv}
          onDelete={id => { mutate(prev => ({ ...prev, invoices: prev.invoices.filter(i => i.id !== id) })); setEditingInv(null) }}
          onClose={() => setEditingInv(null)}
        />
      )}
    </div>
  )
}

// ── InvoiceRow ────────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onPaid, onFlag, onEdit }) {
  const bucket = effBucket(inv)
  const days   = invAgeDays(inv)

  const bucketBg = {
    '0-30': 'bg-green-50', '30-60': 'bg-yellow-50',
    '60-90': 'bg-orange-50', '90-120': 'bg-red-50', '120+': 'bg-red-100'
  }

  return (
    <tr className={clsx(inv.paid && 'opacity-40')}>
      {/* Paid toggle */}
      <td className="px-1">
        <button onClick={() => onPaid(inv.id)}
          className={clsx('btn btn-icon btn-sm', !inv.paid && 'text-success')}
          title={inv.paid ? 'Mark unpaid' : 'Mark paid'}>
          <i className={clsx('ti', inv.paid ? 'ti-archive-off' : 'ti-check')} style={{ fontSize: 11 }} />
        </button>
      </td>
      {/* Flag */}
      <td className="px-1">
        <button onClick={() => onFlag(inv.id)}
          className={clsx('btn btn-icon btn-sm', inv.flag && 'text-flag')}>
          <i className={clsx('ti', inv.flag ? 'ti-flag-filled' : 'ti-flag')} style={{ fontSize: 11 }} />
        </button>
      </td>
      {/* Client / project */}
      <td className="px-2">
        <div className="font-semibold text-xs truncate max-w-[160px]">{inv.client}</div>
        <div className="text-2xs text-olive truncate max-w-[160px]">{inv.project}</div>
      </td>
      <td className="px-2 text-xs text-olive">{inv.pm}</td>
      <td className="px-2 text-xs">{inv.invoiceNo}</td>
      <td className="px-2 text-2xs text-dark-3">{inv.projectNo}</td>
      <td className="px-2 text-right text-xs font-semibold">{fmt(inv.amount)}</td>
      <td className="px-2 text-xs text-olive">{invDateLabel(inv)}</td>
      {/* Age bucket */}
      <td className="px-2">
        {inv.paid
          ? <span className="text-2xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Paid</span>
          : <div className="flex items-center gap-1">
              <span className={clsx('text-2xs px-1.5 py-0.5 rounded font-semibold', bucketBg[bucket])}
                style={{ color: AR_COLORS[bucket] }}>
                {BUCKET_LABELS[bucket].split(' ')[0]}
              </span>
              <span className="text-2xs text-dark-3">{days}d</span>
            </div>
        }
      </td>
      {/* Status */}
      <td className="px-2">
        {inv.committed && !inv.paid && (
          <div className="flex items-center gap-1 text-2xs text-olive mb-0.5">
            <i className="ti ti-calendar-check" style={{ fontSize: 10 }} />
            {inv.committedDate && <span>{inv.committedDate}</span>}
          </div>
        )}
        {inv.status && <div className="text-2xs text-dark-3 truncate max-w-[140px]">{inv.status}</div>}
      </td>
      <td className="px-1">
        <button onClick={() => onEdit(inv)} className="btn btn-icon btn-sm">
          <i className="ti ti-edit" style={{ fontSize: 11 }} />
        </button>
      </td>
    </tr>
  )
}

// ── InvoiceModal ──────────────────────────────────────────────────────────────
function InvoiceModal({ inv: ex, settings, onSave, onDelete, onClose }) {
  const pmList = (settings.pms || []).map(p => p.name)

  const [form, setForm] = useState(ex ? { ...ex } : {
    invoiceNo: '', client: '', project: '', projectNo: '',
    pm: pmList[0] || '', amount: '', invoiceDate: '',
    bucketOverride: null, committed: false, committedDate: '',
    flag: false, status: ''
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const days = form.invoiceDate ? Math.max(0, Math.floor((Date.now() - new Date(form.invoiceDate).getTime()) / 86400000) - 30) : null
  const autoBucketLabel = days !== null ? BUCKET_LABELS[autoBucket(days)] : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-sand-2 shrink-0">
          <h2 className="font-semibold text-sm">{ex ? 'Edit invoice' : 'New invoice'}</h2>
          <button onClick={onClose} className="btn btn-icon btn-sm"><i className="ti ti-x" /></button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Invoice #</label>
              <input value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} className="input text-xs w-full" />
            </div>
            <div>
              <label className="field-label">PM</label>
              <select value={form.pm} onChange={e => set('pm', e.target.value)} className="select text-xs w-full">
                {pmList.map(pm => <option key={pm}>{pm}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="field-label">Client</label>
              <input value={form.client} onChange={e => set('client', e.target.value)} className="input text-xs w-full" />
            </div>
            <div className="col-span-2">
              <label className="field-label">Project</label>
              <input value={form.project} onChange={e => set('project', e.target.value)} className="input text-xs w-full" />
            </div>
            <div>
              <label className="field-label">Project #</label>
              <input value={form.projectNo || ''} onChange={e => set('projectNo', e.target.value)} className="input text-xs w-full" />
            </div>
            <div>
              <label className="field-label">Amount ($)</label>
              <input type="number" value={form.amount || ''} min={0} step={0.01}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)} className="input text-xs w-full" />
            </div>
            <div>
              <label className="field-label">Invoice date</label>
              <input type="date" value={form.invoiceDate || ''} onChange={e => set('invoiceDate', e.target.value)} className="input text-xs w-full" />
            </div>
            <div>
              <label className="field-label">Bucket override</label>
              <select value={form.bucketOverride || ''} onChange={e => set('bucketOverride', e.target.value || null)} className="select text-xs w-full">
                <option value="">Auto ({autoBucketLabel})</option>
                {AR_BUCKETS.map(b => <option key={b} value={b}>{BUCKET_LABELS[b]}</option>)}
              </select>
            </div>
            <div className="col-span-2 bg-sand rounded p-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer mb-2">
                <input type="checkbox" checked={form.committed || false} onChange={e => set('committed', e.target.checked)} />
                Client has committed to pay
              </label>
              {form.committed && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-olive">Payment promised by:</span>
                  <input type="date" value={form.committedDate || ''} onChange={e => set('committedDate', e.target.value)} className="input text-xs flex-1" />
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="field-label">Status / notes</label>
              <textarea value={form.status || ''} onChange={e => set('status', e.target.value)}
                className="input text-xs w-full h-16 resize-y" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.flag || false} onChange={e => set('flag', e.target.checked)} />
                Follow-up flag
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-sand-2 shrink-0">
          {ex && (
            <button onClick={() => { if (confirm('Delete this invoice?')) onDelete(ex.id) }}
              className="btn text-xs text-flag mr-auto">
              <i className="ti ti-trash" /> Delete
            </button>
          )}
          <button onClick={onClose} className="btn text-xs">Cancel</button>
          <button onClick={() => onSave(form)} className="btn btn-primary text-xs">
            <i className="ti ti-device-floppy" /> Save invoice
          </button>
        </div>
      </div>
    </div>
  )
}
