import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { clsx } from '../../lib/utils'

// Tab placeholders — we'll fill these in one by one
import PlaceholderTab from './PlaceholderTab.jsx'

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
  const { appState, saveStatus, updateAvail, dismissUpdate } = store

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-sand flex flex-col">

      {/* Update banner */}
      {updateAvail && (
        <div className="bg-terracotta text-white text-xs px-4 py-2 flex items-center justify-between">
          <span>Another user saved changes. Reload to get the latest.</span>
          <button onClick={dismissUpdate} className="font-semibold underline ml-4">
            Reload now
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-dark text-white px-4 py-2 flex items-center gap-3 shrink-0">
        <div className="font-display text-2xl font-bold tracking-tight">
          Fee<span className="text-terracotta">cast</span>
        </div>
        <div className="text-xs text-dark-3 hidden sm:block">
          Jeffrey DeMure + Associates
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Save status */}
          {saveStatus === 'saving' && (
            <span className="text-2xs text-dark-3">
              <i className="ti ti-loader-2 spin mr-1" />Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-2xs text-olive">
              <i className="ti ti-cloud-check mr-1" />Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-2xs text-flag">
              <i className="ti ti-cloud-x mr-1" />Save failed
            </span>
          )}

          {/* User email */}
          <span className="text-2xs text-dark-3 hidden sm:block">
            {session.user.email}
          </span>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn btn-sm text-dark-3 border-dark-2 hover:text-white hover:bg-dark-2"
          >
            <i className="ti ti-logout" /> Sign out
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
      <main className="flex-1 overflow-auto">
        <PlaceholderTab
          tabId={activeTab}
          label={TABS.find(t => t.id === activeTab)?.label}
          appState={appState}
          mutate={store.mutate}
        />
      </main>

    </div>
  )
}
