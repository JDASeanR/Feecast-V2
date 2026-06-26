import { useState, useCallback } from 'react'
import { fmt, clsx, CUR_MK, CY, CM, useLocalPref } from '../../lib/utils'

// ── Phase calc helpers ────────────────────────────────────────────────────────
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
const phRem   = ph => Math.max(0, phFeeFC(ph) - (ph.billed || 0) - phYTD(ph))
const phAlloc = ph => Object.entries(ph.monthly || {})
  .filter(([mk]) => mk >= CUR_MK).reduce((s, [, v]) => s + (v || 0), 0)
const phAllocSt = ph => {
  const r = phRem(ph)
  if (r <= 0) return { cls: 'ok', txt: 'Billed out' }
  const a = phAlloc(ph), d = a - r
  if (Math.abs(d) < 1) return { cls: 'ok', txt: '100% allocated ✓' }
  if (d > 1) return { cls: 'over', txt: `Over by ${fmt(d)}` }
  return { cls: 'warn', txt: `${fmt(a)} of ${fmt(r)} alloc` }
}
const phVal = ph => { const r = phRem(ph); if (r <= 0) return null; const a = phAlloc(ph); return Math.abs(a - r) < 1 ? null : a > r ? 'over' : 'under' }
const pFee  = p => (p.phases || []).reduce((s, ph) => s + phFeeFC(ph), 0)
const pBil  = p => (p.phases || []).reduce((s, ph) => s + (ph.billed || 0), 0)
const pYTD  = p => (p.phases || []).reduce((s, ph) => s + phYTD(ph), 0)
const pRem  = p => pFee(p) - pBil(p) - pYTD(p)
const pWIP  = p => { const f = pFee(p); return f > 0 ? (pBil(p) + pYTD(p)) / f : 0 }

function resolveClient(c, projects, i) {
  if (c?.startsWith('ADD')) {
    for (let j = i - 1; j >= 0; j--)
      if (!projects[j].client?.startsWith('ADD')) return projects[j].client || '—'
  }
  return c || '—'
}

function blankMonthly() {
  const obj = {}
  for (let i = 0; i < 24; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    obj[mk] = 0
  }
  return obj
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectsTab({ appState, mutate }) {
  const { projects, settings } = appState
  const pmList    = (settings.pms || []).map(p => p.name)
  const scopeList = settings.scopeTypes || []
  const statusList = settings.statusTypes || []
  const typeList  = settings.projectTypes || []
  const clientList = settings.clients || []

  // ── Filters (persisted) ────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('')
  const [filterPM,       setFilterPM]       = useLocalPref('proj.filterPM', 'ALL')
  const [filterStatus,   setFilterStatus]   = useLocalPref('proj.filterStatus', 'ALL')
  const [showArchived,   setShowArchived]   = useLocalPref('proj.showArchived', false)
  const [hideDone,       setHideDone]       = useLocalPref('proj.hideDone', false)
  const [hideDonePhases, setHideDonePhases] = useLocalPref('proj.hideDonePhases', false)

  // ── Expand/collapse (persisted) ───────────────────────────────────────────
  const [expandedPM,      setExpandedPM]      = useLocalPref('proj.expPM', {})
  const [expandedClient,  setExpandedClient]  = useLocalPref('proj.expClient', {})
  const [expandedProject, setExpandedProject] = useLocalPref('proj.expProject', {})
  const [expandedAdd,     setExpandedAdd]     = useLocalPref('proj.expAdd', {})

  // ── Modals ────────────────────────────────────────────────────────────────
  const [editingProject,  setEditingProject]  = useState(null) // null | project | 'new'
  const [allocModal,      setAllocModal]      = useState(null) // null | {project, phase}
  const [renamingClient,  setRenamingClient]  = useState(null) // null | {old, value}

  const togglePM      = k => setExpandedPM(p      => ({ ...p, [k]: p[k] === false ? true : false }))
  const toggleClient  = k => setExpandedClient(p  => ({ ...p, [k]: p[k] === false ? true : false }))
  const toggleProject = k => setExpandedProject(p => ({ ...p, [k]: p[k] === false ? true : false }))
  const toggleAdd     = k => setExpandedAdd(p     => ({ ...p, [k]: p[k] === false ? true : false }))

  const collapseAll = () => {
    const pmKeys = {}, clientKeys = {}, projKeys = {}
    filtered.forEach(p => {
      pmKeys['pm-' + (p.pm || '—')] = false
      clientKeys[`client-${p.pm}-${p._client}`] = false
      projKeys[p.id] = false
    })
    setExpandedPM(pmKeys); setExpandedClient(clientKeys); setExpandedProject(projKeys)
  }
  const expandAll = () => {
    setExpandedPM({}); setExpandedClient({}); setExpandedProject({})
  }
  const allCollapsed = Object.values(expandedPM).some(v => v === false)

  // ── Filtered projects ─────────────────────────────────────────────────────
  const resolved = projects.map((p, i) => ({ ...p, _client: resolveClient(p.client, projects, i) }))
  let filtered = resolved.filter(p => showArchived ? p.archived : !p.archived)
  if (hideDone) filtered = filtered.filter(p => !p.done)
  if (filterPM !== 'ALL') filtered = filtered.filter(p => p.pm === filterPM)
  if (filterStatus !== 'ALL') filtered = filtered.filter(p => p.status === filterStatus)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p =>
      p.project?.toLowerCase().includes(q) ||
      p.client?.toLowerCase().includes(q) ||
      (p.projNo || '').includes(q) ||
      (p.pm || '').toLowerCase().includes(q))
  }

  // ── Group PM → Client → Project ───────────────────────────────────────────
  const pmGroups = {}; const pmOrder = []
  filtered.forEach(p => {
    const pm = p.pm || '—'; const client = p._client || '—'
    if (!pmGroups[pm]) { pmGroups[pm] = {}; pmOrder.push(pm) }
    if (!pmGroups[pm][client]) pmGroups[pm][client] = []
    pmGroups[pm][client].push(p)
  })

  // ── Mutate helpers ────────────────────────────────────────────────────────
  const addClient = useCallback(client => {
    mutate(prev => {
      const existing = prev.settings.clients || []
      const newId = Math.max(0, ...existing.map(c => c.id || 0)) + 1
      return {
        ...prev,
        settings: {
          ...prev.settings,
          clients: [...existing, { ...client, id: newId, active: true }]
        }
      }
    })
  }, [mutate])

  const saveProject = useCallback(proj => {
    mutate(prev => {
      const exists = prev.projects.find(p => p.id === proj.id)
      // Count how many null-id phases need new IDs
      const nullPhaseCount = proj.phases.filter(ph => ph.id == null).length
      let idCounter = prev.nextId
      const phasesWithIds = proj.phases.map(ph =>
        ph.id != null ? ph : { ...ph, id: idCounter++ }
      )
      const projWithIds = { ...proj, phases: phasesWithIds }
      if (exists) {
        return {
          ...prev,
          projects: prev.projects.map(p => p.id === proj.id ? projWithIds : p),
          nextId: prev.nextId + nullPhaseCount,
        }
      }
      return {
        ...prev,
        projects: [...prev.projects, { ...projWithIds, id: idCounter++ }],
        nextId: idCounter,
      }
    })
    setEditingProject(null)
  }, [mutate])

  const deleteProject = useCallback(projId => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    mutate(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== projId) }))
  }, [mutate])


  const toggleArchive = useCallback(projId => {
    mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id === projId ? { ...p, archived: !p.archived } : p) }))
  }, [mutate])

  const togglePhaseDone = useCallback((projId, phId) => {
    mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id !== projId ? p : {
      ...p, phases: p.phases.map(ph => ph.id !== phId ? ph : { ...ph, done: !ph.done })
    })}))
  }, [mutate])

  const renameClient = useCallback((oldName, newName) => {
    if (!newName || newName === oldName) { setRenamingClient(null); return }
    mutate(prev => ({ ...prev, projects: prev.projects.map(p =>
      p.client === oldName ? { ...p, client: newName } : p
    )}))
    setRenamingClient(null)
  }, [mutate])

  const saveAlloc = useCallback((projId, phId, monthly) => {
    mutate(prev => ({ ...prev, projects: prev.projects.map(p => p.id !== projId ? p : {
      ...p, phases: p.phases.map(ph => ph.id !== phId ? ph : { ...ph, monthly })
    })}))
    setAllocModal(null)
  }, [mutate])

  const archCt = projects.filter(p => p.archived).length
  const totFee = filtered.reduce((s, p) => s + pFee(p), 0)
  const totRem = filtered.reduce((s, p) => s + pRem(p), 0)
  const totWIP = totFee > 0 ? Math.round((filtered.reduce((s, p) => s + pBil(p), 0) + filtered.reduce((s, p) => s + pYTD(p), 0)) / totFee * 100) : 0

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-sand border-b border-sand-3 px-3 py-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search project, client, #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-48 text-xs"
        />
        <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All PMs</option>
          {pmList.map(pm => <option key={pm}>{pm}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select w-auto text-xs">
          <option value="ALL">All status</option>
          {statusList.map(s => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
        </select>
        <button onClick={() => setShowArchived(p => !p)} className={clsx('btn text-xs', showArchived && 'btn-active')}>
          Show archived{archCt > 0 ? ` (${archCt})` : ''}
        </button>
        <button onClick={() => setHideDone(p => !p)} className={clsx('btn text-xs', hideDone && 'btn-active')}>
          <i className="ti ti-archive" /> {hideDone ? 'Show done' : 'Hide done'}
        </button>
        <button onClick={() => setHideDonePhases(p => !p)} className={clsx('btn text-xs', hideDonePhases && 'btn-active')}>
          <i className="ti ti-eye-off" /> {hideDonePhases ? 'Show done' : 'WIP only'}
        </button>
        <button onClick={allCollapsed ? expandAll : collapseAll} className="btn text-xs text-olive">
          <i className={clsx('ti', allCollapsed ? 'ti-layout-navbar-expand' : 'ti-layout-navbar-collapse')} />
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
        <button onClick={() => setEditingProject('new')} className="btn btn-primary text-xs ml-auto">
          <i className="ti ti-plus" /> New project
        </button>
      </div>

      {/* Column headers */}
      <div className="bg-sand-2 border-b border-sand-3 px-3 py-1.5 grid text-2xs font-semibold text-olive uppercase tracking-wider"
        style={{ gridTemplateColumns: '28px 60px 72px 1fr 56px 80px 80px 80px 60px' }}>
        <span />
        <span />
        <span>Proj #</span>
        <span>Project</span>
        <span className="text-center">Status</span>
        <span>Fee</span>
        <span>Remaining</span>
        <span>WIP</span>
        <span />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">

        {pmOrder.length === 0 && (
          <div className="p-8 text-center text-sm text-olive">No projects found</div>
        )}

        {pmOrder.map(pm => {
          const pmKey      = 'pm-' + pm
          const pmExp      = expandedPM[pmKey] !== false
          const clientMap  = pmGroups[pm]
          const pmProjects = Object.values(clientMap).flat()
          const pmFee      = pmProjects.reduce((s, p) => s + pFee(p), 0)
          const pmRem      = pmProjects.reduce((s, p) => s + pRem(p), 0)
          const pmBil      = pmProjects.reduce((s, p) => s + pBil(p), 0)
          const pmYtd      = pmProjects.reduce((s, p) => s + pYTD(p), 0)
          const pmWIP      = pmFee > 0 ? Math.round((pmBil + pmYtd) / pmFee * 100) : 0
          const pmFlagCt   = pmProjects.filter(p => p.flag || p.phases.some(ph => ph.flag)).length

          return (
            <div key={pmKey}>
              {/* PM header */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] text-white cursor-pointer hover:bg-[#2a2a2a]"
                onClick={() => togglePM(pmKey)}
              >
                <span className="text-2xs opacity-50">{pmExp ? '▾' : '▸'}</span>
                <span className="text-2xs opacity-60 uppercase tracking-wider">PM</span>
                <span className="text-sm font-bold">{pm}</span>
                <span className="text-xs opacity-60 ml-1">{pmProjects.length} project{pmProjects.length !== 1 ? 's' : ''}</span>
                {pmFlagCt > 0 && <span className="text-xs text-terracotta-light ml-1">{pmFlagCt} flagged</span>}
              </div>

              {pmExp && Object.entries(clientMap).map(([client, cProjects]) => {
                const clientKey = `client-${pm}-${client}`
                const clientExp = expandedClient[clientKey] !== false
                const cFee      = cProjects.reduce((s, p) => s + pFee(p), 0)
                const rawClients = [...new Set(cProjects.map(p => p.client))]

                return (
                  <div key={clientKey}>
                    {/* Client header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-sand-2/60 border-b border-sand-2 pl-8">
                      <button onClick={() => toggleClient(clientKey)} className="text-2xs text-dark-3 opacity-50">
                        {clientExp ? '▾' : '▸'}
                      </button>
                      <span className="text-2xs text-olive uppercase tracking-wider">Client</span>
                      {renamingClient?.old === client ? (
                        <input
                          autoFocus
                          defaultValue={client}
                          className="input text-xs py-0.5 px-1.5 h-6"
                          onBlur={e => renameClient(client, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameClient(client, e.target.value)
                            if (e.key === 'Escape') setRenamingClient(null)
                          }}
                        />
                      ) : (
                        <span
                          className="text-xs font-semibold cursor-pointer hover:text-terracotta hover:underline underline-offset-2 decoration-dashed"
                          onClick={() => setRenamingClient({ old: client })}
                          title="Click to rename"
                        >
                          {client}
                        </span>
                      )}
                      {rawClients.length === 1 && rawClients[0] !== client && (
                        <span className="text-2xs text-dark-3">({rawClients[0]})</span>
                      )}
                      <span className="text-2xs text-dark-3 ml-1">{cProjects.length} project{cProjects.length !== 1 ? 's' : ''}</span>
                      <span className="text-2xs text-olive ml-auto">{fmt(cFee)}</span>
                    </div>

                    {/* Projects */}
                    {clientExp && cProjects.map(p => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        expanded={expandedProject[p.id] !== false}
                        onToggle={() => toggleProject(p.id)}
                        expandedAdd={expandedAdd}
                        onToggleAdd={toggleAdd}
                        hideDonePhases={hideDonePhases}
                        onEdit={() => setEditingProject(p)}
                        onDelete={() => deleteProject(p.id)}
                        onArchive={() => toggleArchive(p.id)}
                        onPhaseDone={(phId) => togglePhaseDone(p.id, phId)}
                        onOpenAlloc={(ph) => setAllocModal({ project: p, phase: ph })}
                        onAddPhase={() => setEditingProject(p)}
                      />
                    ))}
                  </div>
                )
              })}

              {/* PM subtotal */}
              {pmExp && (
                <div className="grid items-center px-3 py-1.5 bg-sand-2 border-t border-sand-3 text-xs"
                  style={{ gridTemplateColumns: '28px 60px 72px 1fr 56px 80px 80px 80px 60px' }}>
                  <span />
                  <span />
                  <span />
                  <span className="font-display font-bold text-xs tracking-wide">PM {pm} TOTAL
                    <span className="font-sans font-normal opacity-60 ml-2 text-2xs">{pmProjects.length} project{pmProjects.length !== 1 ? 's' : ''}</span>
                  </span>
                  <span />
                  <span className="font-bold">{fmt(pmFee)}</span>
                  <span className="font-bold text-olive">{fmt(pmRem)}</span>
                  <span className="font-bold">
                    <div className="flex items-center gap-1.5">
                      <div className="progress-bar w-10"><div className="progress-bar-fill bg-terracotta" style={{ width: Math.min(100, pmWIP) + '%' }} /></div>
                      {pmWIP}%
                    </div>
                  </span>
                  <span />
                </div>
              )}
            </div>
          )
        })}

        {/* Grand total */}
        <div className="grid items-center px-3 py-2 bg-sand-2 border-t-2 border-sand-3 text-xs font-bold"
          style={{ gridTemplateColumns: '28px 60px 72px 1fr 56px 80px 80px 80px 60px' }}>
          <span />
          <span />
          <span />
          <span>Total — {filtered.length} project{filtered.length !== 1 ? 's' : ''} · {filtered.reduce((s, p) => s + p.phases.length, 0)} phases</span>
          <span />
          <span>{fmt(totFee)}</span>
          <span className="text-olive">{fmt(totRem)}</span>
          <span>
            <div className="flex items-center gap-1.5">
              <div className="progress-bar w-10"><div className="progress-bar-fill bg-terracotta" style={{ width: Math.min(100, totWIP) + '%' }} /></div>
              {totWIP}%
            </div>
          </span>
          <span />
        </div>
      </div>

      {/* ── Modals ── */}
      {editingProject && (
        <ProjectModal
          project={editingProject === 'new' ? null : editingProject}
          settings={settings}
          projects={projects}
          onSave={saveProject}
          onAddClient={addClient}
          onClose={() => setEditingProject(null)}
        />
      )}

      {allocModal && (
        <AllocModal
          project={allocModal.project}
          phase={allocModal.phase}
          onSave={saveAlloc}
          onClose={() => setAllocModal(null)}
        />
      )}
    </div>
  )
}

// ── ProjectRow ────────────────────────────────────────────────────────────────
function ProjectRow({ project: p, expanded, onToggle, expandedAdd, onToggleAdd,
  hideDonePhases, onEdit, onDelete, onArchive, onPhaseDone, onOpenAlloc }) {

  const wip     = pWIP(p)
  const wipPct  = Math.round(wip * 100)
  const hasWarn = p.phases.some(ph => phVal(ph))
  const fee     = pFee(p)
  const rem     = pRem(p)

  // Group phases by addendum
  const addGroups = {}; const addOrder = []
  const visPhases = hideDonePhases ? p.phases.filter(ph => !ph.done) : p.phases
  visPhases.forEach(ph => {
    const key = ph.addendum || '__main__'
    if (!addGroups[key]) { addGroups[key] = []; addOrder.push(key) }
    addGroups[key].push(ph)
  })

  return (
    <>
      {/* Project row */}
      <div
        className={clsx(
          'grid items-center px-3 py-1.5 border-b border-sand-2 hover:bg-sand cursor-pointer',
          p.archived && 'opacity-50'
        )}
        style={{ gridTemplateColumns: '28px 60px 72px 1fr 56px 80px 80px 80px 60px', paddingLeft: 48 }}
      >
        {/* Expand */}
        <button onClick={onToggle} className="text-2xs text-dark-3 opacity-50 w-4">
          {expanded ? '▾' : '▸'}
        </button>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {(p.flag || p.phases.some(ph => ph.flag)) && (
            <span className="text-flag" title={p.flagNote || 'Flagged in Billing'} style={{ fontSize: 12 }}>
              <i className="ti ti-flag-filled" />
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onArchive() }}
            className="btn btn-icon btn-sm text-olive"
            title={p.archived ? 'Restore' : 'Archive'}
          >
            <i className={clsx('ti', p.archived ? 'ti-archive-off' : 'ti-archive')} style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Proj # */}
        <span className="text-2xs text-dark-3">{p.projNo}</span>

        {/* Name */}
        <div onClick={onToggle}>
          <div className="flex items-center gap-1 font-semibold text-xs overflow-hidden">
            <span className="truncate">{p.project}</span>
            {p.archived && <span className="text-2xs bg-sand-3 text-olive px-1 rounded shrink-0">ARC</span>}
          </div>
          {p.notes && <div className="text-2xs text-dark-3 truncate">{p.notes}</div>}
        </div>

        {/* Status */}
        <div className="text-center">
          <span className="text-2xs bg-sand-2 text-olive px-1.5 py-0.5 rounded font-semibold">{p.status}</span>
        </div>

        {/* Fee */}
        <span className="text-xs">{fmt(fee)}</span>

        {/* Remaining */}
        <span className="text-xs text-olive">{fmt(rem)}</span>

        {/* WIP */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{wipPct}%</span>
          {hasWarn && <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />}
          <div className="progress-bar flex-1">
            <div className="progress-bar-fill" style={{
              width: Math.min(100, wipPct) + '%',
              background: wipPct >= 100 ? '#2d7a3a' : '#BD6439'
            }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="btn btn-icon btn-sm" title="Edit">
            <i className="ti ti-edit" style={{ fontSize: 12 }} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="btn btn-icon btn-sm btn-danger" title="Delete">
            <i className="ti ti-trash" style={{ fontSize: 12 }} />
          </button>
        </div>
      </div>

      {/* Phase rows */}
      {expanded && addOrder.map(addKey => {
        const phases  = addGroups[addKey]
        const addExpKey = `add-${p.id}-${addKey}`
        const addExp  = expandedAdd[addExpKey] !== false

        return (
          <div key={addKey}>
            {/* Addendum header */}
            {addKey !== '__main__' && (
              <div
                className="flex items-center gap-2 px-3 py-1 bg-sand-2/40 border-b border-sand-2 cursor-pointer"
                style={{ paddingLeft: 64 }}
                onClick={() => onToggleAdd(addExpKey)}
              >
                <span className="text-2xs opacity-40">{addExp ? '▾' : '▸'}</span>
                <span className="text-2xs text-dark-3 uppercase tracking-wider">Addendum</span>
                <span className="text-xs font-semibold text-terracotta">{addKey}</span>
                <span className="text-2xs text-dark-3">{phases.length} phase{phases.length !== 1 ? 's' : ''}</span>
                <span className="ml-auto text-2xs text-olive">{fmt(phases.reduce((s, ph) => s + phFeeFC(ph), 0))}</span>
              </div>
            )}

            {(addKey === '__main__' || addExp) && phases.map(ph => (
              <PhaseRow
                key={ph.id}
                phase={ph}
                project={p}
                indent={addKey !== '__main__' ? 80 : 64}
                onDone={() => onPhaseDone(ph.id)}
                onOpenAlloc={() => onOpenAlloc(ph)}
              />
            ))}
          </div>
        )
      })}

      {/* Add phase button */}
      {expanded && (
        <div className="border-b border-sand-2 py-1" style={{ paddingLeft: 64 }}>
          <button onClick={onEdit} className="btn btn-sm text-olive text-2xs">
            <i className="ti ti-plus" /> Add phase
          </button>
        </div>
      )}
    </>
  )
}

// ── PhaseRow ──────────────────────────────────────────────────────────────────
function PhaseRow({ phase: ph, project: p, indent, onDone, onOpenAlloc }) {
  const rem    = phRem(ph)
  const billedOut = rem <= 0
  const as     = phAllocSt(ph)
  const warn   = phVal(ph)
  const fee    = phFeeFC(ph)

  const allocColor = as.cls === 'ok' ? '#2d7a3a' : as.cls === 'over' ? '#c0392b' : '#888'

  return (
    <div
      className={clsx(
        'grid items-center px-3 py-1 border-b border-sand-2',
        billedOut || ph.done ? 'opacity-40' : 'hover:bg-sand'
      )}
      style={{ gridTemplateColumns: '28px 60px 72px 1fr 56px 80px 80px 80px 60px', paddingLeft: indent }}
    >
      {/* Controls */}
      <span />
      <div className="flex items-center gap-0.5">
        <button onClick={onDone} className={clsx('btn btn-icon btn-sm', ph.done && 'text-success')} title={ph.done ? 'Mark incomplete' : 'Mark done'}>
          <i className="ti ti-circle-check" style={{ fontSize: 12 }} />
        </button>
        {ph.flag && (
          <span className="text-flag" title={ph.flagNote || 'Flagged in Billing'} style={{ fontSize: 12 }}>
            <i className="ti ti-flag-filled" />
          </span>
        )}
      </div>

      <span className="text-2xs text-dark-3">{ph.scope}</span>

      {/* Phase name / alloc status */}
      <div>
        <button
          onClick={onOpenAlloc}
          className={clsx(
            'text-xs font-medium text-left hover:text-terracotta hover:underline underline-offset-2',
            warn && 'text-warning'
          )}
        >
          {ph.name}
          {warn && <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning ml-1 align-middle" />}
        </button>
        <div className="text-2xs" style={{ color: allocColor }}>{billedOut ? '✓ Billed out' : as.txt}</div>
      </div>

      <span />

      {/* Fee */}
      <div className="text-xs">
        {ph.scope === 'CA'
          ? <>{fmt(ph.fee)}<span className="text-2xs text-olive ml-0.5">/mo</span></>
          : fmt(ph.fee)
        }
        {ph.scope === 'CA' && <div className="text-2xs text-dark-3">{fmt(fee)} est.</div>}
      </div>

      {/* Remaining */}
      <span className="text-xs text-olive">{billedOut ? '—' : fmt(rem)}</span>

      {/* % complete */}
      <span className="text-xs">{ph.pct || 0}%</span>

      <span />
    </div>
  )
}

// ── AllocModal ────────────────────────────────────────────────────────────────
function AllocModal({ project: p, phase: ph, onSave, onClose }) {
  const [monthly, setMonthly] = useState({ ...ph.monthly })
  const [showAll, setShowAll] = useState(false)
  const [editPast, setEditPast] = useState(false)

  const rem   = phRem({ ...ph, monthly })
  const alloc = Object.entries(monthly).filter(([mk]) => mk >= CUR_MK).reduce((s, [, v]) => s + v, 0)
  const as    = phAllocSt({ ...ph, monthly })
  const allocPct = rem > 0 ? Math.min(100, Math.round(alloc / rem * 100)) : 100
  const barColor = as.cls === 'ok' ? '#2d7a3a' : as.cls === 'over' ? '#c0392b' : '#BD6439'

  // Build months to show
  const allMonths = []
  for (let i = -6; i < 24; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    allMonths.push({ key, label, isPast: key < CUR_MK })
  }
  const visMonths = showAll ? allMonths : allMonths.filter(m => (monthly[m.key] || 0) > 0 || m.key >= CUR_MK)
  const hiddenCt = allMonths.length - visMonths.length

  const setMoPct = (mk, pct) => {
    const fee = ph.fee || 0
    const dollars = fee > 0 ? Math.round(fee * pct / 100) : 0
    setMonthly(prev => ({ ...prev, [mk]: dollars }))
  }

  const splitEvenly = () => {
    const fee     = ph.fee || 0
    const futMos  = allMonths.filter(m => m.key >= CUR_MK)
    const perMo   = futMos.length > 0 ? Math.round(fee / futMos.length) : 0
    const next    = { ...monthly }
    futMos.forEach(m => { next[m.key] = perMo })
    setMonthly(next)
  }

  const clearAlloc = () => {
    const next = { ...monthly }
    allMonths.filter(m => m.key >= CUR_MK).forEach(m => { next[m.key] = 0 })
    setMonthly(next)
  }

  // CA phase: toggle months
  if (ph.scope === 'CA') {
    const caEst  = phCAEst(ph)
    const caMos  = allMonths.filter(m => m.key >= CUR_MK || (monthly[m.key] || 0) > 0)
    return (
      <Modal title={ph.name} onClose={onClose}>
        <div className="text-xs text-olive mb-3">
          Rate: <strong>{fmt(ph.fee)}/mo</strong> · Est. {ph.caMonths || 12} mo · Est. total: <strong>{fmt(caEst)}</strong>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {caMos.map(m => {
            const active = (monthly[m.key] || 0) > 0
            return (
              <button key={m.key}
                onClick={() => setMonthly(prev => ({ ...prev, [m.key]: active ? 0 : (ph.fee || 0) }))}
                className={clsx(
                  'text-center rounded border px-3 py-1.5 text-xs transition-colors',
                  active ? 'border-terracotta bg-terracotta/10 text-terracotta font-semibold' : 'border-sand-3 text-dark-3'
                )}
              >
                <div>{m.label}</div>
                <div className="text-2xs">{active ? fmt(ph.fee) : '—'}</div>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 pt-3 border-t border-sand-2">
          <button onClick={() => onSave(p.id, ph.id, monthly)} className="btn btn-primary text-xs">
            <i className="ti ti-device-floppy" /> Save
          </button>
          <button onClick={onClose} className="btn text-xs">Cancel</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={ph.name} onClose={onClose}>
      {/* Status + progress */}
      <div className="flex items-center gap-3 mb-2">
        <span className={clsx('text-xs font-semibold', as.cls === 'ok' ? 'text-success' : as.cls === 'over' ? 'text-flag' : 'text-warning')}>
          {as.txt}
        </span>
        <span className="text-xs text-olive">{ph.hourly ? 'NTE Budget' : 'Remaining'}: <strong>{fmt(rem)}</strong></span>
        {ph.hourly && <span className="text-2xs bg-sand-2 text-olive px-1.5 py-0.5 rounded font-semibold">HOURLY NTE</span>}
      </div>
      <div className="progress-bar mb-3">
        <div className="progress-bar-fill" style={{ width: allocPct + '%', background: barColor }} />
      </div>

      {/* Month chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {visMonths.map(m => {
          const val   = monthly[m.key] || 0
          const fee   = ph.fee || 0
          const pct   = fee > 0 ? Math.round(val / fee * 1000) / 10 : 0
          const readonly = m.isPast && !editPast
          return (
            <div key={m.key} className={clsx(
              'border rounded px-2 py-1.5 text-center',
              pct > 0 ? 'border-terracotta/50 bg-terracotta/5' : 'border-sand-3 bg-sand',
              m.key === CUR_MK && 'ring-1 ring-terracotta'
            )}>
              <div className="text-2xs text-olive mb-1">{m.label}</div>
              <div className="flex items-center gap-1">
                {readonly ? (
                  <span className="text-xs text-dark-3 w-12 text-right">{pct}%</span>
                ) : (
                  <input
                    type="number" min={0} max={100} step={5}
                    defaultValue={pct > 0 ? pct : ''}
                    placeholder="0"
                    onChange={e => setMoPct(m.key, parseFloat(e.target.value) || 0)}
                    className="w-12 text-center text-xs border border-sand-3 rounded px-1 py-0.5 focus:outline-none focus:border-terracotta"
                  />
                )}
                <span className="text-2xs text-dark-3">%</span>
              </div>
              <div className="text-2xs text-olive mt-0.5">{val > 0 ? fmt(val) : '—'}</div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-sand-2">
        <button onClick={splitEvenly} className="btn text-xs">Split evenly</button>
        <button onClick={clearAlloc} className="btn text-xs">Clear</button>
        <button onClick={() => setShowAll(p => !p)} className="btn text-xs text-olive border-0 underline underline-offset-2">
          {showAll ? 'Hide empty' : `Show all${hiddenCt > 0 ? ` (+${hiddenCt})` : ''}`}
        </button>
        <button
          onClick={() => setEditPast(p => !p)}
          className={clsx('btn text-xs', editPast && 'btn-active text-terracotta')}
        >
          <i className="ti ti-lock-open-2" /> {editPast ? 'Lock past' : 'Edit past'}
        </button>
        <button onClick={() => onSave(p.id, ph.id, monthly)} className="btn btn-primary text-xs ml-auto">
          <i className="ti ti-device-floppy" /> Save
        </button>
      </div>
    </Modal>
  )
}

// ── ProjectModal ──────────────────────────────────────────────────────────────
function ProjectModal({ project: ex, settings, projects, onSave, onAddClient, onClose }) {
  const pmList    = (settings.pms || []).map(p => p.name)
  const scopeList = settings.scopeTypes || []
  const statusList = settings.statusTypes || []
  const typeList  = settings.projectTypes || []
  const clients   = settings.clients || []

  const defaultPhase = { id: null, name: '', scope: scopeList[0]?.code || 'SD', fee: 0, billed: 0, pct: 0, done: false, flag: false, monthly: blankMonthly() }

  const [form, setForm] = useState(ex ? { ...ex } : {
    pm: pmList[0] || '', projNo: '', client: '', project: '',
    type: typeList[0]?.code || 'SFD', location: 'CA', status: statusList[0]?.code || 'U',
    flag: false, notes: '', phases: [defaultPhase]
  })
  const [allocPhaseIdx, setAllocPhaseIdx] = useState(null)
  const [addingClient, setAddingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientParent, setNewClientParent] = useState('')

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setPhase = (i, k, v) => setForm(p => ({
    ...p,
    phases: p.phases.map((ph, idx) => idx === i ? { ...ph, [k]: v } : ph)
  }))
  const addPhase  = () => setForm(p => ({ ...p, phases: [...p.phases, { ...defaultPhase }] }))
  const removePhase = i => setForm(p => ({ ...p, phases: p.phases.filter((_, idx) => idx !== i) }))

  const clientOptions = clients.filter(c => !c.parent)
  const clientChildren = clients.filter(c => c.parent)

  const confirmNewClient = () => {
    const name = newClientName.trim()
    if (!name) return
    onAddClient({ name, parent: newClientParent || null })
    setField('client', name)
    setAddingClient(false)
    setNewClientName('')
    setNewClientParent('')
  }
  const totalFee = form.phases.reduce((s, ph) => s + (ph.fee || 0), 0)

  return (
    <Modal title={ex ? 'Edit project' : 'New project'} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">PM</label>
          <select value={form.pm} onChange={e => setField('pm', e.target.value)} className="select text-xs w-full">
            {pmList.map(pm => <option key={pm}>{pm}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Project #</label>
          <input value={form.projNo} onChange={e => setField('projNo', e.target.value)} className="input text-xs w-full" />
        </div>
        <div className="col-span-2">
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Client</label>
          {addingClient ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                placeholder="New client name"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmNewClient(); if (e.key === 'Escape') setAddingClient(false) }}
                className="input text-xs w-full"
              />
              <select value={newClientParent} onChange={e => setNewClientParent(e.target.value)} className="select text-xs w-full">
                <option value="">— No parent (top-level) —</option>
                {clientOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <div className="flex gap-1">
                <button onClick={confirmNewClient} className="btn btn-primary text-xs"><i className="ti ti-check" /> Add client</button>
                <button onClick={() => setAddingClient(false)} className="btn text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <select
              value={form.client}
              onChange={e => {
                if (e.target.value === '__add__') { setAddingClient(true); setNewClientName(''); setNewClientParent('') }
                else setField('client', e.target.value)
              }}
              className="select text-xs w-full"
            >
              <option value="">— Select client —</option>
              {clientOptions.map(c => {
                const kids = clientChildren.filter(k => k.parent === c.id || k.parent === c.name)
                if (kids.length) return (
                  <optgroup key={c.id} label={c.name}>
                    <option value={c.name}>{c.name} (Corporate)</option>
                    {kids.map(k => <option key={k.id} value={k.name}>↳ {k.name}</option>)}
                  </optgroup>
                )
                return <option key={c.id} value={c.name}>{c.name}</option>
              })}
              <option disabled>──────────</option>
              <option value="__add__">+ Add new client…</option>
            </select>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Project name</label>
          <input value={form.project} onChange={e => setField('project', e.target.value)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Type</label>
          <select value={form.type} onChange={e => setField('type', e.target.value)} className="select text-xs w-full">
            {typeList.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Status</label>
          <select value={form.status} onChange={e => setField('status', e.target.value)} className="select text-xs w-full">
            {statusList.map(s => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Location</label>
          <input value={form.location || 'CA'} onChange={e => setField('location', e.target.value)} className="input text-xs w-24" />
        </div>
        <div className="flex items-end pb-1.5">
          {form.flag && (
            <span className="text-2xs text-flag flex items-center gap-1">
              <i className="ti ti-flag-filled" style={{ fontSize: 11 }} /> Flagged in Billing
            </span>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-2xs text-olive uppercase tracking-wider mb-1">Notes</label>
          <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)}
            className="input text-xs w-full h-16 resize-y" />
        </div>
      </div>

      {/* Phases */}
      <div className="border-t border-sand-2 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">Phases / scope items</span>
          <span className="text-xs bg-sand-2 px-2 py-0.5 rounded">Total: <strong>{fmt(totalFee)}</strong></span>
        </div>
        <div className="space-y-3">
          {form.phases.map((ph, i) => (
            <PhaseCard key={i} phase={ph} index={i} scopeList={scopeList}
              onChange={(k, v) => setPhase(i, k, v)}
              onRemove={() => removePhase(i)}
              onOpenAlloc={() => setAllocPhaseIdx(i)}
            />
          ))}
        </div>
        <button onClick={addPhase} className="btn btn-sm text-olive mt-2 w-full justify-center border-dashed">
          <i className="ti ti-plus" /> Add another phase
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-sand-2">
        {ex && (
          <button onClick={() => { if (confirm(ex.archived ? 'Restore?' : 'Archive?')) { onSave({ ...form, archived: !ex.archived }) } }}
            className="btn text-xs text-flag mr-auto">
            <i className={clsx('ti', ex.archived ? 'ti-archive-off' : 'ti-archive')} />
            {ex.archived ? 'Restore' : 'Archive'}
          </button>
        )}
        <button onClick={onClose} className="btn text-xs">Cancel</button>
        <button onClick={() => onSave(form)} className="btn btn-primary text-xs">
          <i className="ti ti-device-floppy" /> Save project
        </button>
      </div>

      {/* Inline alloc modal — saves back into form state, not global */}
      {allocPhaseIdx !== null && (
        <AllocModal
          project={{ id: form.id || '__new__' }}
          phase={form.phases[allocPhaseIdx]}
          onSave={(_, __, monthly) => {
            setPhase(allocPhaseIdx, 'monthly', monthly)
            setAllocPhaseIdx(null)
          }}
          onClose={() => setAllocPhaseIdx(null)}
        />
      )}
    </Modal>
  )
}

// ── PhaseCard ─────────────────────────────────────────────────────────────────
function PhaseCard({ phase: ph, index: i, scopeList, onChange, onRemove, onOpenAlloc }) {
  const isCA   = ph.scope === 'CA'
  const caEst  = isCA ? (ph.fee || 0) * (ph.caMonths || 12) : 0
  const feeBase = isCA ? caEst : (ph.fee || 0)
  const rem    = Math.max(0, feeBase - (ph.billed || 0))

  return (
    <div className="bg-sand rounded border border-sand-3 p-3 relative">
      <div className="text-2xs text-olive uppercase tracking-wider mb-2">Phase {i + 1}</div>
      <button onClick={onRemove} className="absolute top-2 right-2 btn btn-icon btn-sm btn-danger">
        <i className="ti ti-x" style={{ fontSize: 11 }} />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-2xs text-olive mb-0.5">Description</label>
          <input value={ph.name} onChange={e => onChange('name', e.target.value)} className="input text-xs w-full" />
        </div>
        <div>
          <label className="block text-2xs text-olive mb-0.5">Scope type</label>
          <select value={ph.scope} onChange={e => onChange('scope', e.target.value)} className="select text-xs w-full">
            {scopeList.map(s => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
          </select>
        </div>
        {isCA ? (
          <div className="col-span-2 flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-2xs text-olive mb-0.5">Monthly rate ($)</label>
              <input type="number" value={ph.fee || 0} min={0} step={100}
                onChange={e => onChange('fee', parseFloat(e.target.value) || 0)}
                className="input text-xs w-full" />
            </div>
            <span className="text-xs text-dark-3 mt-4">×</span>
            <div>
              <label className="block text-2xs text-olive mb-0.5">Months</label>
              <input type="number" value={ph.caMonths || 12} min={1} max={120}
                onChange={e => onChange('caMonths', parseInt(e.target.value) || 12)}
                className="input text-xs w-16" />
            </div>
            <span className="text-xs text-olive mt-4 whitespace-nowrap">= {fmt(caEst)} est.</span>
          </div>
        ) : (
          <div>
            <label className="block text-2xs text-olive mb-0.5">Contract fee ($)</label>
            <input type="number" value={ph.fee || 0} min={0} step={500}
              onChange={e => onChange('fee', parseFloat(e.target.value) || 0)}
              className="input text-xs w-full" />
          </div>
        )}
        <div>
          <label className="block text-2xs text-olive mb-0.5">Billed to date ($)</label>
          <input type="number" value={ph.billed || 0} min={0} step={500}
            onChange={e => onChange('billed', parseFloat(e.target.value) || 0)}
            className="input text-xs w-full" />
        </div>
        <div className="col-span-2 flex justify-end pt-1 border-t border-sand-2 mt-1">
          <button
            onClick={onOpenAlloc}
            className="btn btn-sm text-xs text-olive flex items-center gap-1"
          >
            <i className="ti ti-calendar-month" style={{ fontSize: 12 }} />
            Edit allocations
            {rem > 0 && (() => {
              const alloc = Object.entries(ph.monthly || {}).filter(([mk]) => mk >= CUR_MK).reduce((s, [, v]) => s + v, 0)
              const d = alloc - rem
              if (Math.abs(d) < 1) return <span className="text-2xs text-success ml-1">✓</span>
              if (d > 1) return <span className="text-2xs text-flag ml-1">over</span>
              return <span className="text-2xs text-warning ml-1">{fmt(alloc)} / {fmt(rem)}</span>
            })()}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50">
      <div className={clsx(
        'bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] w-full',
        wide ? 'max-w-2xl' : 'max-w-xl'
      )}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-sand-2 shrink-0">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="btn btn-icon btn-sm">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
