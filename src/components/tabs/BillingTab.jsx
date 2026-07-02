import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fmt, clsx, CY, CM, CUR_MK, mkLabel, nextMonthKey, useLocalPref, getMonthlyGoal } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────
const N_MONTHS = 18
const COL_FLAG = 28
const COL_NAME = 168
const COL_FEE  = 72
const COL_MO   = 66

// Fixed picker range: 24 months back → 18 months forward from real calendar month
const PICKER_MONTHS = (() => {
  const months = []
  for (let i = -24; i <= 18; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    months.push({ key, label: mkLabel(key) })
  }
  return months
})()

// ── Month helpers ─────────────────────────────────────────────────────────────
function buildMonths(activeMk) {
  const [ay, am] = activeMk.split('-').map(Number)
  const months = []
  // Start 6 months back so past months are available when toggled on
  for (let i = -6; i < N_MONTHS; i++) {
    const d   = new Date(ay, am - 1 + i, 1)
    const y   = d.getFullYear()
    const m   = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const isPast = key < activeMk
    const label  = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months.push({ key, label, isPast })
  }
  return months
}

// ── Phase calculations ────────────────────────────────────────────────────────
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

const phRem = ph => Math.max(0, phFeeFC(ph) - (ph.billed || 0) - phYTD(ph))

const phAlloc = (ph, activeMk) =>
  Object.entries(ph.monthly || {})
    .filter(([mk]) => mk >= activeMk)
    .reduce((s, [, v]) => s + (v || 0), 0)

// ── Client resolution (ADD# → previous real client) ───────────────────────────
function resolveClient(clientStr, allProjects, idx) {
  if (clientStr?.startsWith('ADD')) {
    for (let i = idx - 1; i >= 0; i--) {
      if (!allProjects[i].client?.startsWith('ADD'))
        return allProjects[i].client || '—'
    }
  }
  return clientStr || '—'
}

// ── BillingTab ────────────────────────────────────────────────────────────────
export default function BillingTab({ appState, mutate, session }) {
  const { projects, settings } = appState
  const pmList      = (settings.pms || []).map(p => p.name)
  const monthlyGoal = settings.billing?.monthlyGoal || 395000
  const hourlyData  = settings.billing?.hourlyByMonth || {}
  const activeMk    = settings.billing?.activeMonth ?? CUR_MK
  const lockedMonths = settings.billing?.lockedMonths ?? []

  const ALL_MONTHS = buildMonths(activeMk)

  // ── Local UI state ────────────────────────────────────────────────────────
  const [filterPM,       setFilterPM]       = useLocalPref('bill.filterPM', 'ALL')
  const [showPast,       setShowPast]        = useLocalPref('bill.showPast', false)
  const [hideBilledOut,  setHideBilledOut]   = useLocalPref('bill.hideBilledOut', false)
  const [showPhases,     setShowPhases]      = useLocalPref('bill.showPhases', true)
  const [expandedPM,     setExpandedPM]      = useLocalPref('bill.expPM', {})
  const [expandedClient, setExpandedClient]  = useLocalPref('bill.expClient', {})

  const visMonths = showPast ? ALL_MONTHS : ALL_MONTHS.filter(m => !m.isPast)

  // ── Prep projects ─────────────────────────────────────────────────────────
  const allResolved = projects
    .filter(p => !p.archived)
    .map((p, i) => ({ ...p, _client: resolveClient(p.client, projects, i) }))
    .filter(p => filterPM === 'ALL' || p.pm === filterPM)

  const resolvedProjects = allResolved.filter(p => {
    if (!hideBilledOut) return true
    return p.phases.some(ph => phRem(ph) > 0)
  })

  // ── Group PM → Client → Project ──────────────────────────────────────────
  const pmGroups = {}
  const pmOrder  = []
  resolvedProjects.forEach(p => {
    const pm     = p.pm || '—'
    const client = p._client || '—'
    if (!pmGroups[pm]) { pmGroups[pm] = {}; pmOrder.push(pm) }
    if (!pmGroups[pm][client]) pmGroups[pm][client] = []
    pmGroups[pm][client].push(p)
  })

  // ── Column totals ─────────────────────────────────────────────────────────
  const ffTots = visMonths.map(m =>
    allResolved.reduce((s, p) =>
      s + p.phases.reduce((ps, ph) => ps + (ph.monthly?.[m.key] || 0), 0), 0)
  )

  const grandFee = allResolved.reduce((s, p) =>
    s + p.phases.reduce((ps, ph) => ps + phFeeFC(ph), 0), 0)

  // ── Mutate helpers ────────────────────────────────────────────────────────
  const setPct = useCallback((projId, phId, mk, pct) => {
    mutate(prev => {
      return { ...prev, projects: prev.projects.map(p => {
        if (p.id !== projId) return p
        return { ...p, phases: p.phases.map(ph => {
          if (ph.id !== phId) return ph
          const fee     = phFeeFC(ph)
          const dollars = Math.round(fee * (pct / 100))
          return { ...ph, monthly: { ...ph.monthly, [mk]: dollars } }
        })}
      })}
    })
  }, [mutate])

  const setHourly = useCallback((mk, val) => {
    mutate(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        billing: {
          ...prev.settings.billing,
          hourlyByMonth: { ...(prev.settings.billing?.hourlyByMonth || {}), [mk]: val }
        }
      }
    }))
  }, [mutate])

  const setBillingConf = useCallback((phId, mk, val) => {
    mutate(prev => ({
      ...prev,
      projects: prev.projects.map(p => ({
        ...p,
        phases: p.phases.map(ph => {
          if (ph.id !== phId) return ph
          const cur = (ph.billingConf || {})[mk]
          const next = cur === val ? null : val // toggle off if same
          return { ...ph, billingConf: { ...ph.billingConf, [mk]: next } }
        })
      }))
    }))
  }, [mutate])

  const setHoldStatus = useCallback((phId, val) => {
    mutate(prev => ({
      ...prev,
      projects: prev.projects.map(p => ({
        ...p,
        phases: p.phases.map(ph => {
          if (ph.id !== phId) return ph
          return { ...ph, holdStatus: val || null }
        })
      }))
    }))
  }, [mutate])

  const setFlag = useCallback((projId, phId, flagData) => {
    const stamp = flagData.flag ? {
      flagBy: session?.user?.email || '—',
      flagAt: new Date().toISOString(),
    } : { flagBy: null, flagAt: null }
    mutate(prev => ({
      ...prev,
      projects: prev.projects.map(p => {
        if (p.id !== projId) return p
        if (phId) {
          return { ...p, phases: p.phases.map(ph => {
            if (ph.id !== phId) return ph
            return { ...ph, flag: flagData.flag, flagNote: flagData.note || '', flagNewProject: false, ...stamp }
          })}
        }
        return { ...p, flag: flagData.flag, flagNote: flagData.note || '', flagNewProject: flagData.newProject || false, ...stamp }
      })
    }))
  }, [mutate, session])

  const setDone = useCallback((phId, val) => {
    mutate(prev => ({
      ...prev,
      projects: prev.projects.map(p => ({
        ...p,
        phases: p.phases.map(ph => ph.id !== phId ? ph : { ...ph, done: val })
      }))
    }))
  }, [mutate])

  const myEmail = session?.user?.email || ''

  const sendChatMessage = useCallback(async (text) => {
    if (!text || !myEmail) return
    try {
      await supabase.from('messages').insert({ user_email: myEmail, text })
    } catch (e) { console.error('Chat notify failed:', e) }
  }, [myEmail])

  const togglePM = key =>
    setExpandedPM(prev => ({ ...prev, [key]: prev[key] === false ? true : false }))
  const toggleClient = key =>
    setExpandedClient(prev => ({ ...prev, [key]: prev[key] === false ? true : false }))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 bg-sand border-b border-sand-3 px-3 py-2 flex flex-wrap items-center gap-2">
        <select
          value={filterPM}
          onChange={e => setFilterPM(e.target.value)}
          className="select w-auto text-xs"
        >
          <option value="ALL">All PMs</option>
          {pmList.map(pm => <option key={pm}>{pm}</option>)}
        </select>

        <span className="text-xs text-olive">Goal:</span>
        <input
          type="number"
          step={5000}
          defaultValue={monthlyGoal}
          onBlur={e => {
            const val = parseFloat(e.target.value) || 395000
            mutate(prev => ({
              ...prev,
              settings: { ...prev.settings, billing: { ...prev.settings.billing, monthlyGoal: val } }
            }))
          }}
          className="input w-24 text-xs"
        />

        <button
          onClick={() => setShowPast(p => !p)}
          className={clsx('btn text-xs', showPast && 'btn-active')}
        >
          <i className="ti ti-calendar-minus" />
          {showPast ? 'Hide past months' : 'Show past months'}
        </button>

        <button
          onClick={() => setHideBilledOut(p => !p)}
          className={clsx('btn text-xs', hideBilledOut && 'btn-active')}
        >
          <i className="ti ti-circle-check" />
          {hideBilledOut ? 'Show billed out' : 'Hide billed out'}
        </button>

        <button
          onClick={() => setShowPhases(p => !p)}
          className="btn text-xs"
        >
          {showPhases ? 'Hide phases' : 'Show phases'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold flex items-center gap-1"
            style={{ color: '#BD6439' }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 13 }} />
            Active:
          </span>
          <select
            value={activeMk}
            onChange={e => mutate(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                billing: { ...prev.settings.billing, activeMonth: e.target.value }
              }
            }))}
            className="select text-xs font-semibold"
            style={{ color: '#BD6439', paddingTop: 2, paddingBottom: 2 }}
          >
            {PICKER_MONTHS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const nextMk = nextMonthKey(activeMk)
              if (!confirm(`Close ${mkLabel(activeMk)} and set ${mkLabel(nextMk)} as the active month?`)) return
              mutate(prev => {
                const next = {
                  ...prev,
                  settings: {
                    ...prev.settings,
                    billing: {
                      ...prev.settings.billing,
                      activeMonth: nextMk,
                      lockedMonths: [...(prev.settings.billing?.lockedMonths || []), activeMk],
                    }
                  }
                }
                // Mark phases done now that the month is officially closed
                next.projects = next.projects.map(p => ({
                  ...p,
                  phases: p.phases.map(ph => {
                    if (ph.done) return ph
                    const rem = phRem(ph)
                    return phFeeFC(ph) > 0 && rem <= 0 ? { ...ph, done: true } : ph
                  })
                }))
                return next
              })
            }}
            className="btn text-xs"
            style={{ color: '#BD6439', borderColor: 'rgba(189,100,57,0.3)' }}
          >
            Close {mkLabel(activeMk)} →
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="px-3 py-1.5 text-2xs text-olive">
        Type % to allocate · live totals · <span className="text-success">✓ Billed out = done</span>
      </div>

      {/* Table wrapper — overflow here is what allows sticky thead to work */}
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse text-xs w-full" style={{ minWidth: 900 }}>

          {/* ── Sticky thead ── */}
          <thead className="sticky top-0 z-20 shadow-sm">

            {/* Column headers */}
            <tr className="bg-sand-2">
              <th className="bg-sand-2 text-center px-0 py-2 border-b border-sand-3"
                style={{ width: COL_FLAG, minWidth: COL_FLAG }}>
                <i className="ti ti-flag" style={{ fontSize: 12, color: '#736F4C' }} />
              </th>
              <th className="sticky left-0 z-10 bg-sand-2 text-left font-semibold px-2 py-2 border-b border-sand-3"
                style={{ minWidth: COL_NAME }}>
                Project / Phase
              </th>
              <th className="text-right font-semibold px-2 py-2 border-b border-sand-3"
                style={{ minWidth: COL_FEE }}>
                Fee
              </th>
              {visMonths.map(m => {
                const isLocked = lockedMonths.includes(m.key)
                return (
                  <th key={m.key}
                    className={clsx(
                      'text-center font-semibold px-1 py-2 border-b border-sand-3',
                      m.key === activeMk && 'bg-terracotta/15',
                      m.isPast && !isLocked && 'text-dark-3'
                    )}
                    style={{ minWidth: COL_MO }}>
                    <div className="flex flex-col items-center gap-0.5">
                      {m.key === activeMk
                        ? <strong>{m.label}</strong>
                        : m.label}
                      {isLocked && (
                        <button
                          title={`${m.label} is locked — click to unlock`}
                          onClick={() => {
                            if (!confirm(`Unlock ${mkLabel(m.key)} for editing?`)) return
                            mutate(prev => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                billing: {
                                  ...prev.settings.billing,
                                  lockedMonths: (prev.settings.billing?.lockedMonths || []).filter(mk => mk !== m.key),
                                }
                              }
                            }))
                          }}
                          style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#736F4C', lineHeight: 1 }}
                        >
                          <i className="ti ti-lock" />
                        </button>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>

            {/* Monthly total */}
            <tr className="bg-sand border-t-2 border-sand-3">
              <td />
              <SummaryCell label="Monthly total" bold sticky />
              <td />
              {visMonths.map((m, i) => {
                const hv    = hourlyData[m.key] || 0
                const total = (ffTots[i] || 0) + hv
                return (
                  <td key={m.key}
                    className={clsx('text-center font-bold text-xs px-1',
                      m.key === activeMk && 'bg-terracotta/15')}
                    style={{ color: total >= getMonthlyGoal(m.key, settings) ? '#2d7a3a' : '#BD6439' }}>
                    {fmt(total)}
                  </td>
                )
              })}
            </tr>

            {/* Hourly / reimbursable */}
            <tr className="bg-sand-2">
              <td />
              <SummaryCell label={<>Hourly / reimbursable <span className="text-dark-3 font-normal">(manual)</span></>} sticky />
              <td />
              {visMonths.map(m => {
                const v = hourlyData[m.key] || 0
                const isLocked = lockedMonths.includes(m.key)
                return (
                  <td key={m.key}
                    className={clsx('px-0.5 py-0.5 text-center',
                      m.key === activeMk && 'bg-terracotta/15')}
                    style={{ minWidth: COL_MO }}>
                    {isLocked ? (
                      <span className="text-xs text-dark-3 opacity-60">{v > 0 ? fmt(v) : '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={100}
                        defaultValue={v || ''}
                        placeholder="—"
                        onBlur={e => setHourly(m.key, parseFloat(e.target.value) || 0)}
                        className={clsx(
                          'w-14 text-center text-xs px-1 py-0.5 rounded border bg-transparent',
                          'border-transparent hover:border-sand-3 focus:border-terracotta focus:outline-none',
                          v > 0 && 'text-blue-600 font-semibold'
                        )}
                      />
                    )}
                  </td>
                )
              })}
            </tr>

            {/* FF subtotal */}
            <tr className="bg-sand-2">
              <td />
              <SummaryCell label="FF subtotal" bold sticky />
              <td />
              {visMonths.map((m, i) => {
                const t = ffTots[i] || 0
                return (
                  <td key={m.key}
                    className={clsx('text-center font-bold text-xs px-1',
                      m.key === activeMk && 'bg-terracotta/15')}
                    style={{ color: t >= getMonthlyGoal(m.key, settings) ? '#2d7a3a' : '#BD6439' }}>
                    {fmt(t)}
                  </td>
                )
              })}
            </tr>

            {/* vs goal */}
            <tr className="bg-sand border-b-2 border-sand-3">
              <td />
              <SummaryCell label="vs. goal" sticky />
              <td />
              {visMonths.map((m, i) => {
                const hv    = hourlyData[m.key] || 0
                const total = (ffTots[i] || 0) + hv
                const mGoal = getMonthlyGoal(m.key, settings)
                const diff  = total - mGoal
                return (
                  <td key={m.key}
                    className={clsx('text-center text-2xs px-1',
                      m.key === activeMk && 'bg-terracotta/15')}
                    style={{ color: diff >= 0 ? '#2d7a3a' : '#BD6439' }}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                  </td>
                )
              })}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {pmOrder.map(pm => {
              const pmKey     = 'pm-' + pm
              const pmExp     = expandedPM[pmKey] !== false
              const clientMap = pmGroups[pm]
              const pmProjects = Object.values(clientMap).flat()
              const pmFee     = pmProjects.reduce((s, p) => s + p.phases.reduce((ps, ph) => ps + phFeeFC(ph), 0), 0)
              const pmTots    = visMonths.map(m =>
                pmProjects.reduce((s, p) => s + p.phases.reduce((ps, ph) => ps + (ph.monthly?.[m.key] || 0), 0), 0))

              return [
                // PM header row
                <tr key={pmKey} className="bg-[#1a1a1a] text-white">
                  <td className="bg-[#1a1a1a]" style={{ width: COL_FLAG }} />
                  <td className="sticky left-0 z-10 bg-[#1a1a1a] px-2 py-1.5 font-bold text-xs"
                    style={{ minWidth: COL_NAME }}>
                    <button
                      onClick={() => togglePM(pmKey)}
                      className="flex items-center gap-1.5 text-white"
                    >
                      <span className="text-2xs opacity-60">{pmExp ? '▾' : '▸'}</span>
                      PM: {pm}
                    </button>
                  </td>
                  <td className="text-right px-2 text-xs opacity-60">{fmt(pmFee)}</td>
                  {pmTots.map((t, i) => (
                    <td key={visMonths[i].key} className="text-center text-xs opacity-70 px-1">
                      {t > 0 ? fmt(t) : ''}
                    </td>
                  ))}
                </tr>,

                // Client + project rows
                pmExp && Object.entries(clientMap).map(([client, cProjects]) => {
                  const clientKey = `client-${pm}-${client}`
                  const clientExp = expandedClient[clientKey] !== false
                  const cFee      = cProjects.reduce((s, p) => s + p.phases.reduce((ps, ph) => ps + phFeeFC(ph), 0), 0)
                  const cTots     = visMonths.map(m =>
                    cProjects.reduce((s, p) => s + p.phases.reduce((ps, ph) => ps + (ph.monthly?.[m.key] || 0), 0), 0))

                  return [
                    // Client header
                    <tr key={clientKey} className="bg-sand-2/80">
                      <td className="bg-sand-2" style={{ width: COL_FLAG }} />
                      <td className="sticky left-0 z-10 bg-sand-2 px-2 py-1 text-xs"
                        style={{ minWidth: COL_NAME, paddingLeft: 20 }}>
                        <button
                          onClick={() => toggleClient(clientKey)}
                          className="flex items-center gap-1.5 text-dark-2"
                        >
                          <span className="text-2xs opacity-50">{clientExp ? '▾' : '▸'}</span>
                          {client}
                        </button>
                      </td>
                      <td className="text-right px-2 text-xs text-olive">{fmt(cFee)}</td>
                      {cTots.map((t, i) => (
                        <td key={visMonths[i].key} className="text-center text-2xs text-dark-3 px-1">
                          {t > 0 ? fmt(t) : ''}
                        </td>
                      ))}
                    </tr>,

                    // Projects
                    clientExp && cProjects.map(p => (
                      <ProjectRows
                        key={p.id}
                        project={p}
                        visMonths={visMonths}
                        showPhases={showPhases}
                        hideBilledOut={hideBilledOut}
                        monthlyGoal={monthlyGoal}
                        activeMk={activeMk}
                        lockedMonths={lockedMonths}
                        pms={settings.pms || []}
                        sendChatMessage={sendChatMessage}
                        setPct={setPct}
                        setDone={setDone}
                        setBillingConf={setBillingConf}
                        setHoldStatus={setHoldStatus}
                        setFlag={setFlag}
                      />
                    ))
                  ]
                })
              ]
            })}

            {/* Grand total */}
            <tr className="bg-sand-2 border-t-2 border-sand-3">
              <td style={{ width: COL_FLAG }} />
              <td className="sticky left-0 z-10 bg-sand-2 px-2 py-2 font-bold text-xs"
                style={{ minWidth: COL_NAME }}>
                Grand total — {resolvedProjects.length} project{resolvedProjects.length !== 1 ? 's' : ''} · {resolvedProjects.reduce((s, p) => s + p.phases.length, 0)} phases
              </td>
              <td className="text-right px-2 font-bold text-xs">{fmt(grandFee)}</td>
              {visMonths.map(m => {
                const t = resolvedProjects.reduce((s, p) =>
                  s + p.phases.reduce((ps, ph) => ps + (ph.monthly?.[m.key] || 0), 0), 0)
                return (
                  <td key={m.key}
                    className={clsx('text-center font-bold text-xs px-1',
                      m.key === activeMk && 'bg-terracotta/15')}>
                    {t > 0 ? fmt(t) : ''}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── SummaryCell ───────────────────────────────────────────────────────────────
function SummaryCell({ label, bold, sticky }) {
  return (
    <td className={clsx(
      'px-2 py-1.5 text-xs',
      bold && 'font-bold',
      sticky && 'sticky left-0 z-10 bg-inherit'
    )}
      style={{ minWidth: COL_NAME }}>
      {label}
    </td>
  )
}

// ── ProjectRows ───────────────────────────────────────────────────────────────
function ProjectRows({ project: p, visMonths, showPhases, hideBilledOut, monthlyGoal, activeMk, lockedMonths, pms, sendChatMessage, setPct, setDone, setBillingConf, setHoldStatus, setFlag }) {
  const pmHandle = (pms.find(pm => pm.name === p.pm)?.email || '').split('@')[0] || ''
  const pFee = p.phases.reduce((s, ph) => s + phFeeFC(ph), 0)
  const pTots = visMonths.map(m =>
    p.phases.reduce((s, ph) => s + (ph.monthly?.[m.key] || 0), 0))

  return (
    <>
      {/* Project row */}
      <tr className="bg-white hover:bg-sand">
        <td className="text-center border-b border-sand-2" style={{ width: COL_FLAG }}>
          <FlagCell
            flagged={p.flag}
            note={p.flagNote}
            newProject={p.flagNewProject}
            flagBy={p.flagBy}
            flagAt={p.flagAt}
            isProject
            pmHandle={pmHandle}
            context={p.project}
            sendChatMessage={sendChatMessage}
            onSave={data => setFlag(p.id, null, data)}
          />
        </td>
        <td className="sticky left-0 z-10 bg-inherit px-2 py-1 border-b border-sand-2"
          style={{ minWidth: COL_NAME, paddingLeft: 34 }}>
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="truncate text-xs font-semibold">{p.project}</span>
          </div>
          <div className="text-2xs text-olive">{p.pm} · {p.projNo}</div>
        </td>
        <td className="text-right px-2 text-xs text-olive border-b border-sand-2">{fmt(pFee)}</td>
        {pTots.map((t, i) => (
          <td key={visMonths[i].key}
            className={clsx('text-center text-xs px-1 border-b border-sand-2',
              visMonths[i].key === activeMk && 'bg-terracotta/15')}>
            {t > 0 ? fmt(t) : ''}
          </td>
        ))}
      </tr>

      {/* Phase rows */}
      {showPhases && (() => {
        // Group by addendum
        const addGroups = {}
        const addOrder  = []
        const visible   = hideBilledOut ? p.phases.filter(ph => phRem(ph) > 0) : p.phases
        visible.forEach(ph => {
          const key = ph.addendum || '__main__'
          if (!addGroups[key]) { addGroups[key] = []; addOrder.push(key) }
          addGroups[key].push(ph)
        })

        return addOrder.map(addKey => (
          <AddendumGroup
            key={addKey}
            addKey={addKey}
            phases={addGroups[addKey]}
            project={p}
            visMonths={visMonths}
            activeMk={activeMk}
            lockedMonths={lockedMonths}
            pmHandle={pmHandle}
            sendChatMessage={sendChatMessage}
            setPct={setPct}
            setDone={setDone}
            setBillingConf={setBillingConf}
            setHoldStatus={setHoldStatus}
            setFlag={setFlag}
          />
        ))
      })()}
    </>
  )
}

// ── AddendumGroup ─────────────────────────────────────────────────────────────
function AddendumGroup({ addKey, phases, project: p, visMonths, activeMk, lockedMonths, pmHandle, sendChatMessage, setPct, setDone, setBillingConf, setHoldStatus, setFlag }) {
  return (
    <>
      {/* Addendum header (skip for main group) */}
      {addKey !== '__main__' && (() => {
        const addFee = phases.reduce((s, ph) => s + (ph.fee || 0), 0)
        const addRem = phases.reduce((s, ph) => s + phRem(ph), 0)
        const addTots = visMonths.map(m =>
          phases.reduce((s, ph) => s + (ph.monthly?.[m.key] || 0), 0))
        return (
          <tr className="bg-sand-2 border-t border-sand-2">
            <td className="bg-sand-2" style={{ width: COL_FLAG }} />
            <td className="sticky left-0 z-10 bg-sand-2 px-2 py-1 border-b border-sand-2"
              style={{ paddingLeft: 40 }}>
              <div className="text-xs font-semibold text-terracotta">{addKey}</div>
              <div className="text-2xs text-dark-3">{phases.length} phase{phases.length !== 1 ? 's' : ''}</div>
            </td>
            <td className="text-right px-2 border-b border-sand-2">
              <div className="text-xs text-terracotta">{fmt(addFee)}</div>
              <div className="text-2xs text-olive">{fmt(addRem)} rem</div>
            </td>
            {addTots.map((t, i) => (
              <td key={visMonths[i].key}
                className={clsx('text-center text-xs text-terracotta font-semibold px-1 border-b border-sand-2',
                  visMonths[i].key === activeMk && 'bg-terracotta/15')}>
                {t > 0 ? fmt(t) : ''}
              </td>
            ))}
          </tr>
        )
      })()}

      {/* Phase rows */}
      {phases.map((ph, pi) => (
        <PhaseRow
          key={ph.id ?? `ph-${p.id}-${pi}`}
          phase={ph}
          project={p}
          visMonths={visMonths}
          indent={addKey !== '__main__' ? 64 : 50}
          activeMk={activeMk}
          lockedMonths={lockedMonths}
          pmHandle={pmHandle}
          sendChatMessage={sendChatMessage}
          setPct={setPct}
          setDone={setDone}
          setBillingConf={setBillingConf}
          setHoldStatus={setHoldStatus}
          setFlag={setFlag}
        />
      ))}
    </>
  )
}

// ── PhaseRow ──────────────────────────────────────────────────────────────────
const HOLD_LABELS = { 'not-authorized': 'Not Authorized', 'awaiting-approval': 'Awaiting Approval' }
const HOLD_ICONS  = { 'not-authorized': 'ti-lock', 'awaiting-approval': 'ti-clock' }

function PhaseRow({ phase: ph, project: p, visMonths, indent, activeMk, lockedMonths, pmHandle, sendChatMessage, setPct, setDone, setBillingConf, setHoldStatus, setFlag }) {
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdPos, setHoldPos]   = useState({ top: 0, left: 0 })
  const holdRef = useRef(null)
  const holdBtnRef = useRef(null)
  const rem      = phRem(ph)
  const billedOut = rem <= 0
  const onHold   = !!ph.holdStatus
  const alloc    = phAlloc(ph, activeMk)
  const fee      = phFeeFC(ph)
  const allocPct = billedOut ? 100 : fee > 0 ? Math.round(alloc / fee * 100) : 0
  const allocColor = billedOut ? '#2d7a3a'
    : onHold ? '#6b7280'
    : Math.abs(alloc - fee) < 1 ? '#2d7a3a'
    : alloc > fee ? '#c0392b'
    : '#888'

  useEffect(() => {
    if (!holdOpen) return
    const h = e => {
      if (
        holdBtnRef.current && !holdBtnRef.current.contains(e.target) &&
        holdRef.current && !holdRef.current.contains(e.target)
      ) setHoldOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [holdOpen])

  return (
    <tr className={clsx('border-b border-sand-2', ph.done ? 'opacity-40' : onHold ? 'opacity-60' : '')}>
      {/* Flag */}
      <td className="text-center border-b border-sand-2" style={{ width: COL_FLAG }}>
        <FlagCell
          flagged={ph.flag}
          note={ph.flagNote}
          flagBy={ph.flagBy}
          flagAt={ph.flagAt}
          pmHandle={pmHandle}
          context={`${p.project} · ${ph.name}`}
          sendChatMessage={sendChatMessage}
          onSave={data => setFlag(p.id, ph.id, data)}
        />
      </td>
      {/* Name / alloc status */}
      <td className="sticky left-0 bg-white px-2 py-1 border-b border-sand-2"
        style={{ minWidth: COL_NAME, paddingLeft: indent, zIndex: 10 }}>
        <div className="truncate text-xs text-olive">{ph.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-2xs text-dark-3">{ph.scope}</span>
          {onHold ? (
            <span className="text-2xs flex items-center gap-1" style={{ color: '#6b7280' }}>
              <i className={clsx('ti', HOLD_ICONS[ph.holdStatus])} style={{ fontSize: 11 }} />
              {HOLD_LABELS[ph.holdStatus]}
            </span>
          ) : ph.done ? (
            <button
              onClick={() => setDone(ph.id, false)}
              title="Unmark done to allow retroactive changes"
              className="text-2xs flex items-center gap-0.5"
              style={{ color: '#2d7a3a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              ✓ Done <i className="ti ti-x" style={{ fontSize: 9, opacity: 0.4 }} />
            </button>
          ) : (
            <span className="text-2xs" style={{ color: allocColor }}>
              {billedOut ? '✓ Billed out' : `${allocPct}% alloc`}
            </span>
          )}
          {!ph.done && (
            <>
              {!onHold && !lockedMonths.includes(activeMk) && <ConfDots phId={ph.id} conf={ph.billingConf?.[activeMk] || null} onSet={setBillingConf} activeMk={activeMk} />}
              <div style={{ position: 'relative' }}>
                <button
                  ref={holdBtnRef}
                  title="Phase hold status"
                  onClick={() => {
                    if (!holdOpen) {
                      const r = holdBtnRef.current?.getBoundingClientRect()
                      if (r) setHoldPos({ top: r.top, left: r.left })
                    }
                    setHoldOpen(v => !v)
                  }}
                  className="flex items-center justify-center rounded transition-colors"
                  style={{
                    width: 22, height: 18, fontSize: 13,
                    background: onHold ? 'rgba(107,114,128,0.18)' : 'rgba(189,100,57,0.08)',
                    color: onHold ? '#6b7280' : '#BD6439',
                    border: '1px solid ' + (onHold ? 'rgba(107,114,128,0.25)' : 'rgba(189,100,57,0.25)'),
                    cursor: 'pointer', borderRadius: 3,
                  }}
                >
                  <i className={clsx('ti', onHold ? HOLD_ICONS[ph.holdStatus] : 'ti-activity')} />
                </button>
              </div>
              {holdOpen && createPortal(
                <div
                  ref={holdRef}
                  style={{
                    position: 'fixed',
                    top: holdPos.top - 4,
                    left: holdPos.left,
                    transform: 'translateY(-100%)',
                    zIndex: 99999,
                    background: '#fff',
                    border: '1px solid rgba(61,57,53,0.2)',
                    borderRadius: 6,
                    padding: '4px 0',
                    minWidth: 200,
                    boxShadow: '0 8px 30px rgba(61,57,53,0.3)',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#736F4C', padding: '4px 12px 6px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(61,57,53,0.08)' }}>Phase Status</div>
                  {[
                    { val: null, label: 'Active (no hold)', icon: 'ti-circle-check', color: '#2d7a3a' },
                    { val: 'not-authorized', label: 'Not Authorized', icon: 'ti-lock', color: '#6b7280' },
                    { val: 'awaiting-approval', label: 'Awaiting Approval', icon: 'ti-clock', color: '#b45309' },
                  ].map(opt => (
                    <button
                      key={opt.val || 'active'}
                      onClick={() => {
                        if (opt.val === null) setHoldStatus(ph.id, null)
                        else setHoldStatus(ph.id, opt.val)
                        setHoldOpen(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{
                        background: (ph.holdStatus || null) === opt.val ? 'rgba(61,57,53,0.08)' : 'transparent',
                        color: opt.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: (ph.holdStatus || null) === opt.val ? 600 : 400,
                      }}
                    >
                      <i className={clsx('ti', opt.icon)} style={{ fontSize: 14 }} />
                      {opt.label}
                      {(ph.holdStatus || null) === opt.val && <i className="ti ti-check" style={{ fontSize: 12, marginLeft: 'auto' }} />}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </>
          )}
        </div>
      </td>

      {/* Fee / remaining */}
      <td className="text-right px-2 py-1 border-b border-sand-2" style={{ minWidth: COL_FEE }}>
        <div className="text-xs">{fmt(ph.fee)}</div>
        <div className="text-2xs text-olive">{ph.done ? 'Done' : `${fmt(rem)} rem`}</div>
      </td>

      {/* Month cells */}
      {visMonths.map(m => (
        <PctCell
          key={m.key}
          mk={m.key}
          phase={ph}
          project={p}
          isCurMo={m.key === activeMk}
          locked={lockedMonths.includes(m.key)}
          setPct={setPct}
        />
      ))}
    </tr>
  )
}

// ── PctCell ───────────────────────────────────────────────────────────────────
function PctCell({ mk, phase: ph, project: p, isCurMo, locked, setPct }) {
  const dollars = ph.monthly?.[mk] || 0
  const fee     = phFeeFC(ph)
  const pct     = fee > 0 ? Math.round(dollars / fee * 1000) / 10 : 0
  const conf    = isCurMo ? (ph.billingConf?.[mk] || null) : null

  const confBg = conf === 'g' ? 'rgba(74,124,63,0.45)'
    : conf === 'y' ? 'rgba(201,131,26,0.45)'
    : conf === 'r' ? 'rgba(160,53,42,0.45)'
    : ''

  const inputRef = useRef(null)

  // Keep input in sync when external changes come in
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = pct > 0 ? pct : ''
    }
  }, [pct])

  return (
    <td
      className={clsx('px-0.5 py-0.5 text-center', isCurMo && !confBg && 'bg-terracotta/15')}
      style={{
        minWidth: COL_MO,
        background: confBg || undefined,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        {ph.done || locked ? (
          <span className="text-xs" style={{ color: locked ? '#aaa' : '#888' }}>
            {pct > 0 ? pct + '%' : '—'}
          </span>
        ) : (
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={100}
            step={5}
            defaultValue={pct > 0 ? pct : ''}
            placeholder="—"
            onBlur={e => {
              const val = parseFloat(e.target.value) || 0
              setPct(p.id, ph.id, mk, val)
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            className={clsx(
              'w-12 text-center text-xs px-1 py-0.5 rounded border bg-transparent',
              'border-transparent hover:border-sand-3 focus:border-terracotta focus:bg-white focus:outline-none',
              pct > 0 && 'text-blue-600 font-semibold'
            )}
          />
        )}
        {dollars > 0 && (
          <div className="text-2xs text-dark-3">{fmt(dollars)}</div>
        )}
      </div>
    </td>
  )
}

// ── ConfDots ──────────────────────────────────────────────────────────────────
function ConfDots({ phId, conf, onSet, activeMk }) {
  const dots = [
    { val: 'g', color: '#4a7c3f', title: 'On track' },
    { val: 'y', color: '#c9831a', title: 'Somewhat confident' },
    { val: 'r', color: '#a0352a', title: 'At risk' },
  ]
  return (
    <div className="flex items-center gap-1">
      {dots.map(d => (
        <button
          key={d.val}
          title={d.title}
          onClick={() => onSet(phId, activeMk, d.val)}
          className="w-2.5 h-2.5 rounded-full border transition-all"
          style={{
            background: d.color,
            opacity: conf === d.val ? 1 : 0.2,
            borderColor: conf === d.val ? 'rgba(0,0,0,.2)' : 'transparent',
            transform: conf === d.val ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

// ── FlagCell ──────────────────────────────────────────────────────────────────
function flagTooltip({ note, newProject, flagBy, flagAt }) {
  const parts = []
  if (newProject) parts.push('New Project')
  else if (note) parts.push(note)
  if (flagBy) parts.push('— ' + flagBy)
  if (flagAt) {
    try { parts.push(new Date(flagAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })) } catch {}
  }
  return parts.join('\n') || 'Flagged'
}

function FlagCell({ flagged, note, newProject, flagBy, flagAt, isProject, pmHandle, context, sendChatMessage, onSave }) {
  const [showPopup, setShowPopup] = useState(false)

  const handleClick = () => {
    if (flagged) {
      onSave({ flag: false, note: '', newProject: false })
    } else {
      setShowPopup(true)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleClick}
        title={flagged ? flagTooltip({ note, newProject, flagBy, flagAt }) : 'Flag for follow-up'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          fontSize: 13, color: flagged ? '#c0392b' : '#ccc',
        }}
      >
        <i className={clsx('ti', flagged ? 'ti-flag-filled' : 'ti-flag')} />
      </button>
      {showPopup && createPortal(
        <FlagPopup
          isProject={isProject}
          pmHandle={pmHandle}
          context={context}
          sendChatMessage={sendChatMessage}
          onSave={data => { onSave(data); setShowPopup(false) }}
          onClose={() => setShowPopup(false)}
        />,
        document.body
      )}
    </div>
  )
}

// ── FlagPopup ─────────────────────────────────────────────────────────────────
function FlagPopup({ isProject, pmHandle, context, sendChatMessage, onSave, onClose }) {
  const [note, setNote] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [notify, setNotify] = useState(!!pmHandle)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const canSave = isNew || note.trim().length > 0

  const handleSave = () => {
    const data = { flag: true, note: isNew ? '' : note.trim(), newProject: isNew }
    onSave(data)
    if (notify && pmHandle) {
      const msg = isNew
        ? `@${pmHandle} — New project flag: ${context}`
        : `@${pmHandle} — Flag on ${context}: "${note.trim()}"`
      sendChatMessage?.(msg)
    }
  }

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }} onClick={onClose} />
    <div ref={ref} style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999,
      background: '#F5F5F1', border: '1px solid rgba(61,57,53,0.2)',
      borderRadius: 8, padding: 24, width: 340,
      boxShadow: '0 20px 60px rgba(61,57,53,0.4)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#3D3935', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="ti ti-flag-filled" style={{ color: '#c0392b', fontSize: 14 }} />
        Flag for Follow-up
      </div>

      {isProject && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3935', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} />
          New project
        </label>
      )}

      {!isNew && (
        <textarea
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Why is this being flagged?"
          rows={3}
          style={{
            width: '100%', fontSize: 12, padding: 8, borderRadius: 4,
            border: '1px solid rgba(61,57,53,0.2)', resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = '#BD6439'}
          onBlur={e => e.target.style.borderColor = 'rgba(61,57,53,0.2)'}
        />
      )}

      {pmHandle && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#736F4C', marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
          Notify <strong style={{ color: '#BD6439' }}>@{pmHandle}</strong> in chat
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 4,
            border: '1px solid rgba(61,57,53,0.15)', background: '#F5F5F1',
            color: '#736F4C', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Cancel</button>
        <button
          disabled={!canSave}
          onClick={handleSave}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 4,
            border: 'none', background: canSave ? '#c0392b' : '#ccc',
            color: '#fff', cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit', fontWeight: 600,
          }}
        >Flag</button>
      </div>
    </div>
    </>
  )
}
