import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { pdf as renderPDF, BlobProvider } from '@react-pdf/renderer'
import { fmt, clsx, CY, CM, CUR_MK, phFeeTotal } from '../../lib/utils'
import InvoicePDF from './InvoicePDF.jsx'
import jdaLogo from '../../assets/jda-logo.png'

// ── Phase calculation helpers ─────────────────────────────────────────────────
function phPrevBilled(ph, invMk) {
  let total = ph.billed || 0
  for (const [mk, v] of Object.entries(ph.monthly || {})) {
    if (mk < invMk) total += (v || 0)
  }
  return total
}
const phCurBilling = (ph, invMk) => ph.monthly?.[invMk] || 0

function buildLineItems(project, invMk) {
  return (project.phases || []).map(ph => {
    const contract    = phFeeTotal(ph)
    const prev        = phPrevBilled(ph, invMk)
    const cur         = phCurBilling(ph, invMk)
    const totalBilled = prev + cur
    const remaining   = Math.max(0, contract - totalBilled)
    return {
      id:           ph.id,
      scopeCode:    ph.scope || '',
      phaseName:    ph.name || ph.scope || '',
      contractFee:  contract,
      prevBilled:   prev,
      prevPct:      contract > 0 ? (prev / contract) * 100 : 0,
      curBilling:   cur,
      curPct:       contract > 0 ? (cur  / contract) * 100 : 0,
      totalBilled,
      totalPct:     contract > 0 ? (totalBilled / contract) * 100 : 0,
      remaining,
      remPct:       contract > 0 ? (remaining   / contract) * 100 : 0,
    }
  })
}

function buildTotals(lineItems) {
  const totalContract = lineItems.reduce((s, i) => s + i.contractFee, 0)
  const totalPrev     = lineItems.reduce((s, i) => s + i.prevBilled, 0)
  const totalCur      = lineItems.reduce((s, i) => s + i.curBilling, 0)
  const totalBilled   = totalPrev + totalCur
  const totalRem      = Math.max(0, totalContract - totalBilled)
  return {
    totalContract,
    totalPrev,    totalPrevPct:  totalContract > 0 ? (totalPrev   / totalContract) * 100 : 0,
    totalCur,     totalCurPct:   totalContract > 0 ? (totalCur    / totalContract) * 100 : 0,
    totalBilled,  totalBilledPct:totalContract > 0 ? (totalBilled / totalContract) * 100 : 0,
    totalRem,     totalRemPct:   totalContract > 0 ? (totalRem    / totalContract) * 100 : 0,
  }
}

// ── Date / invoice-number helpers ─────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function endOfMonth(y, m) {
  return new Date(y, m, 0)
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000)
}

function generateInvoiceNo(format, year, month, counter) {
  const yyyy = String(year)
  const mm   = String(month).padStart(2, '0')
  const seq  = String(counter).padStart(2, '0')
  return (format || 'YYYYMM##')
    .replace('YYYY', yyyy)
    .replace('YY',   yyyy.slice(2))
    .replace('MM',   mm)
    .replace('##',   seq)
}

function nextCounter(settings, mk) {
  return (settings.invoicing?.counters?.[mk] || 0) + 1
}

function resolveClient(c, projects, idx) {
  if (c?.startsWith('ADD')) {
    for (let i = idx - 1; i >= 0; i--)
      if (!projects[i].client?.startsWith('ADD')) return projects[i].client || '—'
  }
  return c || '—'
}

// ── Month selector options ────────────────────────────────────────────────────
function buildMonthOptions() {
  const opts = []
  for (let i = -12; i <= 3; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    opts.push({ key, label: MONTH_NAMES[m - 1] + ' ' + y })
  }
  return opts
}
const MONTH_OPTIONS = buildMonthOptions()

// ── Build invoice data object from project ────────────────────────────────────
function buildInvoiceData({ project, invMk, settings, overrides = {}, scopeTypes, counter }) {
  const [invYear, invMonth] = invMk.split('-').map(Number)
  const eom  = endOfMonth(invYear, invMonth)
  const dueD = addDays(eom, 30)

  const lineItems  = buildLineItems(project, invMk)
  const totals     = buildTotals(lineItems)
  const invoiceNo  = overrides.invoiceNo ?? generateInvoiceNo(settings.invoicing?.numberFormat, invYear, invMonth, counter)
  const clientName = project._client || project.client || '—'
  const clientRecord = (settings.clients || []).find(c => c.name === clientName || String(c.id) === String(project.client))

  return {
    project: {
      name:   project.project || '—',
      projNo: project.projNo  || '',
      pm:     (settings.pms || []).find(p => p.name === project.pm)?.fullName || project.pm || '',
    },
    client: {
      name:     overrides.clientName  ?? clientName,
      address1: overrides.clientAddr1 ?? (clientRecord?.address1 || ''),
      address2: overrides.clientAddr2 ?? (clientRecord?.address2 || ''),
    },
    invoiceNo,
    invoiceDate:     fmtDate(new Date()),
    servicesThrough: fmtDate(eom),
    paymentTerms:    overrides.paymentTerms ?? settings.invoicing?.paymentTerms ?? 'Net 30 Days',
    dueDate:         fmtDate(dueD),
    lineItems,
    totals,
    firm: {
      fullName: settings.invoicing?.firmFullName || settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES',
      tagline:  settings.firm?.tagline  || 'ARCHITECTS  PLANNERS',
      address1: settings.invoicing?.firmAddr1 || settings.firm?.address1 || '',
      address2: settings.invoicing?.firmAddr2 || settings.firm?.address2 || '',
      phone:    settings.invoicing?.firmPhone || settings.firm?.phone    || '',
      website:  settings.invoicing?.firmWebsite || settings.firm?.website || '',
    },
    banking:    settings.banking   || {},
    logo:       settings.firm?.logo || jdaLogo,
    scopeTypes: scopeTypes || [],
    notes:      overrides.notes ?? settings.invoicing?.defaultNotes ?? 'Thank you for the opportunity to be of service.\nPlease reference the invoice number on your payment.',
  }
}

// ── Download helper ───────────────────────────────────────────────────────────
async function downloadPDF(data, filename) {
  const blob = await renderPDF(<InvoicePDF data={data} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function safeName(str) {
  return (str || 'invoice').replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 50)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InvoiceTab({ appState, mutate }) {
  const { projects, invoices, settings } = appState
  const scopeTypes = settings.scopeTypes || []

  const activeProjects = useMemo(() =>
    projects
      .filter(p => !p.archived)
      .map((p, i) => ({ ...p, _client: resolveClient(p.client, projects, i) })),
    [projects]
  )

  const [mode,              setMode]              = useState('individual')
  const [invMk,             setInvMk]             = useState(CUR_MK)
  const [selectedProjId,    setSelectedProjId]     = useState(null)
  const [selectedClientKey, setSelectedClientKey]  = useState(null)
  const [overrides,         setOverrides]          = useState({})
  const [generating,        setGenerating]         = useState(false)
  const [batchProgress,     setBatchProgress]      = useState(null)
  const [warnDismissed,     setWarnDismissed]      = useState(false)
  const [collapsedClients,  setCollapsedClients]   = useState(new Set())
  const [previewData,       setPreviewData]        = useState(null)
  const [showActiveOnly,    setShowActiveOnly]      = useState(true)

  const setOvr = useCallback((k, v) => setOverrides(o => ({ ...o, [k]: v })), [])

  const toggleClient = useCallback((c) => {
    setCollapsedClients(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedProject = activeProjects.find(p => p.id === selectedProjId) || null

  const [invYear, invMonth] = invMk.split('-').map(Number)
  const eom  = endOfMonth(invYear, invMonth)
  const dueD = addDays(eom, 30)

  const lockedMonths = settings.billing?.lockedMonths || []
  const isMonthLocked = lockedMonths.includes(invMk)

  const projHasRemaining = useCallback(p => {
    const totals = buildTotals(buildLineItems(p, invMk))
    return totals.totalRem > 1
  }, [invMk])

  const billedProjects = useMemo(() =>
    activeProjects.filter(p => p.phases.some(ph => (ph.monthly?.[invMk] || 0) > 0)),
    [activeProjects, invMk]
  )

  const nonGreenPhases = useMemo(() => {
    if (invMk !== CUR_MK) return []
    return billedProjects.flatMap(p =>
      p.phases
        .filter(ph => (ph.monthly?.[invMk] || 0) > 0 && ph.billingConf?.[invMk] !== 'g')
        .map(ph => ({ projectName: p.project, phaseName: ph.name || ph.scope }))
    )
  }, [billedProjects, invMk])

  const showWarning = mode === 'batch' && nonGreenPhases.length > 0 && !warnDismissed

  const invoiceData = useMemo(() => {
    if (!selectedProject) return null
    const counter = nextCounter(settings, invMk)
    return buildInvoiceData({ project: selectedProject, invMk, settings, overrides, scopeTypes, counter })
  }, [selectedProject, invMk, settings, overrides, scopeTypes])

  // Debounce preview updates so every keystroke doesn't regenerate the PDF
  useEffect(() => {
    if (!invoiceData) { setPreviewData(null); return }
    const timer = setTimeout(() => setPreviewData(invoiceData), 400)
    return () => clearTimeout(timer)
  }, [invoiceData])

  const clientList = useMemo(() =>
    [...new Set(activeProjects.map(p => p._client || p.client).filter(Boolean))].sort(),
    [activeProjects]
  )

  // Projects grouped by client, both sorted alphabetically
  const projectsByClient = useMemo(() => {
    const grouped = {}
    activeProjects.forEach(p => {
      const c = p._client || '—'
      if (!grouped[c]) grouped[c] = []
      grouped[c].push(p)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([client, projs]) => ({
        client,
        projects: [...projs].sort((a, b) => (a.project || '').localeCompare(b.project || ''))
      }))
  }, [activeProjects])

  const displayProjectsByClient = useMemo(() => {
    if (!showActiveOnly) return projectsByClient
    return projectsByClient
      .map(({ client, projects: plist }) => ({
        client,
        projects: plist.filter(projHasRemaining)
      }))
      .filter(({ projects }) => projects.length > 0)
  }, [projectsByClient, showActiveOnly, projHasRemaining])

  const previewIframeRef = useRef(null)

  // ── Print helper ─────────────────────────────────────────────────────────────
  const printInvoice = useCallback(() => {
    try {
      previewIframeRef.current?.contentWindow?.print()
    } catch {
      // cross-origin / plugin restriction fallback
      if (previewIframeRef.current?.src) window.open(previewIframeRef.current.src, '_blank')
    }
  }, [])

  // ── Individual generate ───────────────────────────────────────────────────────
  const generateIndividual = useCallback(async () => {
    if (!invoiceData || !selectedProject || generating) return
    setGenerating(true)
    try {
      const counter = nextCounter(settings, invMk)
      const mk      = invMk
      mutate(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          invoicing: {
            ...prev.settings.invoicing,
            counters: { ...(prev.settings.invoicing?.counters || {}), [mk]: counter },
          },
        },
      }))
      const filename = `Invoice-${invoiceData.invoiceNo}-${safeName(selectedProject.project)}.pdf`
      await downloadPDF(invoiceData, filename)
    } finally {
      setGenerating(false)
    }
  }, [invoiceData, selectedProject, generating, settings, invMk, mutate])

  // ── Batch generate ────────────────────────────────────────────────────────────
  const generateBatch = useCallback(async () => {
    if (generating || billedProjects.length === 0) return
    setGenerating(true)
    setBatchProgress({ done: 0, total: billedProjects.length, current: '' })

    let counter = nextCounter(settings, invMk) - 1
    const mk    = invMk

    try {
      for (const p of billedProjects) {
        counter++
        setBatchProgress(prev => ({ ...prev, current: p.project }))
        const data = buildInvoiceData({ project: p, invMk: mk, settings, scopeTypes, counter })
        const filename = `Invoice-${data.invoiceNo}-${safeName(p.project)}.pdf`
        await downloadPDF(data, filename)
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
        await new Promise(r => setTimeout(r, 350))
      }
      mutate(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          invoicing: {
            ...prev.settings.invoicing,
            counters: { ...(prev.settings.invoicing?.counters || {}), [mk]: counter },
          },
        },
      }))
    } finally {
      setGenerating(false)
      setBatchProgress(null)
    }
  }, [generating, billedProjects, settings, invMk, scopeTypes, mutate])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-20 bg-sand border-b border-sand-3 px-4 py-2 flex flex-wrap items-center gap-3">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-sand-3 overflow-hidden text-xs">
          {[
            { id: 'individual', label: 'Individual' },
            { id: 'batch',      label: 'Batch'      },
            { id: 'statement',  label: 'Client Statement' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setWarnDismissed(false) }}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                mode === m.id ? 'bg-terracotta text-white font-semibold' : 'text-olive hover:bg-sand-2'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Month */}
        <select
          value={invMk}
          onChange={e => { setInvMk(e.target.value); setWarnDismissed(false) }}
          className="select text-xs w-auto"
        >
          {MONTH_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>

        {/* Active-only toggle */}
        <button
          onClick={() => setShowActiveOnly(v => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors',
            showActiveOnly
              ? 'bg-terracotta/10 text-terracotta border-terracotta/30'
              : 'text-olive border-sand-3 hover:bg-sand-2'
          )}
        >
          <i className={clsx('ti text-xs', showActiveOnly ? 'ti-filter-filled' : 'ti-filter')} />
          Active only
        </button>

        {/* Locked month badge */}
        {isMonthLocked && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-sand-2 text-olive border border-sand-3">
            <i className="ti ti-lock text-xs" />
            Month closed in Billing
          </span>
        )}

      </div>

      {/* ── Body ── */}
      <div className={clsx('flex-1', (mode === 'individual' || mode === 'statement') ? 'overflow-hidden' : 'overflow-auto p-4')}>

        {/* ────── Individual: two-pane ────── */}
        {mode === 'individual' && (
          <div className="flex h-full">

            {/* Left panel: project list + form */}
            <div style={{ width: 300 }} className="flex-shrink-0 flex flex-col overflow-y-auto border-r border-sand-2 bg-sand/20">

              {/* Grouped project list */}
              <div className="flex-shrink-0 border-b border-sand-2">
                <div className="px-3 py-2 bg-sand/60 border-b border-sand-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-olive">Projects</span>
                </div>
                {displayProjectsByClient.map(({ client, projects: plist }) => {
                  const isMulti     = plist.length > 1
                  const isCollapsed = collapsedClients.has(client)
                  return (
                    <div key={client}>
                      {/* Client header */}
                      <div
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b border-sand-3 bg-[#3D3935]/10 text-dark tracking-wide',
                          isMulti && 'cursor-pointer hover:bg-[#3D3935]/15'
                        )}
                        onClick={isMulti ? () => toggleClient(client) : undefined}
                      >
                        {isMulti
                          ? <i className={clsx('ti text-olive text-xs flex-shrink-0', isCollapsed ? 'ti-chevron-right' : 'ti-chevron-down')} />
                          : <span className="w-3.5 flex-shrink-0" />
                        }
                        <span className="flex-1 truncate">{client}</span>
                        {isMulti && <span className="text-olive font-normal tabular-nums">{plist.length}</span>}
                      </div>

                      {/* Project rows */}
                      {(!isMulti || !isCollapsed) && plist.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProjId(p.id); setOverrides({}) }}
                          className={clsx(
                            'w-full text-left pl-7 pr-3 py-1.5 text-xs border-b border-sand-2/40 transition-colors block',
                            selectedProjId === p.id
                              ? 'bg-terracotta/10 text-terracotta font-semibold border-l-2 border-l-terracotta'
                              : 'text-dark hover:bg-sand-2'
                          )}
                        >
                          {p.project}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>

              {/* Invoice form — visible only when a project is selected */}
              {selectedProject ? (
                <div className="p-3 space-y-3">

                  {/* Invoice Details */}
                  <div className="bg-white rounded border border-sand-2 p-3">
                    <div className="text-2xs font-semibold text-dark mb-2">Invoice Details</div>
                    <div className="space-y-2">
                      <div>
                        <label className="field-label">Invoice Number</label>
                        <input
                          className="input text-xs w-full font-mono"
                          value={overrides.invoiceNo ?? invoiceData?.invoiceNo ?? ''}
                          onChange={e => setOvr('invoiceNo', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="field-label">Payment Terms</label>
                        <input
                          className="input text-xs w-full"
                          value={overrides.paymentTerms ?? settings.invoicing?.paymentTerms ?? 'Net 30 Days'}
                          onChange={e => setOvr('paymentTerms', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="field-label">Invoice Date</label>
                          <div className="input text-xs bg-sand/60 text-olive truncate">{fmtDate(new Date())}</div>
                        </div>
                        <div>
                          <label className="field-label">Due Date</label>
                          <div className="input text-xs bg-sand/60 text-olive truncate">{fmtDate(dueD)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className="bg-white rounded border border-sand-2 p-3">
                    <div className="text-2xs font-semibold text-dark mb-1">Bill To</div>
                    <p className="text-2xs text-olive mb-2">Addresses will connect to the shared CRM when available.</p>
                    <div className="space-y-2">
                      <div>
                        <label className="field-label">Client Name</label>
                        <input
                          className="input text-xs w-full"
                          value={overrides.clientName ?? (selectedProject._client || selectedProject.client || '')}
                          onChange={e => setOvr('clientName', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="field-label">Address</label>
                        <input
                          className="input text-xs w-full"
                          placeholder="Optional"
                          value={overrides.clientAddr1 ?? ''}
                          onChange={e => setOvr('clientAddr1', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="field-label">City, State ZIP</label>
                        <input
                          className="input text-xs w-full"
                          placeholder="Optional"
                          value={overrides.clientAddr2 ?? ''}
                          onChange={e => setOvr('clientAddr2', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-white rounded border border-sand-2 p-3">
                    <label className="field-label">Invoice Notes</label>
                    <textarea
                      className="input text-xs w-full mt-1"
                      rows={3}
                      value={overrides.notes ?? settings.invoicing?.defaultNotes ?? 'Thank you for the opportunity to be of service.\nPlease reference the invoice number on your payment.'}
                      onChange={e => setOvr('notes', e.target.value)}
                    />
                  </div>

                  {/* Download */}
                  <button
                    onClick={generateIndividual}
                    disabled={generating}
                    className="btn btn-primary w-full text-sm py-2"
                  >
                    {generating
                      ? <><i className="ti ti-loader-2 spin mr-2" />Generating…</>
                      : <><i className="ti ti-file-download mr-2" />Download Invoice PDF</>
                    }
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-olive text-xs text-center">
                  Select a project above to build an invoice
                </div>
              )}
            </div>

            {/* Right panel: WYSIWYG PDF preview */}
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Preview toolbar */}
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#3D3935]">
                <span className="text-white/60 text-xs flex-1 truncate">
                  {selectedProject ? selectedProject.project : 'Invoice Preview'}
                </span>
                {previewData && (
                  <button
                    onClick={printInvoice}
                    className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors"
                  >
                    <i className="ti ti-printer" />Print
                  </button>
                )}
                <button
                  onClick={generateIndividual}
                  disabled={generating || !invoiceData}
                  className="flex items-center gap-1.5 text-xs bg-terracotta hover:bg-terracotta/80 text-white px-3 py-1.5 rounded font-semibold transition-colors disabled:opacity-40"
                >
                  {generating
                    ? <><i className="ti ti-loader-2 spin" />Generating…</>
                    : <><i className="ti ti-file-download" />Download PDF</>
                  }
                </button>
              </div>

              {/* Preview area */}
              {!selectedProject ? (
                <div className="flex-1 flex items-center justify-center bg-neutral-400">
                  <div className="text-center text-neutral-500">
                    <i className="ti ti-file-invoice text-5xl block mb-3 opacity-30" />
                    <div className="text-sm">Select a project to preview the invoice</div>
                  </div>
                </div>
              ) : !previewData ? (
                <div className="flex-1 flex items-center justify-center bg-neutral-400">
                  <i className="ti ti-loader-2 spin text-neutral-500 text-2xl" />
                </div>
              ) : (
                <BlobProvider document={<InvoicePDF data={previewData} />}>
                  {({ url, loading }) => (
                    <div className="flex-1 overflow-auto bg-neutral-400 p-6 flex justify-center min-h-0">
                      {loading && !url && (
                        <div className="self-center">
                          <i className="ti ti-loader-2 spin text-neutral-500 text-2xl" />
                        </div>
                      )}
                      {url && (
                        <div className="relative" style={{ width: '100%', maxWidth: 680, flexShrink: 0 }}>
                          {loading && (
                            <div className="absolute top-2 right-2 z-10 bg-white/90 rounded px-2 py-1 text-2xs text-olive flex items-center gap-1 shadow">
                              <i className="ti ti-loader-2 spin text-xs" />Updating…
                            </div>
                          )}
                          <iframe
                            ref={previewIframeRef}
                            src={url}
                            className="border-none block w-full shadow-2xl"
                            style={{ height: 'calc(680px * 11 / 8.5)' }}
                            title="Invoice Preview"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </BlobProvider>
              )}
            </div>

          </div>
        )}

        {/* ────── Batch ────── */}
        {mode === 'batch' && (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Confidence warning */}
            {showWarning && (
              <div className="rounded-lg border border-warning/40 bg-warning/8 p-4">
                <div className="flex gap-3">
                  <i className="ti ti-alert-triangle text-warning text-lg shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1">Confidence Review Incomplete</div>
                    <p className="text-xs text-olive mb-3">
                      The following phases in {MONTH_OPTIONS.find(m => m.key === invMk)?.label} do not
                      have green confidence dots. Review billing allocations before generating invoices.
                    </p>
                    <ul className="text-xs space-y-1 mb-3">
                      {nonGreenPhases.slice(0, 8).map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full bg-warning mt-1 shrink-0" />
                          <span><strong>{p.projectName}</strong> — {p.phaseName}</span>
                        </li>
                      ))}
                      {nonGreenPhases.length > 8 && (
                        <li className="text-olive">…and {nonGreenPhases.length - 8} more</li>
                      )}
                    </ul>
                    <button
                      onClick={() => setWarnDismissed(true)}
                      className="btn text-xs text-warning border-warning/30 hover:bg-warning/10"
                    >
                      Proceed anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch progress */}
            {batchProgress && (
              <div className="bg-white rounded-lg border border-sand-2 p-4 flex items-center gap-3">
                <i className="ti ti-loader-2 spin text-terracotta text-lg" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Generating invoices…</div>
                  <div className="text-xs text-olive">{batchProgress.current}</div>
                </div>
                <div className="text-sm font-semibold text-terracotta">{batchProgress.done} / {batchProgress.total}</div>
              </div>
            )}

            {/* Project list */}
            <div className="bg-white rounded-lg border border-sand-2 overflow-hidden">
              <div className="px-5 py-3 border-b border-sand-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Projects to Invoice</div>
                  <div className="text-2xs text-olive">
                    {billedProjects.length} project{billedProjects.length !== 1 ? 's' : ''} with
                    billing in {MONTH_OPTIONS.find(m => m.key === invMk)?.label}
                  </div>
                </div>
                {!showWarning && billedProjects.length > 0 && !batchProgress && (
                  <button
                    onClick={generateBatch}
                    disabled={generating}
                    className="btn btn-primary text-xs"
                  >
                    {generating
                      ? <><i className="ti ti-loader-2 spin mr-1" />Generating…</>
                      : <><i className="ti ti-files mr-1" />Generate All PDFs</>
                    }
                  </button>
                )}
              </div>

              {billedProjects.length === 0 ? (
                <div className="py-12 text-center text-sm text-olive">
                  No projects have billing allocations for this month.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-sand text-2xs text-olive uppercase tracking-wider">
                      <th className="text-left px-4 py-2">Project</th>
                      <th className="text-left px-2 py-2">Client</th>
                      <th className="text-left px-2 py-2">PM</th>
                      <th className="text-right px-2 py-2">Invoice Amount</th>
                      <th className="text-center px-4 py-2">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billedProjects.map(p => {
                      const curTotal  = p.phases.reduce((s, ph) => s + (ph.monthly?.[invMk] || 0), 0)
                      const billedPhs = p.phases.filter(ph => (ph.monthly?.[invMk] || 0) > 0)
                      const allGreen  = invMk === CUR_MK && billedPhs.every(ph => ph.billingConf?.[invMk] === 'g')
                      const anyNon    = invMk === CUR_MK && billedPhs.some(ph => ph.billingConf?.[invMk] !== 'g')
                      return (
                        <tr key={p.id} className="border-t border-sand-2 hover:bg-sand/30">
                          <td className="px-4 py-2 font-medium">{p.project}</td>
                          <td className="px-2 py-2 text-olive">{p._client || '—'}</td>
                          <td className="px-2 py-2 text-olive">{p.pm || '—'}</td>
                          <td className="px-2 py-2 text-right font-semibold text-terracotta">{fmt(curTotal)}</td>
                          <td className="px-4 py-2 text-center text-sm">
                            {invMk !== CUR_MK  ? <span className="text-olive text-xs">—</span>
                              : allGreen        ? <span style={{ color: '#4a7c3f' }}>●</span>
                              : anyNon          ? <span style={{ color: '#c9831a' }}>●</span>
                              :                  <span className="text-olive">○</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#3D3935] bg-sand font-semibold">
                      <td colSpan={3} className="px-4 py-2 text-xs">BATCH TOTAL</td>
                      <td className="text-right px-2 py-2 text-terracotta font-bold">
                        {fmt(billedProjects.reduce((s, p) => s + p.phases.reduce((ps, ph) => ps + (ph.monthly?.[invMk] || 0), 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ────── Client Statement: two-pane ────── */}
        {mode === 'statement' && (
          <div className="flex h-full">

            {/* Left panel: client list */}
            <div style={{ width: 300 }} className="flex-shrink-0 flex flex-col overflow-y-auto border-r border-sand-2 bg-sand/20">
              <div className="px-3 py-2 bg-sand/60 border-b border-sand-2 flex-shrink-0">
                <span className="text-2xs font-semibold uppercase tracking-wider text-olive">Clients</span>
              </div>
              {clientList.map(c => {
                const projCount = activeProjects.filter(p => (p._client || p.client) === c).length
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedClientKey(c)}
                    className={clsx(
                      'w-full text-left px-4 py-2.5 border-b border-sand-2/40 transition-colors',
                      selectedClientKey === c
                        ? 'bg-terracotta/10 text-terracotta border-l-2 border-l-terracotta'
                        : 'text-dark hover:bg-sand-2'
                    )}
                  >
                    <div className={clsx('text-xs font-semibold', selectedClientKey === c ? 'text-terracotta' : 'text-dark')}>{c}</div>
                    <div className="text-2xs text-olive mt-0.5">{projCount} project{projCount !== 1 ? 's' : ''}</div>
                  </button>
                )
              })}
            </div>

            {/* Right panel: statement content */}
            <div className="flex-1 overflow-auto p-4">
              {!selectedClientKey ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-olive">
                    <i className="ti ti-file-text text-4xl block mb-3 opacity-30" />
                    <div className="text-sm">Select a client to view their statement</div>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <ClientStatementView
                    clientKey={selectedClientKey}
                    projects={activeProjects}
                    invoices={invoices}
                    settings={settings}
                    scopeTypes={scopeTypes}
                  />
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

// ── Client Statement View ─────────────────────────────────────────────────────
function ClientStatementView({ clientKey, projects, invoices, settings, scopeTypes }) {
  const [generating, setGenerating] = useState(false)

  const clientProjects = projects.filter(p => (p._client || p.client) === clientKey)
  const clientInvoices = invoices.filter(inv => {
    const match = projects.find(p => p.project === inv.project || String(p.id) === String(inv.projectId))
    return match && (match._client || match.client) === clientKey
  })
  const openInvoices = clientInvoices.filter(i => !i.paid)
  const totalOpen    = openInvoices.reduce((s, i) => s + (i.amount || 0), 0)

  const generateStatement = async () => {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 500))
    setGenerating(false)
    alert('Client Statement PDF is coming in the next update.')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-sand-2 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-sm font-semibold">{clientKey}</div>
            <div className="text-2xs text-olive">
              {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''} ·{' '}
              {openInvoices.length} open invoice{openInvoices.length !== 1 ? 's' : ''} in A/R
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xs text-olive uppercase tracking-wider mb-1">Outstanding Balance</div>
            <div className="text-lg font-bold text-terracotta">{fmt(totalOpen)}</div>
          </div>
        </div>

        {openInvoices.length === 0 ? (
          <div className="py-6 text-center text-sm text-olive border border-dashed border-sand-3 rounded-lg">
            No open A/R invoices found for {clientKey}.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sand text-2xs text-olive uppercase tracking-wider">
                <th className="text-left px-3 py-2">Invoice #</th>
                <th className="text-left px-2 py-2">Project</th>
                <th className="text-left px-2 py-2">Date</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.map(inv => (
                <tr key={inv.id ?? inv.invoiceNo} className="border-t border-sand-2 hover:bg-sand/30">
                  <td className="px-3 py-2 font-mono">{inv.invoiceNo || '—'}</td>
                  <td className="px-2 py-2 text-olive">{inv.project || '—'}</td>
                  <td className="px-2 py-2 text-olive">{inv.invoiceDate || (String(inv.invoiceNo || '').slice(0, 6)) || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(inv.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#3D3935] bg-sand font-semibold">
                <td colSpan={3} className="px-3 py-2 text-xs">TOTAL OUTSTANDING</td>
                <td className="text-right px-3 py-2 text-terracotta">{fmt(totalOpen)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={generateStatement}
            disabled={generating}
            className="btn btn-primary text-xs"
          >
            {generating
              ? <><i className="ti ti-loader-2 spin mr-1" />Generating…</>
              : <><i className="ti ti-file-download mr-1" />Download Client Statement PDF</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
