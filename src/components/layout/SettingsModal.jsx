import { useState, useCallback } from 'react'
import { clsx } from '../../lib/utils'

const NAV_ITEMS = [
  { id: 'pms',           icon: 'ti-users',       label: 'Project Managers' },
  { id: 'scopes',        icon: 'ti-tag',          label: 'Scope Types' },
  { id: 'project-types', icon: 'ti-building',     label: 'Project Types' },
  { id: 'status-types',  icon: 'ti-flag',         label: 'Status Types' },
  { id: 'clients',       icon: 'ti-users-group',  label: 'Clients' },
  { id: 'billing',       icon: 'ti-target',       label: 'Billing Goals' },
  { id: 'employees',     icon: 'ti-id-badge',     label: 'Employee Counts' },
  { id: 'firm',          icon: 'ti-settings-2',   label: 'Firm & App' },
  { id: 'email',         icon: 'ti-mail',         label: 'Email Digest' },
  { id: 'invoicing',     icon: 'ti-file-invoice', label: 'Invoicing' },
  { id: 'banking',       icon: 'ti-building-bank',label: 'Banking / Payment' },
  { id: 'advanced',      icon: 'ti-tools',        label: 'Advanced' },
]

export default function SettingsModal({ appState, mutate, onClose, doSync, doSyncAR, syncing, syncingAR, syncMsg }) {
  const { settings } = appState
  const [section, setSection] = useState('pms')
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(settings)))
  const [dirty, setDirty] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [digestMsg, setDigestMsg] = useState(null)
  const [sendingProj, setSendingProj] = useState(false)
  const [projMsg, setProjMsg] = useState(null)
  const [bankingPinInput, setBankingPinInput] = useState('')
  const [bankingUnlocked, setBankingUnlocked] = useState(false)

  const sendDigestNow = async () => {
    setSendingDigest(true); setDigestMsg(null)
    try {
      const resp = await fetch('/api/daily-digest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual: true }) })
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'Failed')
      setDigestMsg('Digest sent')
    } catch (e) { setDigestMsg('Error: ' + e.message) }
    setSendingDigest(false)
    setTimeout(() => setDigestMsg(null), 5000)
  }

  const sendProjectionNow = async () => {
    setSendingProj(true); setProjMsg(null)
    try {
      const resp = await fetch('/api/projection-reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual: true }) })
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'Failed')
      setProjMsg('Reminders sent')
    } catch (e) { setProjMsg('Error: ' + e.message) }
    setSendingProj(false)
    setTimeout(() => setProjMsg(null), 5000)
  }

  const set = useCallback((path, value) => {
    setLocal(prev => {
      const next = { ...prev }
      const parts = path.split('.')
      let obj = next
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] }
        obj = obj[parts[i]]
      }
      obj[parts[parts.length - 1]] = value
      return next
    })
    setDirty(true)
  }, [])

  const save = () => {
    mutate(prev => ({ ...prev, settings: local }))
    setDirty(false)
    onClose()
  }

  const nextId = (arr) => Math.max(0, ...(arr || []).map(x => x.id || 0)) + 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/60">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ height: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-sand-2 shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <i className="ti ti-settings text-olive" /> Settings
          </h2>
          <button onClick={onClose} className="btn btn-icon btn-sm"><i className="ti ti-x" /></button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar nav */}
          <nav className="w-44 shrink-0 border-r border-sand-2 bg-sand overflow-y-auto py-2">
            {NAV_ITEMS.map(n => (
              <button key={n.id} onClick={() => setSection(n.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors border-l-2',
                  section === n.id
                    ? 'border-terracotta bg-white text-dark font-semibold'
                    : 'border-transparent text-dark-3 hover:bg-sand-2 hover:text-dark'
                )}>
                <i className={clsx('ti', n.icon, 'text-sm')} />
                {n.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Project Managers */}
            {section === 'pms' && (
              <Section title="Project Managers" desc="Initials used as display codes throughout the app.">
                <div className="space-y-2 mb-3">
                  {(local.pms || []).map((pm, i) => (
                    <div key={pm.id} className="flex items-center gap-2">
                      <input value={pm.name} onChange={e => {
                        const oldName = pm.name, newName = e.target.value
                        const p=[...local.pms];p[i]={...p[i],name:newName};set('pms',p)
                        if (oldName && newName && oldName !== newName) {
                          mutate(prev => ({
                            ...prev,
                            projects: prev.projects.map(pr => pr.pm === oldName ? { ...pr, pm: newName } : pr)
                          }))
                        }
                      }}
                        className="input text-xs w-16 font-mono font-bold" placeholder="Init" />
                      <input value={pm.fullName||''} onChange={e => { const p=[...local.pms];p[i]={...p[i],fullName:e.target.value};set('pms',p) }}
                        className="input text-xs flex-1" placeholder="Full name" />
                      <input value={pm.email||''} onChange={e => { const p=[...local.pms];p[i]={...p[i],email:e.target.value};set('pms',p) }}
                        className="input text-xs flex-1" placeholder="email@jdaarch.com" type="email" />
                      <span className="text-2xs text-dark-3 shrink-0">$/mo</span>
                      <input type="number" value={pm.monthlyGoal||0} onChange={e => { const p=[...local.pms];p[i]={...p[i],monthlyGoal:parseFloat(e.target.value)||0};set('pms',p) }}
                        className="input text-xs w-24 text-right" step={5000} />
                      <button onClick={() => set('pms', local.pms.filter((_,j)=>j!==i))}
                        className="btn btn-icon btn-sm btn-danger"><i className="ti ti-x" style={{fontSize:11}} /></button>
                    </div>
                  ))}
                </div>
                <AddRow onAdd={vals => set('pms', [...(local.pms||[]), { id: nextId(local.pms), name: vals[0], fullName: vals[1], email: vals[2], monthlyGoal: 0 }])}
                  placeholders={['Init', 'Full name', 'Email']} widths={['w-16','flex-1','flex-1']} />
                {(local.pms||[]).length > 0 && (
                  <div className="text-2xs text-dark-3 mt-3 bg-sand-2 rounded px-3 py-2">
                    PM Goals Total: <strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((local.pms||[]).reduce((s,p)=>s+(p.monthlyGoal||0),0))}</strong>/mo
                  </div>
                )}
              </Section>
            )}

            {/* Scope Types */}
            {section === 'scopes' && (
              <Section title="Scope Types" desc="Code + description used in phase dropdowns.">
                <CodeLabelList items={local.scopeTypes||[]} onChange={v=>set('scopeTypes',v)} />
              </Section>
            )}

            {/* Project Types */}
            {section === 'project-types' && (
              <Section title="Project Types" desc="Used to categorize projects.">
                <CodeLabelList items={local.projectTypes||[]} onChange={v=>set('projectTypes',v)} />
              </Section>
            )}

            {/* Status Types */}
            {section === 'status-types' && (
              <Section title="Status Types" desc="Project status codes and their display labels.">
                <div className="space-y-2 mb-3">
                  {(local.statusTypes||[]).map((st, i) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <input value={st.code} onChange={e=>{const a=[...local.statusTypes];a[i]={...a[i],code:e.target.value};set('statusTypes',a)}}
                        className="input text-xs w-16 font-mono font-bold" />
                      <input value={st.label} onChange={e=>{const a=[...local.statusTypes];a[i]={...a[i],label:e.target.value};set('statusTypes',a)}}
                        className="input text-xs flex-1" />
                      <input type="color" value={st.color||'#1a1a1a'} onChange={e=>{const a=[...local.statusTypes];a[i]={...a[i],color:e.target.value};set('statusTypes',a)}}
                        className="h-8 w-10 rounded cursor-pointer border border-sand-3" />
                      <button onClick={()=>set('statusTypes',local.statusTypes.filter((_,j)=>j!==i))}
                        className="btn btn-icon btn-sm btn-danger"><i className="ti ti-x" style={{fontSize:11}} /></button>
                    </div>
                  ))}
                </div>
                <AddRow onAdd={vals=>set('statusTypes',[...(local.statusTypes||[]),{id:nextId(local.statusTypes),code:vals[0],label:vals[1],color:'#1a1a1a'}])}
                  placeholders={['Code','Label']} widths={['w-16','flex-1']} />
              </Section>
            )}

            {/* Clients */}
            {section === 'clients' && (
              <Section title="Client List" desc="Manage clients. Set parent relationships for corporate families.">
                <div className="space-y-1.5 mb-3">
                  {(local.clients||[]).map((c, i) => {
                    const parents = (local.clients||[]).filter(x=>!x.parent&&x.id!==c.id)
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <input value={c.name} onChange={e=>{const a=[...local.clients];a[i]={...a[i],name:e.target.value};set('clients',a)}}
                          className="input text-xs flex-1" />
                        <select value={c.parent||''} onChange={e=>{const a=[...local.clients];a[i]={...a[i],parent:e.target.value||null};set('clients',a)}}
                          className="select text-xs w-32">
                          <option value="">No parent</option>
                          {parents.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-2xs text-dark-3 cursor-pointer shrink-0">
                          <input type="checkbox" checked={c.active!==false} onChange={e=>{const a=[...local.clients];a[i]={...a[i],active:e.target.checked};set('clients',a)}} />
                          Active
                        </label>
                        <button onClick={()=>set('clients',local.clients.filter((_,j)=>j!==i))}
                          className="btn btn-icon btn-sm btn-danger"><i className="ti ti-x" style={{fontSize:11}} /></button>
                      </div>
                    )
                  })}
                </div>
                <AddRow onAdd={vals=>set('clients',[...(local.clients||[]),{id:nextId(local.clients),name:vals[0],parent:null,active:true}])}
                  placeholders={['Client name']} widths={['flex-1']} />
              </Section>
            )}

            {/* Billing Goals */}
            {section === 'billing' && (
              <Section title="Billing Goals" desc="Annual and monthly billing targets.">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Annual Goal ($)</label>
                    <input type="number" value={local.billing?.annualGoal||4740000} step={10000}
                      onChange={e=>{
                        const annual = parseFloat(e.target.value)||0
                        set('billing',{...local.billing, annualGoal: annual, monthlyGoal: Math.round(annual/12)})
                      }}
                      className="input text-xs w-full" />
                  </div>
                  <div>
                    <label className="field-label">Monthly Goal ($)</label>
                    <input type="number" value={local.billing?.monthlyGoal||395000} step={5000}
                      onChange={e=>{
                        const monthly = parseFloat(e.target.value)||0
                        set('billing',{...local.billing, monthlyGoal: monthly, annualGoal: Math.round(monthly*12)})
                      }}
                      className="input text-xs w-full" />
                    <div className="text-2xs text-dark-3 mt-1">Default for all months unless overridden below</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-sand-2">
                  <div className="font-semibold text-xs mb-1">Monthly Overrides</div>
                  <div className="text-2xs text-dark-3 mb-3">Set a different goal for specific months. Blank months use the default above.</div>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({length:12}, (_,i) => {
                      const mo = i + 1
                      const mk = `${new Date().getFullYear()}-${String(mo).padStart(2,'0')}`
                      const override = (local.billing?.monthlyGoalOverrides || {})[mk] || ''
                      const defaultGoal = local.billing?.monthlyGoal || 395000
                      return (
                        <div key={mk}>
                          <label className="text-2xs text-olive uppercase tracking-wider">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</label>
                          <input
                            type="number"
                            step={5000}
                            value={override}
                            placeholder={String(defaultGoal)}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              const overrides = { ...(local.billing?.monthlyGoalOverrides || {}) }
                              if (val > 0) overrides[mk] = val
                              else delete overrides[mk]
                              set('billing', { ...local.billing, monthlyGoalOverrides: overrides })
                            }}
                            className="input text-xs w-full text-right"
                            style={{ color: override ? '#3D3935' : '#b0aca0' }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-2xs text-dark-3 mt-2">
                    Effective annual: <strong>
                      {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(
                        Array.from({length:12}, (_,i) => {
                          const mk = `${new Date().getFullYear()}-${String(i+1).padStart(2,'0')}`
                          return (local.billing?.monthlyGoalOverrides || {})[mk] || local.billing?.monthlyGoal || 395000
                        }).reduce((s,v)=>s+v,0)
                      )}
                    </strong>
                  </div>
                </div>
              </Section>
            )}

            {/* Employee Counts */}
            {section === 'employees' && (
              <Section title="Employee Counts" desc="Used to calculate per-employee billing metrics on Dashboard.">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Billable Staff</label>
                    <input type="number" value={local.employees?.billable||12} min={1}
                      onChange={e=>set('employees',{...local.employees,billable:parseInt(e.target.value)||1})}
                      className="input text-xs w-full" />
                  </div>
                  <div>
                    <label className="field-label">Total Staff</label>
                    <input type="number" value={local.employees?.total||17} min={1}
                      onChange={e=>set('employees',{...local.employees,total:parseInt(e.target.value)||1})}
                      className="input text-xs w-full" />
                  </div>
                </div>
              </Section>
            )}

            {/* Firm & App */}
            {section === 'firm' && (
              <Section title="Firm & App" desc="Firm name and Smartsheet connection settings.">
                <div className="space-y-3">
                  <div>
                    <label className="field-label">Firm short name</label>
                    <input value={local.firm?.name||'JD+A'} onChange={e=>set('firm',{...local.firm,name:e.target.value})}
                      className="input text-xs w-full" />
                  </div>
                  <div>
                    <label className="field-label">Firm full name</label>
                    <input value={local.firm?.fullName||''} onChange={e=>set('firm',{...local.firm,fullName:e.target.value})}
                      className="input text-xs w-full" />
                  </div>
                  <div>
                    <label className="field-label">Logo</label>
                    <div className="flex items-center gap-3">
                      {local.firm?.logo && (
                        <img src={local.firm.logo} alt="Firm logo" style={{height:40,maxWidth:120,objectFit:'contain',border:'1px solid rgba(61,57,53,0.12)',borderRadius:4,padding:4,background:'#fff'}} />
                      )}
                      <div className="flex flex-col gap-1">
                        <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,fontSize:11,padding:'6px 12px',border:'1px solid rgba(61,57,53,0.2)',borderRadius:4,background:'#ECEAE3',color:'#3D3935'}}>
                          <i className="ti ti-upload" style={{fontSize:13}} />
                          {local.firm?.logo ? 'Replace logo' : 'Upload logo'}
                          <input type="file" accept="image/*" style={{display:'none'}} onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = ev => set('firm', {...local.firm, logo: ev.target.result})
                            reader.readAsDataURL(file)
                          }} />
                        </label>
                        {local.firm?.logo && (
                          <button onClick={() => set('firm', {...local.firm, logo: null})}
                            style={{fontSize:11,color:'#BD6439',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:'2px 0'}}>
                            Remove logo
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-2xs text-dark-3 mt-1">PNG or SVG recommended. Used in reports and email digest.</div>
                  </div>
                  <div className="pt-3 border-t border-sand-2">
                    <div className="text-xs font-semibold mb-2">Smartsheet Connection</div>
                    <div className="space-y-2">
                      <div>
                        <label className="field-label">API Token</label>
                        <input type="password" value={local.ssToken||''} onChange={e=>set('ssToken',e.target.value)}
                          className="input text-xs w-full font-mono" placeholder="Paste your Smartsheet API token…" />
                        <div className="text-2xs text-dark-3 mt-1">Account → Personal Settings → API Access → Generate new token</div>
                      </div>
                      <div>
                        <label className="field-label">Projects Sheet ID</label>
                        <input value={local.sheetId||''} onChange={e=>set('sheetId',e.target.value)}
                          className="input text-xs w-full font-mono" placeholder="Sheet ID from Smartsheet URL" />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Email Digest */}
            {section === 'email' && (
              <Section title="Email Digest" desc="Configure the daily digest email.">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Enable digest</label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox"
                          checked={local.firm?.digest?.enabled !== false}
                          onChange={e=>set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),enabled:e.target.checked}})} />
                        Send email digest automatically
                      </label>
                    </div>
                    <div>
                      <label className="field-label">Send time (Pacific)</label>
                      <input type="time" value={local.firm?.digest?.time||'09:00'}
                        onChange={e=>set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),time:e.target.value}})}
                        className="input text-xs w-32" />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Send on days</label>
                    <div className="flex gap-3 flex-wrap">
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                        <label key={day} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox"
                            checked={(local.firm?.digest?.days||['Mon','Tue','Wed','Thu','Fri']).includes(day)}
                            onChange={e => {
                              const cur = local.firm?.digest?.days || ['Mon','Tue','Wed','Thu','Fri']
                              const next = e.target.checked ? [...cur,day] : cur.filter(d=>d!==day)
                              set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),days:next}})
                            }} />
                          {day}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Recipients — PM checkboxes + extras */}
                  <div>
                    <label className="field-label">Recipients</label>
                    {(local.pms||[]).filter(pm=>pm.email).length > 0 && (
                      <div className="border border-sand-3 rounded-lg p-3 mb-2 space-y-2">
                        {(local.pms||[]).filter(pm=>pm.email).map(pm => {
                          const checked = (local.firm?.digest?.recipients||[]).map(r=>r.toLowerCase()).includes(pm.email.toLowerCase())
                          return (
                            <label key={pm.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={checked}
                                onChange={e => {
                                  const cur = local.firm?.digest?.recipients||[]
                                  const next = e.target.checked
                                    ? [...cur.filter(r=>r.toLowerCase()!==pm.email.toLowerCase()), pm.email]
                                    : cur.filter(r=>r.toLowerCase()!==pm.email.toLowerCase())
                                  set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),recipients:next}})
                                }} />
                              <span className="font-bold w-8">{pm.name}</span>
                              <span className="text-dark-3">{pm.fullName}</span>
                              <span className="text-dark-3 ml-auto text-2xs">{pm.email}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    <label className="text-2xs text-dark-3 block mb-1">Other recipients</label>
                    <textarea
                      value={(local.firm?.digest?.recipients||[]).filter(r => !(local.pms||[]).map(p=>p.email?.toLowerCase()).includes(r.toLowerCase())).join('\n')}
                      onChange={e => {
                        const pmEmails = (local.firm?.digest?.recipients||[]).filter(r => (local.pms||[]).map(p=>p.email?.toLowerCase()).filter(Boolean).includes(r.toLowerCase()))
                        const extras = e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)
                        set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),recipients:[...pmEmails,...extras]}})
                      }}
                      className="input text-xs w-full h-16 font-mono resize-y"
                      placeholder="one@email.com&#10;two@email.com" />
                    <div className="text-2xs text-dark-3 mt-1">For people not in the PM list above</div>
                  </div>

                  <div>
                    <label className="field-label">Sections to include</label>
                    <div className="space-y-2">
                      {[['billing','Billing KPIs'],['ar','A/R Follow-ups'],['flagged','Flagged Projects'],['pipeline','Pipeline Summary']].map(([key,label])=>(
                        <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox"
                            checked={(local.firm?.digest?.sections||{})[key]!==false}
                            onChange={e=>{
                              const cur = local.firm?.digest?.sections||{billing:true,ar:true,flagged:true,pipeline:true}
                              set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),sections:{...cur,[key]:e.target.checked}}})
                            }} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={sendDigestNow} disabled={sendingDigest}
                      className="btn text-xs" style={{ opacity: sendingDigest ? 0.5 : 1 }}>
                      <i className={clsx('ti', sendingDigest ? 'ti-loader-2 spin' : 'ti-send')} style={{ fontSize: 13 }} />
                      {sendingDigest ? 'Sending…' : 'Send Digest Now'}
                    </button>
                    {digestMsg && <span className={clsx('text-2xs', digestMsg.startsWith('Error') ? 'text-flag' : 'text-success')}>{digestMsg}</span>}
                  </div>

                  {/* Projection Reminders */}
                  <div className="pt-4 border-t border-sand-2">
                    <div className="font-semibold text-xs mb-1">Projection Reminders</div>
                    <div className="text-2xs text-dark-3 mb-3">Sends individual emails to PMs with under-allocated projects. A separate summary goes to the admin list below.</div>

                    <label className="flex items-center gap-2 text-xs cursor-pointer mb-3">
                      <input type="checkbox"
                        checked={local.firm?.digest?.projReminder?.enabled||false}
                        onChange={e=>set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),projReminder:{...(local.firm?.digest?.projReminder||{}),enabled:e.target.checked}}})} />
                      Enable projection reminders
                    </label>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="field-label">Cadence</label>
                        <select value={local.firm?.digest?.projReminder?.cadence||'weekly'}
                          onChange={e=>set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),projReminder:{...(local.firm?.digest?.projReminder||{}),cadence:e.target.value}}})}
                          className="select text-xs w-full">
                          <option value="daily">Daily (same days as digest)</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                        </select>
                      </div>
                      {(local.firm?.digest?.projReminder?.cadence||'weekly') !== 'daily' && (
                        <div>
                          <label className="field-label">Send on</label>
                          <select value={local.firm?.digest?.projReminder?.day||1}
                            onChange={e=>set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),projReminder:{...(local.firm?.digest?.projReminder||{}),day:parseInt(e.target.value)}}})}
                            className="select text-xs w-full">
                            {['Monday','Tuesday','Wednesday','Thursday','Friday'].map((d,i)=>(
                              <option key={i} value={i+1}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <label className="field-label">Summary recipients</label>
                    {(local.pms||[]).filter(pm=>pm.email).length > 0 && (
                      <div className="border border-sand-3 rounded-lg p-3 mb-2 space-y-2">
                        {(local.pms||[]).filter(pm=>pm.email).map(pm => {
                          const checked = (local.firm?.digest?.projReminder?.summaryRecipients||[]).map(r=>r.toLowerCase()).includes(pm.email.toLowerCase())
                          return (
                            <label key={pm.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={checked}
                                onChange={e => {
                                  const cur = local.firm?.digest?.projReminder?.summaryRecipients||[]
                                  const next = e.target.checked
                                    ? [...cur.filter(r=>r.toLowerCase()!==pm.email.toLowerCase()), pm.email]
                                    : cur.filter(r=>r.toLowerCase()!==pm.email.toLowerCase())
                                  set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),projReminder:{...(local.firm?.digest?.projReminder||{}),summaryRecipients:next}}})
                                }} />
                              <span className="font-bold w-8">{pm.name}</span>
                              <span className="text-dark-3">{pm.fullName}</span>
                              <span className="text-dark-3 ml-auto text-2xs">{pm.email}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    <textarea
                      value={(local.firm?.digest?.projReminder?.summaryRecipients||[]).filter(r=>!(local.pms||[]).map(p=>p.email?.toLowerCase()).filter(Boolean).includes(r.toLowerCase())).join('\n')}
                      onChange={e=>{
                        const pmEmails=(local.firm?.digest?.projReminder?.summaryRecipients||[]).filter(r=>(local.pms||[]).map(p=>p.email?.toLowerCase()).filter(Boolean).includes(r.toLowerCase()))
                        const extras=e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)
                        set('firm',{...local.firm,digest:{...(local.firm?.digest||{}),projReminder:{...(local.firm?.digest?.projReminder||{}),summaryRecipients:[...pmEmails,...extras]}}})
                      }}
                      className="input text-xs w-full h-14 font-mono resize-y"
                      placeholder="one@email.com&#10;two@email.com" />
                    <div className="text-2xs text-dark-3 mt-1">Receives a single summary of all under-allocated phases across all PMs</div>

                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={sendProjectionNow} disabled={sendingProj}
                        className="btn text-xs" style={{ opacity: sendingProj ? 0.5 : 1 }}>
                        <i className={clsx('ti', sendingProj ? 'ti-loader-2 spin' : 'ti-send')} style={{ fontSize: 13 }} />
                        {sendingProj ? 'Sending…' : 'Send Reminders Now'}
                      </button>
                      {projMsg && <span className={clsx('text-2xs', projMsg.startsWith('Error') ? 'text-flag' : 'text-success')}>{projMsg}</span>}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Invoicing */}
            {section === 'invoicing' && (
              <Section title="Invoicing" desc="Invoice numbering, defaults, and firm contact details for invoice headers.">
                <div className="space-y-4">
                  <div>
                    <label className="field-label">Invoice Number Format</label>
                    <input value={local.invoicing?.numberFormat||'YYYYMM##'}
                      onChange={e=>set('invoicing',{...local.invoicing,numberFormat:e.target.value})}
                      className="input text-xs w-48 font-mono" placeholder="YYYYMM##" />
                    <div className="text-2xs text-dark-3 mt-1">
                      YYYY = year, MM = month, ## = 2-digit sequence (resets monthly). E.g. YYYYMM## → 20260601
                    </div>
                    <div className="text-2xs text-olive mt-1 font-mono">
                      Preview: {(() => {
                        const fmt = local.invoicing?.numberFormat || 'YYYYMM##'
                        const now = new Date()
                        const y = now.getFullYear(), m = now.getMonth() + 1
                        return fmt.replace('YYYY', y).replace('YY', String(y).slice(2)).replace('MM', String(m).padStart(2,'0')).replace('##', '01')
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Default Payment Terms</label>
                      <input value={local.invoicing?.paymentTerms||'Net 30 Days'}
                        onChange={e=>set('invoicing',{...local.invoicing,paymentTerms:e.target.value})}
                        className="input text-xs w-full" />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Default Invoice Notes</label>
                    <textarea value={local.invoicing?.defaultNotes||'Thank you for the opportunity to be of service.\nPlease reference the invoice number on your payment.'}
                      onChange={e=>set('invoicing',{...local.invoicing,defaultNotes:e.target.value})}
                      className="input text-xs w-full h-16 resize-y" />
                  </div>

                  <div className="pt-3 border-t border-sand-2">
                    <div className="text-xs font-semibold mb-2">Firm Header Details</div>
                    <div className="text-2xs text-dark-3 mb-3">These appear in the invoice header. Falls back to Firm &amp; App settings if left blank.</div>
                    <div className="space-y-2">
                      <div>
                        <label className="field-label">Firm Full Name (invoice header)</label>
                        <input value={local.invoicing?.firmFullName||''}
                          onChange={e=>set('invoicing',{...local.invoicing,firmFullName:e.target.value})}
                          className="input text-xs w-full" placeholder={local.firm?.fullName||'JEFFREY DeMURE + ASSOCIATES'} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="field-label">Address Line 1</label>
                          <input value={local.invoicing?.firmAddr1||''}
                            onChange={e=>set('invoicing',{...local.invoicing,firmAddr1:e.target.value})}
                            className="input text-xs w-full" placeholder="3001 Douglas Boulevard, Suite 110" />
                        </div>
                        <div>
                          <label className="field-label">Address Line 2</label>
                          <input value={local.invoicing?.firmAddr2||''}
                            onChange={e=>set('invoicing',{...local.invoicing,firmAddr2:e.target.value})}
                            className="input text-xs w-full" placeholder="Roseville, California 95661" />
                        </div>
                        <div>
                          <label className="field-label">Phone</label>
                          <input value={local.invoicing?.firmPhone||''}
                            onChange={e=>set('invoicing',{...local.invoicing,firmPhone:e.target.value})}
                            className="input text-xs w-full" placeholder="916.783.3700" />
                        </div>
                        <div>
                          <label className="field-label">Website</label>
                          <input value={local.invoicing?.firmWebsite||''}
                            onChange={e=>set('invoicing',{...local.invoicing,firmWebsite:e.target.value})}
                            className="input text-xs w-full" placeholder="JDAARCH.COM" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Banking / Payment */}
            {section === 'banking' && (
              <Section title="Banking / Payment" desc="ACH and wire transfer details shown on invoice footers. PIN protected.">
                {!bankingUnlocked ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <i className="ti ti-lock text-3xl text-olive opacity-60" />
                    <div className="text-sm text-dark">Enter PIN to view banking details</div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={bankingPinInput}
                        onChange={e => setBankingPinInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return
                          const storedPin = local.banking?.pin || '1234'
                          if (bankingPinInput === storedPin) { setBankingUnlocked(true); setBankingPinInput('') }
                          else { alert('Incorrect PIN'); setBankingPinInput('') }
                        }}
                        className="input text-xs w-28 text-center font-mono"
                        placeholder="PIN"
                        maxLength={12}
                      />
                      <button
                        onClick={() => {
                          const storedPin = local.banking?.pin || '1234'
                          if (bankingPinInput === storedPin) { setBankingUnlocked(true); setBankingPinInput('') }
                          else { alert('Incorrect PIN'); setBankingPinInput('') }
                        }}
                        className="btn btn-primary text-xs"
                      >
                        Unlock
                      </button>
                    </div>
                    <div className="text-2xs text-dark-3">Default PIN is 1234 — change it after unlocking.</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button onClick={() => setBankingUnlocked(false)} className="btn text-2xs text-olive">
                        <i className="ti ti-lock" /> Lock
                      </button>
                    </div>

                    <div>
                      <label className="field-label">PIN (to access this section)</label>
                      <input type="password" value={local.banking?.pin||'1234'}
                        onChange={e=>set('banking',{...local.banking,pin:e.target.value})}
                        className="input text-xs w-32 font-mono" maxLength={12} />
                    </div>

                    <div className="pt-3 border-t border-sand-2">
                      <div className="text-xs font-semibold mb-3">ACH / Wire Transfer</div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="field-label">Bank Name</label>
                            <input value={local.banking?.bankName||''}
                              onChange={e=>set('banking',{...local.banking,bankName:e.target.value})}
                              className="input text-xs w-full" placeholder="Wells Fargo Bank" />
                          </div>
                          <div>
                            <label className="field-label">Account Name</label>
                            <input value={local.banking?.accountName||''}
                              onChange={e=>set('banking',{...local.banking,accountName:e.target.value})}
                              className="input text-xs w-full" placeholder="Jeffrey DeMure + Associates" />
                          </div>
                          <div>
                            <label className="field-label">Routing Number</label>
                            <input value={local.banking?.routingNo||''}
                              onChange={e=>set('banking',{...local.banking,routingNo:e.target.value})}
                              className="input text-xs w-full font-mono" placeholder="121000248" />
                          </div>
                          <div>
                            <label className="field-label">Account Number</label>
                            <input value={local.banking?.accountNo||''}
                              onChange={e=>set('banking',{...local.banking,accountNo:e.target.value})}
                              className="input text-xs w-full font-mono" placeholder="4123456789" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-sand-2">
                      <div className="text-xs font-semibold mb-3">Mail Payments To</div>
                      <div className="space-y-2">
                        <div>
                          <label className="field-label">Name</label>
                          <input value={local.banking?.mailName||''}
                            onChange={e=>set('banking',{...local.banking,mailName:e.target.value})}
                            className="input text-xs w-full" placeholder="Jeffrey DeMure + Associates" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="field-label">Address</label>
                            <input value={local.banking?.mailAddr1||''}
                              onChange={e=>set('banking',{...local.banking,mailAddr1:e.target.value})}
                              className="input text-xs w-full" placeholder="3001 Douglas Boulevard, Suite 110" />
                          </div>
                          <div>
                            <label className="field-label">City, State ZIP</label>
                            <input value={local.banking?.mailAddr2||''}
                              onChange={e=>set('banking',{...local.banking,mailAddr2:e.target.value})}
                              className="input text-xs w-full" placeholder="Roseville, California 95661" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-sand-2">
                      <div className="text-xs font-semibold mb-1">Questions / A/R Contact</div>
                      <div className="text-2xs text-dark-3 mb-3">Appears in the "QUESTIONS?" block on every invoice footer.</div>
                      <div className="space-y-2">
                        <div>
                          <label className="field-label">Contact Name</label>
                          <input value={local.banking?.questionsName||''}
                            onChange={e=>set('banking',{...local.banking,questionsName:e.target.value})}
                            className="input text-xs w-full" placeholder="e.g. Accounting Department" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="field-label">Email</label>
                            <input value={local.banking?.questionsEmail||''}
                              onChange={e=>set('banking',{...local.banking,questionsEmail:e.target.value})}
                              className="input text-xs w-full" placeholder="accounting@jdaarch.com" />
                          </div>
                          <div>
                            <label className="field-label">Phone</label>
                            <input value={local.banking?.questionsPhone||''}
                              onChange={e=>set('banking',{...local.banking,questionsPhone:e.target.value})}
                              className="input text-xs w-full" placeholder="916.783.3700" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Advanced */}
            {section === 'advanced' && (
              <Section title="Advanced" desc="Data import/export tools. For onboarding or manual corrections only.">
                <div className="space-y-3">
                  {[
                    { label:'Export JSON Backup', icon:'ti-download', desc:'Download a full data backup', action: () => {
                      const data = JSON.stringify({ projects: appState.projects, invoices: appState.invoices, opportunities: appState.opportunities, settings: appState.settings, nextId: appState.nextId }, null, 2)
                      const a = document.createElement('a'); a.href='data:application/json,'+encodeURIComponent(data)
                      a.download='feecast-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click()
                    }},
                    { label:'Restore JSON Backup', icon:'ti-upload', desc:'Restore from a JSON backup file', action: () => {
                      const inp = document.createElement('input'); inp.type='file'; inp.accept='.json'
                      inp.onchange = e => {
                        const file = e.target.files[0]; if(!file) return
                        const reader = new FileReader()
                        reader.onload = ev => {
                          try {
                            const d = JSON.parse(ev.target.result)
                            if(confirm(`Restore backup from ${file.name}? This will replace all current data.`))
                              mutate(prev => ({ ...prev, ...d }))
                          } catch(err) { alert('Invalid backup file: '+err.message) }
                        }
                        reader.readAsText(file)
                      }
                      inp.click()
                    }},
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <button onClick={item.action} className="btn btn-sm whitespace-nowrap">
                        <i className={clsx('ti', item.icon)} /> {item.label}
                      </button>
                      <span className="text-2xs text-dark-3">{item.desc}</span>
                    </div>
                  ))}
                  <div className="pt-4 mt-4 border-t border-sand-2">
                    <div className="font-semibold text-xs mb-1">Smartsheet Sync</div>
                    <div className="text-2xs text-dark-3 mb-3">Pull project and A/R data from Smartsheet. This will overwrite current data — use with caution.</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={doSync} disabled={syncing}
                        className="btn btn-sm text-warning border-warning/30" style={{ opacity: syncing ? 0.5 : 1 }}>
                        <i className={clsx('ti', syncing ? 'ti-loader-2 spin' : 'ti-refresh')} /> {syncing ? 'Syncing…' : 'Sync Projects'}
                      </button>
                      <button onClick={doSyncAR} disabled={syncingAR}
                        className="btn btn-sm text-warning border-warning/30" style={{ opacity: syncingAR ? 0.5 : 1 }}>
                        <i className={clsx('ti', syncingAR ? 'ti-loader-2 spin' : 'ti-refresh')} /> {syncingAR ? 'Syncing…' : 'Sync A/R'}
                      </button>
                      {syncMsg && <span className={clsx('text-2xs', syncMsg.startsWith('✓') ? 'text-success' : 'text-flag')}>{syncMsg}</span>}
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-sand-2 shrink-0 bg-sand">
          {dirty && (
            <span className="text-2xs text-warning flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" /> Unsaved changes
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="btn text-xs">Cancel</button>
            <button onClick={save} className="btn btn-primary text-xs">
              <i className="ti ti-device-floppy" /> Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <div>
      <div className="font-semibold text-sm mb-0.5">{title}</div>
      {desc && <div className="text-2xs text-dark-3 mb-4">{desc}</div>}
      {children}
    </div>
  )
}

function CodeLabelList({ items, onChange }) {
  const nextId = () => Math.max(0, ...(items||[]).map(x=>x.id||0)) + 1
  return (
    <>
      <div className="space-y-2 mb-3">
        {(items||[]).map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <input value={item.code} onChange={e=>{const a=[...items];a[i]={...a[i],code:e.target.value};onChange(a)}}
              className="input text-xs w-20 font-mono font-bold" />
            <input value={item.label} onChange={e=>{const a=[...items];a[i]={...a[i],label:e.target.value};onChange(a)}}
              className="input text-xs flex-1" />
            <button onClick={()=>onChange(items.filter((_,j)=>j!==i))}
              className="btn btn-icon btn-sm btn-danger"><i className="ti ti-x" style={{fontSize:11}} /></button>
          </div>
        ))}
      </div>
      <AddRow onAdd={vals=>onChange([...(items||[]),{id:nextId(),code:vals[0],label:vals[1]}])}
        placeholders={['Code','Description']} widths={['w-20','flex-1']} />
    </>
  )
}

function AddRow({ onAdd, placeholders, widths }) {
  const [vals, setVals] = useState(placeholders.map(()=>''))
  const update = (i, v) => setVals(prev => { const n=[...prev]; n[i]=v; return n })
  const submit = () => {
    if (!vals[0].trim()) return
    onAdd(vals)
    setVals(placeholders.map(()=>''))
  }
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-sand-2">
      {placeholders.map((ph, i) => (
        <input key={i} value={vals[i]} onChange={e=>update(i,e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&submit()}
          placeholder={ph} className={clsx('input text-xs', widths[i])} />
      ))}
      <button onClick={submit} className="btn btn-sm btn-primary shrink-0">
        <i className="ti ti-plus" /> Add
      </button>
    </div>
  )
}
