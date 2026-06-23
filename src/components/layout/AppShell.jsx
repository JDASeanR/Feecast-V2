import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { clsx } from '../../lib/utils'

// Tab placeholders — we'll fill these in one by one
import PlaceholderTab from './PlaceholderTab.jsx'
import BillingTab from '../tabs/BillingTab.jsx'
import ProjectsTab from '../tabs/ProjectsTab.jsx'
import OpportunitiesTab from '../tabs/OpportunitiesTab.jsx'
import ARTab from '../tabs/ARTab.jsx'
import FollowUpTab from '../tabs/FollowUpTab.jsx'
import AllocationWarningsTab from '../tabs/AllocationWarningsTab.jsx'
import DashboardTab from '../tabs/DashboardTab.jsx'
import SummaryTab from '../tabs/SummaryTab.jsx'
import ReportsTab from '../tabs/ReportsTab.jsx'

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
]

export default function AppShell({ session, store }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingAR, setSyncingAR] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const { appState, saveStatus, updateAvail, dismissUpdate, presence, mutate } = store

  const handleLogout = async () => { await supabase.auth.signOut() }

  const doSync = async () => {
    const token = appState.settings?.ssToken
    const sheetId = appState.settings?.sheetId
    if (!token) { setSyncMsg('✗ No Smartsheet token — open Settings in the original app to set it'); return }
    setSyncing(true); setSyncMsg(null)
    try {
      const resp = await fetch('/api/smartsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sheetId })
      })
      const data = await resp.json()
      if (resp.ok) {
        if (data.projects) {
          mutate(prev => ({ ...prev, projects: data.projects }))
          setSyncMsg(`✓ Synced ${data.projects.length} projects`)
        } else setSyncMsg('✓ Sync complete')
      } else setSyncMsg('✗ ' + (data.error||'Sync failed'))
    } catch(e) { setSyncMsg('✗ ' + e.message) }
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 4000)
  }

  const doSyncAR = async () => {
    const token = appState.settings?.ssToken
    const sheetId = appState.settings?.sheetId
    if (!token) { setSyncMsg('✗ No Smartsheet token — open Settings in the original app to set it'); return }
    setSyncingAR(true); setSyncMsg(null)
    try {
      const resp = await fetch('/api/smartsheet-ar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sheetId })
      })
      const data = await resp.json()
      if (resp.ok) {
        if (data.invoices) {
          mutate(prev => ({ ...prev, invoices: data.invoices }))
          setSyncMsg(`✓ Synced ${data.invoices.length} invoices`)
        } else setSyncMsg('✓ A/R sync complete')
      } else setSyncMsg('✗ ' + (data.error||'A/R sync failed'))
    } catch(e) { setSyncMsg('✗ ' + e.message) }
    setSyncingAR(false)
    setTimeout(() => setSyncMsg(null), 4000)
  }

  // Badge colors for presence
  const BADGE_COLORS = ['#BD6439','#736F4C','#3D3935','#2d7a3a','#3b82f6']
  const initials = email => email?.split('@')[0]?.slice(0,2)?.toUpperCase() || '?'

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>

      {/* Update banner */}
      {updateAvail && (
        <div className="bg-terracotta text-white text-xs px-4 py-2 flex items-center justify-between shrink-0">
          <span>Another user saved changes. Reload to get the latest.</span>
          <button onClick={dismissUpdate} className="font-semibold underline ml-4">Reload now</button>
        </div>
      )}

      {/* Header */}
      <header className="bg-dark text-white px-3 py-2 flex items-center gap-2 shrink-0">
        <div className="font-display text-2xl font-bold tracking-tight mr-2">
          Fee<span className="text-terracotta">cast</span>
        </div>

        {/* Save status */}
        {saveStatus === 'saving' && <span className="text-2xs text-dark-3"><i className="ti ti-loader-2 spin mr-1" />Saving…</span>}
        {saveStatus === 'saved'  && <span className="text-2xs text-olive"><i className="ti ti-cloud-check mr-1" />Saved</span>}
        {saveStatus === 'error'  && <span className="text-2xs text-flag"><i className="ti ti-cloud-x mr-1" />Save failed</span>}

        {/* Sync msg */}
        {syncMsg && <span className={clsx('text-2xs ml-1', syncMsg.startsWith('✓')?'text-olive':'text-flag')}>{syncMsg}</span>}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Sync */}
          <button onClick={doSync} disabled={syncing}
            className="btn btn-sm text-dark-3 border-dark-2 hover:text-white hover:bg-dark-2 text-2xs">
            {syncing ? <><i className="ti ti-loader-2 spin" /> Syncing…</> : <><i className="ti ti-refresh" /> Sync</>}
          </button>

          {/* A/R Sync */}
          <button onClick={doSyncAR} disabled={syncingAR}
            className="btn btn-sm text-dark-3 border-dark-2 hover:text-white hover:bg-dark-2 text-2xs">
            {syncingAR ? <><i className="ti ti-loader-2 spin" /> Syncing…</> : <><i className="ti ti-refresh" /> Sync A/R</>}
          </button>

          {/* Settings */}
          <button onClick={() => setSettingsOpen(true)}
            className="btn btn-sm text-dark-3 border-dark-2 hover:text-white hover:bg-dark-2 text-2xs">
            <i className="ti ti-settings" /> Settings
          </button>

          {/* Presence badges */}
          {presence.filter(u => u !== session.user.email).map((email, i) => (
            <div key={email} title={email}
              className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-white shrink-0"
              style={{ background: BADGE_COLORS[i % BADGE_COLORS.length], fontSize: 9 }}>
              {initials(email)}
            </div>
          ))}

          {/* Current user */}
          <div title={session.user.email}
            className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-white shrink-0 border-2 border-terracotta"
            style={{ background: '#3D3935', fontSize: 9 }}>
            {initials(session.user.email)}
          </div>

          {/* Logout */}
          <button onClick={handleLogout}
            className="btn btn-sm text-dark-3 border-dark-2 hover:text-white hover:bg-dark-2 text-2xs ml-1">
            <i className="ti ti-logout" />
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="bg-white border-b border-sand-3 px-2 flex gap-0.5 shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          // Compute badges
          let badge = null
          if (tab.id === 'followup') {
            const flaggedProjects = appState.projects.filter(p => !p.archived && !p.done && p.flag).length
            const flaggedAR       = appState.invoices.filter(i => !i.paid && i.flag).length
            const count           = flaggedProjects + flaggedAR
            if (count > 0) badge = count
          }
          if (tab.id === 'warnings') {
            // warnings count calculated from phVal — we'll wire properly when building that tab
            // for now just show the tab
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx('tab-btn relative', activeTab === tab.id && 'active')}
            >
              <i className={clsx('ti', tab.icon)} />
              {tab.label}
              {badge != null && (
                <span className="absolute -top-0.5 -right-0.5 badge bg-terracotta text-white text-2xs">
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
          ? <BillingTab appState={appState} mutate={store.mutate} />
          : activeTab === 'projects'
          ? <ProjectsTab appState={appState} mutate={store.mutate} />
          : activeTab === 'opportunities'
          ? <OpportunitiesTab appState={appState} mutate={store.mutate} />
          : activeTab === 'ar'
          ? <ARTab appState={appState} mutate={store.mutate} />
          : activeTab === 'followup'
          ? <FollowUpTab appState={appState} mutate={store.mutate} />
          : activeTab === 'warnings'
          ? <AllocationWarningsTab appState={appState} />
          : activeTab === 'reports'
          ? <ReportsTab appState={appState} />
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

      {/* Settings stub */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <i className="ti ti-settings text-4xl text-olive mb-3 block" />
            <div className="font-semibold mb-2">Settings</div>
            <div className="text-xs text-dark-3 mb-4">Full settings panel coming in the next session — use the original app at feecast.app to change settings for now.</div>
            <button onClick={() => setSettingsOpen(false)} className="btn btn-primary text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
