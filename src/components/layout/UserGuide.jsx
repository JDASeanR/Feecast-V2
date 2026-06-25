import { useState } from 'react'
import { clsx } from '../../lib/utils'

const SECTIONS = [
  { id: 'overview', icon: 'ti-home', label: 'Overview' },
  { id: 'header', icon: 'ti-layout-navbar', label: 'Header & Navigation' },
  { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { id: 'summary', icon: 'ti-chart-bar', label: 'Summary' },
  { id: 'billing', icon: 'ti-calendar-dollar', label: 'Billing' },
  { id: 'projects', icon: 'ti-folder', label: 'Projects' },
  { id: 'opportunities', icon: 'ti-rocket', label: 'Opportunities' },
  { id: 'ar', icon: 'ti-receipt', label: 'A/R' },
  { id: 'followup', icon: 'ti-flag', label: 'Follow-up' },
  { id: 'warnings', icon: 'ti-alert-triangle', label: 'Allocation Warnings' },
  { id: 'reports', icon: 'ti-file-analytics', label: 'Reports' },
  { id: 'widgets', icon: 'ti-chart-area-line', label: 'Widgets' },
  { id: 'settings', icon: 'ti-settings', label: 'Settings' },
  { id: 'tips', icon: 'ti-bulb', label: 'Tips & Shortcuts' },
]

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: '"League Gothic",sans-serif', fontSize: 22, letterSpacing: '0.03em', color: '#3D3935', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #BD6439' }}>{title}</h2>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#3D3935' }}>{children}</div>
    </div>
  )
}

function Feature({ icon, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <i className={clsx('ti', icon)} style={{ fontSize: 18, color: '#BD6439', marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#736F4C', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

function Key({ children }) {
  return <span style={{ display: 'inline-block', background: '#ECEAE3', border: '1px solid rgba(61,57,53,0.15)', borderRadius: 3, padding: '1px 6px', fontSize: 11, fontFamily: 'monospace', color: '#3D3935' }}>{children}</span>
}

const CONTENT = {
  overview: (
    <Section title="Welcome to Feecast">
      <p style={{ marginBottom: 12 }}>Feecast is a project billing tracker built for architecture and design firms. It connects to your Smartsheet data to give you real-time visibility into billings, projections, A/R aging, and pipeline — all in one place.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
        {[
          { icon: 'ti-layout-dashboard', t: 'Dashboard', d: 'Firm-wide KPIs, monthly bars, A/R summary' },
          { icon: 'ti-calendar-dollar', t: 'Billing', d: 'Monthly allocation grid with % entry per phase' },
          { icon: 'ti-folder', t: 'Projects', d: 'Hierarchical project/phase management' },
          { icon: 'ti-chart-area-line', t: 'Widgets', d: 'D3-powered charts with interactive hover' },
          { icon: 'ti-receipt', t: 'A/R', d: 'Invoice aging with bucket tracking' },
          { icon: 'ti-file-analytics', t: 'Reports', d: 'PDF export for Financial, Project, A/R, Pipeline' },
        ].map(c => (
          <div key={c.t} style={{ background: '#F5F5F1', borderRadius: 5, padding: '10px 14px', borderTop: '2px solid #BD6439' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <i className={clsx('ti', c.icon)} style={{ fontSize: 14, color: '#BD6439' }} />
              <span style={{ fontWeight: 700, fontSize: 12 }}>{c.t}</span>
            </div>
            <div style={{ fontSize: 11, color: '#736F4C' }}>{c.d}</div>
          </div>
        ))}
      </div>
      <p>Data is stored in Supabase and synced from Smartsheet. Multiple users can work simultaneously — you'll see presence badges in the header when others are online.</p>
    </Section>
  ),

  header: (
    <Section title="Header & Navigation">
      <Feature icon="ti-device-floppy" title="Save">Saves all changes to the cloud. Auto-save triggers on every edit, but you can manually save anytime.</Feature>
      <Feature icon="ti-refresh" title="Sync / Sync A/R">Pulls the latest project and A/R data from Smartsheet. Requires a Smartsheet API token and Sheet ID configured in Settings.</Feature>
      <Feature icon="ti-settings" title="Settings">Opens the settings panel for PMs, scope types, billing goals, email digest configuration, and more.</Feature>
      <Feature icon="ti-users" title="Presence Badges">Colored circles show other users currently online. Your badge has a terracotta border.</Feature>
      <Feature icon="ti-arrows-exchange" title="Tab Reordering">Drag any tab to reorder. Your custom order is saved and persists across sessions.</Feature>
      <Feature icon="ti-logout" title="Logout">Signs you out. Your preferences (filters, expand states, tab order) are saved locally and restored on next login.</Feature>
    </Section>
  ),

  dashboard: (
    <Section title="Dashboard">
      <p style={{ marginBottom: 12 }}>The dashboard provides a firm-wide overview at a glance.</p>
      <Feature icon="ti-chart-bar" title="Hero KPIs">Top bar shows YTD billings, projected full year vs. goal, firm WIP percentage, and contracted backlog in months.</Feature>
      <Feature icon="ti-alert-triangle" title="Signal Strip">Five cards highlight A/R past due, 90+ day invoices, pipeline weighted value, and project flags. Click any card to navigate to its tab.</Feature>
      <Feature icon="ti-chart-line" title="More Stats Popover">Click any of the three links (Year-over-Year, FF Per Employee, Quarterly Avgs) to see expanded analytics. The YOY chart supports up to 3 years with vivid color-coded lines.</Feature>
      <Feature icon="ti-chart-bar" title="Monthly Projections">Horizontal bar chart showing projected vs. actual billings by month, with goal line and pipeline overlay.</Feature>
      <Feature icon="ti-receipt" title="A/R Sidebar">Right-side panel shows total outstanding, past due breakdown by aging bucket, and individual invoice details.</Feature>
    </Section>
  ),

  summary: (
    <Section title="Summary">
      <p style={{ marginBottom: 12 }}>A grid view showing monthly billings by PM with firm totals. Each PM row shows their monthly allocations in a heatmap-style grid, with pipeline projections shown as dashed additions.</p>
      <Feature icon="ti-table" title="PM Grid">Each row is a PM. Columns are months. Cell height indicates billings relative to goal. Green means on/above goal, terracotta means below.</Feature>
      <Feature icon="ti-settings-2" title="PM Settings">Click the gear icon on any PM row to adjust their individual monthly goal or view detailed breakdowns.</Feature>
    </Section>
  ),

  billing: (
    <Section title="Billing">
      <p style={{ marginBottom: 12 }}>The billing tab is the primary workspace for managing monthly fee allocations across all projects and phases.</p>
      <Feature icon="ti-percentage" title="Percentage Entry">Type a percentage (0–100) in any month cell to allocate that portion of the phase fee to that month. The dollar amount calculates automatically.</Feature>
      <Feature icon="ti-flag" title="Flags">Click the flag icon on any project or phase row to flag it for follow-up. A popup requires a note explaining why (or check "New Project" to skip the note). Flags appear in the Follow-up tab with full attribution.</Feature>
      <Feature icon="ti-activity" title="Phase Hold Status">Click the pulse icon on any phase to set it as "Not Authorized" or "Awaiting Approval". Held phases are dimmed and excluded from allocation warnings.</Feature>
      <Feature icon="ti-circle-check" title="Confidence Dots">Three colored dots (green/yellow/red) let you indicate billing confidence for the current month on each phase.</Feature>
      <Feature icon="ti-calendar-minus" title="Show Past Months">Toggle to reveal historical months in the grid.</Feature>
      <Feature icon="ti-circle-check" title="Hide Billed Out">Hides phases that are fully billed (remaining = $0).</Feature>
      <Feature icon="ti-refresh" title="EOY Rollover">Moves all remaining unallocated balances into the current month. Use with caution — prompts for confirmation.</Feature>
      <p style={{ marginTop: 8 }}><strong>Tip:</strong> All filter and expand states persist when you switch tabs and come back.</p>
    </Section>
  ),

  projects: (
    <Section title="Projects">
      <p style={{ marginBottom: 12 }}>Hierarchical view of all projects grouped by PM and client. Manage project details, phases, and allocations.</p>
      <Feature icon="ti-folder" title="Project Hierarchy">Projects are grouped: PM → Client → Project → Addendum → Phases. Click the expand arrows to drill down.</Feature>
      <Feature icon="ti-pencil" title="Edit Projects">Click any project name to open the edit modal. Add/remove phases, change PM, client, status, project number, and notes.</Feature>
      <Feature icon="ti-archive" title="Archive">Archive completed projects to hide them from active views. Toggle "Show Archived" in the toolbar to see them.</Feature>
      <Feature icon="ti-filter" title="Filters">Filter by PM, status, hide done projects/phases. Search by project name. All filters persist across tab switches.</Feature>
      <Feature icon="ti-flag" title="Flags (Read-Only)">Flags set in the Billing tab appear here as read-only indicators. Hover to see the note.</Feature>
    </Section>
  ),

  opportunities: (
    <Section title="Opportunities">
      <p style={{ marginBottom: 12 }}>Track your business pipeline from initial radar through proposal to won/lost.</p>
      <Feature icon="ti-rocket" title="Pipeline Stages">Opportunities flow through: Radar → Proposal Requested → Proposal Sent → Won → Lost.</Feature>
      <Feature icon="ti-percentage" title="Confidence & Weighted Value">Set a confidence percentage (0–100%) on each opportunity. The weighted value (fee × confidence) feeds into dashboard pipeline projections.</Feature>
      <Feature icon="ti-transfer" title="Convert to Project">When an opportunity is won, convert it directly into a project with phases pre-populated.</Feature>
      <Feature icon="ti-calendar" title="Monthly Allocation">Allocate anticipated fee across months for pipeline-stage opportunities to include them in projections.</Feature>
    </Section>
  ),

  ar: (
    <Section title="A/R (Accounts Receivable)">
      <p style={{ marginBottom: 12 }}>Track outstanding invoices by aging bucket with full filtering and sorting.</p>
      <Feature icon="ti-receipt" title="Aging Buckets">Invoices are automatically categorized: Current (0–30 days), 30–60, 60–90, 90–120, and 120+ days. Bucket overrides can be set per invoice.</Feature>
      <Feature icon="ti-flag" title="Flag for Follow-up">Flag individual invoices for the Follow-up tab. Flagged invoices show a badge count on the Follow-up tab icon.</Feature>
      <Feature icon="ti-check" title="Mark Paid">Click the checkmark to mark an invoice as paid. Toggle "Show Paid" to see cleared invoices.</Feature>
      <Feature icon="ti-arrows-sort" title="Sort & Filter">Sort by any column (days, amount, client). Filter by PM, aging bucket, or flagged status.</Feature>
    </Section>
  ),

  followup: (
    <Section title="Follow-up">
      <p style={{ marginBottom: 12 }}>A unified view of everything flagged for attention — projects, phases, and A/R invoices.</p>
      <Feature icon="ti-flag" title="Flag Notes">Each flagged item shows the note that was entered, who flagged it, and when. This makes follow-up meetings actionable.</Feature>
      <Feature icon="ti-tag" title="New Project Badge">Projects flagged as "New Project" show a blue badge instead of a note.</Feature>
      <Feature icon="ti-check" title="Quick Actions">Unflag items directly from this tab, or mark A/R invoices as paid.</Feature>
    </Section>
  ),

  warnings: (
    <Section title="Allocation Warnings">
      <p style={{ marginBottom: 12 }}>Identifies phases where future allocations don't match the remaining fee balance.</p>
      <Feature icon="ti-alert-triangle" title="Under-Allocated">Phase has remaining fee but future months don't add up to cover it. You need to allocate more months.</Feature>
      <Feature icon="ti-alert-circle" title="Over-Allocated">Future month allocations exceed the remaining fee. Reduce allocations or verify the fee is correct.</Feature>
      <Feature icon="ti-lock" title="Held Phases">Phases marked as "Not Authorized" or "Awaiting Approval" in the Billing tab are excluded from warnings and shown in a separate section.</Feature>
    </Section>
  ),

  reports: (
    <Section title="Reports">
      <p style={{ marginBottom: 12 }}>Generate and export professional PDF reports.</p>
      <Feature icon="ti-file-analytics" title="Report Types">Four reports available: Firm Financial Summary, Project Status Report, A/R Aging Report, and Opportunities Report.</Feature>
      <Feature icon="ti-filter" title="Filters">Filter by PM, client, and date range. Project Status report supports sort by PM or Client and hiding done items.</Feature>
      <Feature icon="ti-template" title="Templates">Choose between Letterhead (full branded header) and Minimal (clean, compact) styles for the HTML preview.</Feature>
      <Feature icon="ti-download" title="PDF Export">All four reports export as vector PDFs using react-pdf — sharp at any zoom, proper page breaks, print-ready.</Feature>
      <Feature icon="ti-mail" title="Email">Send reports via email directly from the app (uses the Resend API).</Feature>
    </Section>
  ),

  widgets: (
    <Section title="Widgets">
      <p style={{ marginBottom: 12 }}>Interactive D3.js charts with WSJ-style hover crosshairs for detailed data exploration.</p>
      <Feature icon="ti-chart-area-line" title="Billing Progress">Current year Goal vs. Fixed Fee vs. Gross billings with area fills and monthly dots.</Feature>
      <Feature icon="ti-chart-area-line" title="Projections by Type">Overlapping area chart showing billings broken down by scope/project type (CA, COM, SFD, MF, etc.).</Feature>
      <Feature icon="ti-chart-area-line" title="Fees by PM">Area chart showing each PM's monthly billing contributions with distinct colors.</Feature>
      <Feature icon="ti-chart-area-line" title="Historical Monthly">Long-range view from 2016 showing Goal, FF, and Gross with the goal line stepping when targets changed.</Feature>
      <Feature icon="ti-chart-area-line" title="Historical Annual">Cumulative sawtooth chart — gross billings accumulate through the year, reset each January, compared against cumulative goal.</Feature>
      <p style={{ marginTop: 8 }}><strong>Hover interaction:</strong> Move your mouse across any chart to see a vertical crosshair with a tooltip showing exact values for all series at that point.</p>
    </Section>
  ),

  settings: (
    <Section title="Settings">
      <p style={{ marginBottom: 12 }}>Configure all firm and app settings from the gear icon in the header.</p>
      <Feature icon="ti-users" title="Project Managers">Add, edit, or remove PMs. Set individual monthly goals and email addresses for digest delivery.</Feature>
      <Feature icon="ti-tag" title="Scope & Project Types">Define scope codes (SD, DD, CD, CA, etc.) and project type classifications (SFD, MF, COM, etc.).</Feature>
      <Feature icon="ti-target" title="Billing Goals">Set annual and monthly billing targets. Changing one automatically updates the other (annual = monthly × 12). Use the Monthly Overrides grid to set different targets for individual months — blank months use the default. The effective annual total recalculates automatically. Overrides are reflected in the Dashboard, Billing tab, and Widgets charts.</Feature>
      <Feature icon="ti-id-badge" title="Employee Counts">Set billable and total employee counts used for per-employee revenue calculations on the Dashboard.</Feature>
      <Feature icon="ti-building" title="Firm & App">Set firm name, upload logo (used in reports and email digest), and configure the Smartsheet connection.</Feature>
      <Feature icon="ti-mail" title="Email Digest">Configure automated daily digest emails — set schedule, recipients, and sections to include. Use "Send Digest Now" for immediate delivery.</Feature>
      <Feature icon="ti-bell" title="Projection Reminders">Automated emails to PMs with under-allocated phases. Configurable cadence (daily, weekly, bi-weekly) with a separate admin summary. Use "Send Reminders Now" for on-demand.</Feature>
    </Section>
  ),

  tips: (
    <Section title="Tips & Shortcuts">
      <Feature icon="ti-bulb" title="Persistent Preferences">All filters, expand/collapse states, and sort orders are saved in your browser. Switch tabs freely — everything stays where you left it.</Feature>
      <Feature icon="ti-arrows-exchange" title="Drag to Reorder Tabs">Grab any tab and drag it to a new position. Your custom order persists across sessions.</Feature>
      <Feature icon="ti-flag" title="Flagging Workflow">Flag items in the Billing tab → they appear in Follow-up with your name, note, and timestamp → discuss in meetings → unflag when resolved.</Feature>
      <Feature icon="ti-lock" title="Hold Status Workflow">Set phases to "Not Authorized" or "Awaiting Approval" in Billing → they're excluded from allocation warnings → clear the hold when you get the green light.</Feature>
      <Feature icon="ti-users" title="Multi-User">Multiple users can work simultaneously. Presence badges show who's online. Changes auto-save and sync.</Feature>
      <Feature icon="ti-refresh" title="Smartsheet Sync">Use "Sync" for project data and "Sync A/R" for invoice data. Both pull from configured Smartsheet sheets.</Feature>
      <Feature icon="ti-keyboard" title="Billing Grid">In the billing grid, type a % and press <Key>Enter</Key> or <Key>Tab</Key> to move to the next cell. The dollar amount calculates automatically from the phase fee.</Feature>
    </Section>
  ),
}

export default function UserGuide({ onClose }) {
  const [section, setSection] = useState('overview')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', background: 'rgba(61,57,53,0.5)' }}>
      <div style={{
        margin: '24px auto', width: '100%', maxWidth: 960, background: '#fff',
        borderRadius: 8, display: 'flex', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(61,57,53,0.35)',
        maxHeight: 'calc(100vh - 48px)',
      }}>
        {/* Sidebar */}
        <div style={{
          width: 200, flexShrink: 0, background: '#3D3935', padding: '16px 0',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontFamily: '"League Gothic",sans-serif', fontSize: 18, letterSpacing: '0.04em',
            color: '#F5F5F1', padding: '0 16px 12px', borderBottom: '1px solid rgba(245,245,241,0.1)',
            marginBottom: 8,
          }}>
            User Guide
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 16px', fontSize: 12, fontFamily: 'inherit',
                color: section === s.id ? '#F5F5F1' : 'rgba(245,245,241,0.5)',
                background: section === s.id ? 'rgba(189,100,57,0.3)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderLeft: section === s.id ? '3px solid #BD6439' : '3px solid transparent',
              }}
            >
              <i className={clsx('ti', s.icon)} style={{ fontSize: 14 }} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#736F4C',
            }}
          >
            <i className="ti ti-x" />
          </button>
          {CONTENT[section]}
        </div>
      </div>
    </div>
  )
}
