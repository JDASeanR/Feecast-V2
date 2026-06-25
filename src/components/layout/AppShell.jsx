import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { clsx, useLocalPref } from '../../lib/utils'

import PlaceholderTab from './PlaceholderTab.jsx'
import SettingsModal from './SettingsModal.jsx'
import BillingTab from '../tabs/BillingTab.jsx'
import ProjectsTab from '../tabs/ProjectsTab.jsx'
import OpportunitiesTab from '../tabs/OpportunitiesTab.jsx'
import ARTab from '../tabs/ARTab.jsx'
import FollowUpTab from '../tabs/FollowUpTab.jsx'
import AllocationWarningsTab from '../tabs/AllocationWarningsTab.jsx'
import DashboardTab from '../tabs/DashboardTab.jsx'
import SummaryTab from '../tabs/SummaryTab.jsx'
import ReportsTab from '../tabs/ReportsTab.jsx'
import WidgetsTab from '../tabs/WidgetsTab.jsx'
import UserGuide from './UserGuide.jsx'

const TABS = [
  { id: 'dashboard',     label: 'Dashboard',          icon: 'ti-layout-dashboard' },
  { id: 'summary',       label: 'Summary',             icon: 'ti-chart-bar' },
  { id: 'billing',       label: 'Billing',             icon: 'ti-calendar-dollar' },
  { id: 'projects',      label: 'Projects',            icon: 'ti-folder' },
  { id: 'opportunities', label: 'Opportunities',       icon: 'ti-rocket' },
  { id: 'ar',            label: 'A/R',                 icon: 'ti-receipt' },
  { id: 'followup',      label: 'Follow-up',           icon: 'ti-flag' },
  { id: 'warnings',      label: 'Allocation Warnings', icon: 'ti-alert-triangle' },
  { id: 'reports',       label: 'Reports',             icon: 'ti-file-analytics' },
  { id: 'widgets',       label: 'Widgets',             icon: 'ti-chart-area-line' },
]

// ── Smartsheet parser ─────────────────────────────────────────────────────────
const CY_SYNC = new Date().getFullYear()
const SYNC_MONTHS = (() => {
  const m = []
  for (let y = CY_SYNC - 1; y <= CY_SYNC + 2; y++)
    for (let mo = 1; mo <= 12; mo++)
      m.push({ key: `${y}-${String(mo).padStart(2,'0')}` })
  return m
})()

function parseSmartsheetData(sheet) {
  const findCol = patterns => {
    for (const col of sheet.columns || []) {
      const t = (col.title || '').toUpperCase()
      if (patterns.some(p => t.includes(p.toUpperCase()))) return col.id
    }
    return null
  }
  const COL_PM     = findCol(['PM','PROJECT MANAGER'])
  const COL_PROJNO = findCol(['PROJ. NO.','PROJECT NO','PROJ NO','PROJECT NUMBER','PROJ #','PROJ.NO'])
  const COL_NAME   = findCol(['CLIENT | PROJECT NAME','PROJECT NAME','CLIENT/PROJECT','NAME'])
  const COL_PTYPE  = findCol(['PROJECT TYPE','TYPE'])
  const COL_SCOPE  = findCol(['SCOPE','PHASE TYPE'])
  const COL_LOC    = findCol(['LOCATION','LOC'])
  const COL_STATUS = findCol(['STATUS'])
  const COL_FEE    = findCol(['FEE','CONTRACT FEE','CONTRACTED','CONTRACT','TOTAL FEE','PHASE FEE'])
  const COL_PRIOR  = findCol(['PRIOR BILLED','BILLED TO DATE','PRIOR'])
  const COL_DONE   = findCol(['DONE','COMPLETE','COMPLETED'])

  const MON_COLS = {}
  const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  (sheet.columns || []).forEach(c => {
    const m = (c.title || '').trim().match(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2})\s+\$$/i)
    if (m) { const mon = MONTH_NAMES.indexOf(m[1].toUpperCase()) + 1; const yr = 2000 + parseInt(m[2]); MON_COLS[c.id] = `${yr}-${String(mon).padStart(2,'0')}` }
  })

  const cellVal = (row, colId) => { if (!colId) return null; const cell = row.cells?.find(c => c.columnId === colId); return cell?.value ?? cell?.displayValue ?? null }
  const sv = (row, colId, def = '') => { const v = cellVal(row, colId); if (v === null || v === undefined) return def; const s = String(v).trim(); return s === '' || s === 'nan' ? def : s }
  const fv = (row, colId) => { const v = cellVal(row, colId); if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[$,%]/g, '')); return isNaN(n) ? 0 : n }

  const STOP = new Set(['wip grand total','grand total fees','grand total wip','total unprojected','copy cells below for new projects','copy cells above for new projects'])
  const SKIP_SET = new Set(['monthly billings goal','monthly billings total','monthly hourly estimate','monthly fixed fee totals','billings goal delta','totals','wip total','wip grand total','grand total','grand total wip','total unprojected','place','holder','place holder','placeholder','project name','client name','2026 monthly billings goal','2025 avg.','q1','q2','q3','q4','scope','watermark','template',''])

  const isSkip = (name, pm) => {
    const l = name.toLowerCase().trim()
    if (SKIP_SET.has(l)) return true
    if (pm && l === pm.toLowerCase()) return true
    const isAllCapsName = name === name.toUpperCase() && name.length > 4 && /^[A-Z\s\.]+$/.test(name) && !name.includes('ADD')
    if (isAllCapsName && !name.includes('LLC') && !name.includes('INC') && !name.includes('CORP')) return true
    if (l.startsWith('totals') || l.startsWith('wip total') || l.startsWith('grand total') || l.startsWith('2026 monthly') || l.startsWith('monthly billing') || l.startsWith('copy cells') || l.startsWith('2025 avg')) return true
    if (l.includes('sub-consultant') || l.includes('sub consultant') || l.includes('mark-up') || l.includes('markup')) return true
    return false
  }

  const VALID_STATUS = new Set(['A','U','H','WIA','w','PP'])
  const VALID_TYPES  = new Set(['SFD','MF','COM','DG','PLN','DRP','OA'])
  const blankMonthly = () => Object.fromEntries(SYNC_MONTHS.map(m => [m.key, 0]))
  const cleanProjNo  = v => { const s = String(v || '').trim(); if (!s || s === 'XXXXX') return ''; const f = parseFloat(s); return isNaN(f) ? s : f.toFixed(1) }

  const projects = []
  let curPM = '', curClient = '', curProj = null, curAdd = null
  let projId = 1000, phaseId = 2000

  for (const row of (sheet.rows || [])) {
    const name   = sv(row, COL_NAME)
    const pmRaw  = sv(row, COL_PM)
    const projNo = cleanProjNo(cellVal(row, COL_PROJNO))
    const feeRaw = cellVal(row, COL_FEE)
    let scope    = sv(row, COL_SCOPE)
    const ptype  = sv(row, COL_PTYPE)
    const loc    = sv(row, COL_LOC, 'CA') || 'CA'
    const status = sv(row, COL_STATUS)
    const done   = fv(row, COL_DONE) === 1 || String(cellVal(row, COL_DONE) || '').toLowerCase() === 'true'
    const priorPct = fv(row, COL_PRIOR)

    if (!name) continue
    if (STOP.has(name.toLowerCase().trim())) break
    if (pmRaw && pmRaw !== 'ALL' && pmRaw !== curPM) { curPM = pmRaw; curClient = ''; curProj = null; curAdd = null }
    if (isSkip(name, curPM)) continue

    const hasFee    = feeRaw !== null && feeRaw !== '' && fv(row, COL_FEE) > 0
    const hasProjNo = projNo !== ''
    const isAddHdr  = !hasFee && !hasProjNo && (name.toUpperCase().startsWith('ADD ') || name.toUpperCase().startsWith('ADD#') || (name.toUpperCase().includes('ADD') && name.includes('#')))

    if (!hasFee && !hasProjNo && !isAddHdr) { curClient = name; curProj = null; curAdd = null; continue }
    if (isAddHdr) { curAdd = name; continue }

    if (hasProjNo && !hasFee) {
      const st = VALID_STATUS.has(status) ? status : 'U'
      curProj = { id: projId++, pm: curPM || 'SR', projNo, client: curClient, project: name, type: VALID_TYPES.has(ptype) ? ptype : 'SFD', location: loc, status: st, flag: false, done, archived: false, notes: '', phases: [] }
      curAdd = null; projects.push(curProj); continue
    }

    if (hasFee || (!hasProjNo && !isAddHdr && fv(row, COL_FEE) === 0 && scope)) {
      if (!scope) scope = 'SD'
      if (!curProj) {
        const st = VALID_STATUS.has(status) ? status : 'U'
        curProj = { id: projId++, pm: curPM || 'SR', projNo: '', client: curClient, project: curClient || name, type: 'SFD', location: loc, status: st, flag: false, done: false, archived: false, notes: '', phases: [] }
        projects.push(curProj)
      }
      const fee = fv(row, COL_FEE)
      const billed = Math.round(fee * priorPct * 100) / 100
      const pct = Math.min(100, Math.round(priorPct * 100))
      const monthly = blankMonthly()
      Object.entries(MON_COLS).forEach(([colId, mk]) => {
        const cell = row.cells?.find(c => c.columnId === +colId)
        const v = cell?.value
        if (v && typeof v === 'number' && v !== 0) monthly[mk] = Math.round(v * 100) / 100
      })
      curProj.phases.push({ id: phaseId++, name, scope, addendum: curAdd, hourly: false, caMonths: null, fee: Math.round(fee * 100) / 100, billed, pct, done, flag: false, archived: false, monthly })
    }
  }
  return projects.filter(p => p.phases.length > 0)
}

const AR_SHEET_ID = 'VVvfpGPFPJGJP8PqFg3qjqW87p7pJqXFX4QJFf21'

function parseARSmartsheetData(sheet, existingInvoices = []) {
  const findCol = patterns => { for (const col of sheet.columns || []) { const t = (col.title || '').toUpperCase(); if (patterns.some(p => t.includes(p.toUpperCase()))) return col.id } return null }
  const COL = {
    FOLLOWUP: findCol(['FOLLOW-UP','FOLLOW UP','FOLLOWUP']),
    BUCKET:   findCol(['DAYS PAST DUE','DAYS PAST','AGING','BUCKET']),
    CLIENT:   findCol(['CLIENT']),
    PM:       findCol(['PM','PROJECT MANAGER']),
    INVOICE:  findCol(['INVOICE NUMBER','INVOICE NO','INV NO','INV #']),
    PROJNO:   findCol(['PROJECT NUMBER','PROJECT NO','PROJ NO','PROJ #','PROJ. NO']),
    PROJECT:  (() => { for (const col of sheet.columns || []) { const t = (col.title || '').toUpperCase(); if (t === 'PROJECT' || t === 'PROJECT NAME') return col.id } return null })(),
    AMT_NC:   findCol(['AMOUNT - NO COMMITMENT','NO COMMITMENT']),
    AMT_C:    findCol(['AMOUNT - COMMITMENT']),
    NOTES:    findCol(['STATUS | COMMENTS','STATUS','COMMENTS','NOTES']),
  }
  const cellVal = (row, colId) => { if (!colId) return null; const cell = row.cells?.find(c => c.columnId === colId); return cell?.value ?? cell?.displayValue ?? null }
  const sv = (row, colId, def = '') => { const v = cellVal(row, colId); if (v === null || v === undefined) return def; const s = String(v).trim(); return s === '' || s === 'nan' ? def : s }
  const fv = (row, colId) => { const v = cellVal(row, colId); if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[$,]/g, '')); return isNaN(n) ? 0 : n }
  const BUCKETS = new Set(['0-30','30-60','60-90','90-120','120+'])
  const SKIP_CLIENTS = new Set(['0-30','30-60','60-90','90-120','120+','0-30 days','30-60 days','60-90 days','90-120 days','120 days','totals','already collected','previous month','anticipated','flagged items total','keep','do not move','do not delete',''])
  const isSkip = client => { const l = client.toLowerCase().trim(); if (SKIP_CLIENTS.has(l)) return true; if (l.startsWith('0-') || l.startsWith('30-') || l.startsWith('60-') || l.startsWith('90-') || l.startsWith('120') || l.startsWith('already') || l.startsWith('previous') || l.startsWith('anticipated') || l.startsWith('flagged')) return true; return false }
  const cleanInvoiceNo = v => { const s = String(v || '').trim(); if (!s) return ''; const f = parseFloat(s); return isNaN(f) ? s : String(Math.round(f)) }
  const cleanProjNo = v => { const s = String(v || '').trim(); if (!s) return ''; const f = parseFloat(s); return isNaN(f) ? s : f.toFixed(1) }
  const invoiceDateFromNo = invNo => { const s = String(invNo); if (s.length >= 8) { const yr = s.slice(0,4), mo = s.slice(4,6), dy = s.slice(6,8); if (+yr > 2000 && +mo >= 1 && +mo <= 12) return `${yr}-${mo}-${dy}` } if (s.length >= 6) { const yr = s.slice(0,4), mo = s.slice(4,6); if (+yr > 2000 && +mo >= 1 && +mo <= 12) return `${yr}-${mo}-01` } return '' }

  const invoices = []
  let nextId = (existingInvoices.reduce((m, i) => Math.max(m, i.id), 0) || 5000) + 1
  let curBucket = '0-30'

  for (const row of (sheet.rows || [])) {
    const dpd = sv(row, COL.BUCKET)
    if (BUCKETS.has(dpd)) curBucket = dpd
    const client = sv(row, COL.CLIENT)
    if (!client || isSkip(client)) continue
    const invRaw = sv(row, COL.INVOICE)
    if (!invRaw) continue
    const amtNC = fv(row, COL.AMT_NC), amtC = fv(row, COL.AMT_C)
    const amount = amtNC > 0 ? amtNC : amtC
    if (amount <= 0) continue
    const invNo  = cleanInvoiceNo(invRaw)
    const followUp = fv(row, COL.FOLLOWUP) === 1 || String(cellVal(row, COL.FOLLOWUP) || '').toLowerCase() === 'true'
    invoices.push({ id: nextId++, client, pm: sv(row, COL.PM), invoiceNo: invNo, projectNo: cleanProjNo(sv(row, COL.PROJNO)), project: sv(row, COL.PROJECT), amount: Math.round(amount * 100) / 100, invoiceDate: invoiceDateFromNo(invNo), bucketOverride: curBucket, committed: amtC > 0, committedDate: null, flag: followUp, paid: false, status: sv(row, COL.NOTES) })
  }
  return invoices
}

export default function AppShell({ session, store }) {
  const [activeTab, setActiveTab] = useLocalPref('activeTab', 'dashboard')
  const [tabOrder, setTabOrder] = useLocalPref('tabOrder', TABS.map(t => t.id))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [dragTab, setDragTab] = useState(null)

  const orderedTabs = tabOrder
    .map(id => TABS.find(t => t.id === id))
    .filter(Boolean)
    .concat(TABS.filter(t => !tabOrder.includes(t.id)))
  const [syncing, setSyncing] = useState(false)
  const [syncingAR, setSyncingAR] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const { appState, saveStatus, updateAvail, dismissUpdate, presence, mutate } = store

  const handleLogout = async () => { await supabase.auth.signOut() }

  const doSync = async () => {
    const token = appState.settings?.ssToken
    const sheetId = appState.settings?.sheetId
    if (!token) { setSyncMsg('✗ No Smartsheet token — set it in Settings on feecast.app first'); return }
    if (!sheetId) { setSyncMsg('✗ No Sheet ID — set it in Settings on feecast.app first'); return }
    setSyncing(true); setSyncMsg(null)
    try {
      const resp = await fetch('/api/smartsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sheetId })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setSyncMsg('✗ ' + (err.error || `API error ${resp.status}`))
        setSyncing(false); return
      }
      const sheet = await resp.json()
      const projects = parseSmartsheetData(sheet)
      if (!projects.length) { setSyncMsg('✗ No projects found — check Sheet ID'); setSyncing(false); return }
      mutate(prev => ({ ...prev, projects: JSON.parse(JSON.stringify(projects)) }))
      setSyncMsg(`✓ Synced ${projects.length} projects`)
    } catch(e) { setSyncMsg('✗ ' + e.message) }
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 5000)
  }

  const doSyncAR = async () => {
    const token = appState.settings?.ssToken
    if (!token) { setSyncMsg('✗ No Smartsheet token — set it in Settings on feecast.app first'); return }
    setSyncingAR(true); setSyncMsg(null)
    try {
      const resp = await fetch('/api/smartsheet-ar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sheetId: AR_SHEET_ID })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setSyncMsg('✗ ' + (err.error || `API error ${resp.status}`))
        setSyncingAR(false); return
      }
      const sheet = await resp.json()
      const invoices = parseARSmartsheetData(sheet, appState.invoices)
      if (!invoices.length) { setSyncMsg('✗ No invoices found in A/R sheet'); setSyncingAR(false); return }
      mutate(prev => ({ ...prev, invoices }))
      setSyncMsg(`✓ Synced ${invoices.length} invoices`)
    } catch(e) { setSyncMsg('✗ ' + e.message) }
    setSyncingAR(false)
    setTimeout(() => setSyncMsg(null), 5000)
  }

  const BADGE_COLORS = ['#BD6439','#736F4C','#3D3935','#2d7a3a','#3b82f6']
  const initials = email => email?.split('@')[0]?.slice(0,2)?.toUpperCase() || '?'

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>

      {/* Update banner */}
      {updateAvail && (
        <div className="text-xs px-4 py-2 flex items-center justify-between shrink-0"
          style={{ background: '#BD6439', color: '#F5F5F1' }}>
          <span>Another user saved changes. Reload to get the latest.</span>
          <button onClick={dismissUpdate} className="font-semibold underline ml-4">Reload now</button>
        </div>
      )}

      {/* Header — Graphite surface */}
      <header style={{ background: '#3D3935', color: '#F5F5F1' }}
        className="px-4 py-2 flex items-center gap-2 shrink-0">

        {/* Logo */}
        {appState?.settings?.firm?.logo && (
          <img src={appState.settings.firm.logo} alt="firm logo"
            style={{ height:28, maxWidth:80, objectFit:"contain", marginRight:4, opacity:0.92 }} />
        )}

        {/* Wordmark */}
        <div className="font-display tracking-display mr-3" style={{ fontSize: 22, letterSpacing: '0.02em' }}>
          FEE<span style={{ color: '#BD6439' }}>CAST</span>
        </div>

        {/* Save status */}
        {saveStatus === 'saving' && (
          <span className="text-2xs" style={{ color: '#736F4C' }}>
            <i className="ti ti-loader-2 spin mr-1" />Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-2xs" style={{ color: '#736F4C' }}>
            <i className="ti ti-cloud-check mr-1" />Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="text-2xs" style={{ color: '#c0392b' }}>
            <i className="ti ti-cloud-x mr-1" />Save failed
          </span>
        )}

        {syncMsg && (
          <span className="text-2xs ml-1" style={{ color: syncMsg.startsWith('✓') ? '#736F4C' : '#c0392b' }}>
            {syncMsg}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Header buttons — ghost style on dark surface */}
          {[
            { label: 'Save', icon: 'ti-device-floppy', onClick: () => store.save(appState), disabled: saveStatus === 'saving' },
            { label: 'Settings', icon: 'ti-settings', onClick: () => setSettingsOpen(true) },
            { label: 'Help', icon: 'ti-help-circle', onClick: () => setGuideOpen(true) },
          ].map(({ label, icon, onClick, disabled }) => (
            <button key={label} onClick={onClick} disabled={disabled}
              className="inline-flex items-center gap-1 px-2.5 py-1 font-display tracking-ui uppercase transition-colors cursor-pointer"
              style={{
                fontSize: 11,
                background: 'transparent',
                color: '#F5F5F1',
                border: '0.5px solid rgba(245,245,241,0.25)',
                borderRadius: 4,
                opacity: disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,245,241,0.6)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(245,245,241,0.25)'}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 13 }} /> {label}
            </button>
          ))}

          {/* Presence badges */}
          {presence.filter(u => u !== session.user.email).map((email, i) => (
            <div key={email} title={email}
              className="w-8 h-8 rounded-full flex items-center justify-center font-display shrink-0"
              style={{ background: BADGE_COLORS[i % BADGE_COLORS.length], color: '#F5F5F1', fontSize: 11 }}>
              {initials(email)}
            </div>
          ))}

          {/* Current user */}
          <div title={session.user.email}
            className="w-8 h-8 rounded-full flex items-center justify-center font-display shrink-0"
            style={{ background: '#3D3935', color: '#F5F5F1', fontSize: 11, border: '1.5px solid #BD6439' }}>
            {initials(session.user.email)}
          </div>

          {/* Logout */}
          <button onClick={handleLogout}
            className="inline-flex items-center px-2 py-1 transition-colors cursor-pointer"
            style={{
              fontSize: 12,
              background: 'transparent',
              color: 'rgba(245,245,241,0.5)',
              border: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#F5F5F1'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,241,0.5)'}
          >
            <i className="ti ti-logout" />
          </button>
        </div>
      </header>

      {/* Tab nav — Vellum surface, Terracotta underline on active */}
      <nav style={{ background: '#F5F5F1', borderBottom: '1px solid rgba(61,57,53,0.12)' }}
        className="px-2 flex gap-0 shrink-0 overflow-x-auto">
        {orderedTabs.map(tab => {
          const isActive = activeTab === tab.id
          let badge = null
          if (tab.id === 'followup') {
            const active = appState.projects.filter(p => !p.archived && !p.done)
            const flaggedProjects = active.filter(p => p.flag).length
            const flaggedPhases   = active.reduce((s, p) => s + p.phases.filter(ph => ph.flag).length, 0)
            const flaggedAR       = appState.invoices.filter(i => !i.paid && i.flag).length
            const count           = flaggedProjects + flaggedPhases + flaggedAR
            if (count > 0) badge = count
          }
          return (
            <button
              key={tab.id}
              draggable
              onDragStart={() => setDragTab(tab.id)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderLeft = '2px solid #BD6439' }}
              onDragLeave={e => { e.currentTarget.style.borderLeft = 'none' }}
              onDrop={e => {
                e.currentTarget.style.borderLeft = 'none'
                if (!dragTab || dragTab === tab.id) return
                setTabOrder(() => {
                  const order = orderedTabs.map(t => t.id)
                  const fromIdx = order.indexOf(dragTab)
                  const toIdx = order.indexOf(tab.id)
                  if (fromIdx === -1 || toIdx === -1) return order
                  order.splice(fromIdx, 1)
                  order.splice(toIdx, 0, dragTab)
                  return order
                })
                setDragTab(null)
              }}
              onDragEnd={() => setDragTab(null)}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 cursor-pointer transition-colors whitespace-nowrap font-display tracking-eyebrow uppercase"
              style={{
                fontSize: 10,
                color: isActive ? '#3D3935' : '#8a8580',
                borderBottom: isActive ? '2px solid #BD6439' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                opacity: dragTab === tab.id ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#3D3935' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#8a8580' }}
            >
              <i className={clsx('ti', tab.icon)} style={{ fontSize: 16 }} />
              {tab.label}
              {badge != null && (
                <span className="absolute -top-0.5 -right-0.5 badge"
                  style={{ background: '#BD6439', color: '#F5F5F1', fontSize: 9 }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      <main className="flex-1 min-h-0">
        {activeTab === 'dashboard'
          ? <DashboardTab appState={appState} onNavigate={setActiveTab} />
          : activeTab === 'summary'
          ? <SummaryTab appState={appState} />
          : activeTab === 'billing'
          ? <BillingTab appState={appState} mutate={store.mutate} session={session} />
          : activeTab === 'projects'
          ? <ProjectsTab appState={appState} mutate={store.mutate} />
          : activeTab === 'opportunities'
          ? <OpportunitiesTab appState={appState} mutate={store.mutate} />
          : activeTab === 'ar'
          ? <ARTab appState={appState} mutate={store.mutate} />
          : activeTab === 'followup'
          ? <FollowUpTab appState={appState} mutate={store.mutate} />
          : activeTab === 'warnings'
          ? <AllocationWarningsTab appState={appState} onNavigate={setActiveTab} />
          : activeTab === 'reports'
          ? <ReportsTab appState={appState} />
          : activeTab === 'widgets'
          ? <WidgetsTab appState={appState} />
          : <div className="overflow-auto h-full">
              <PlaceholderTab
                tabId={activeTab}
                label={TABS.find(t => t.id === activeTab)?.label}
                appState={appState}
                mutate={store.mutate}
              />
            </div>
        }
      </main>

      {settingsOpen && (
        <SettingsModal
          appState={appState}
          mutate={mutate}
          onClose={() => setSettingsOpen(false)}
          doSync={doSync}
          doSyncAR={doSyncAR}
          syncing={syncing}
          syncingAR={syncingAR}
          syncMsg={syncMsg}
        />
      )}
      {guideOpen && <UserGuide onClose={() => setGuideOpen(false)} />}
    </div>
  )
}
