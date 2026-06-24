import { useState } from 'react'
import { fmt, fmtK, clsx } from '../../lib/utils'

const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const CUR_MK = `${CY}-${String(CM).padStart(2,'0')}`

const phCAEst = ph => ph.scope==='CA'?(ph.fee||0)*(ph.caMonths||12):0
const phFeeFC = ph => ph.scope==='CA'?phCAEst(ph):(ph.fee||0)
function phYTD(ph){let s=0;for(let m=1;m<CM;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;s+=ph.monthly?.[mk]||0;}return s;}
const phRem   = ph => Math.max(0,phFeeFC(ph)-(ph.billed||0)-phYTD(ph))
const phAlloc = ph => Object.entries(ph.monthly||{}).filter(([mk])=>mk>=CUR_MK).reduce((s,[,v])=>s+v,0)
const pFee    = p  => (p.phases||[]).reduce((s,ph)=>s+phFeeFC(ph),0)
const pBil    = p  => (p.phases||[]).reduce((s,ph)=>s+(ph.billed||0),0)
function phYTDArr(p){return(p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0);}
const pRem    = p  => pFee(p)-pBil(p)-phYTDArr(p)

function mTotalAll(mk,projects){
  return projects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

function invAgeDays(inv){
  const ino=String(inv.invoiceNo||'')
  if(ino.length>=6){const yr=+ino.slice(0,4),mo=+ino.slice(4,6);if(yr>2000&&mo>=1&&mo<=12){const d=new Date(yr,mo-1,1);d.setDate(d.getDate()+30);return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));}}
  return 0
}
const autoBucket=days=>days<=30?'0-30':days<=60?'30-60':days<=90?'60-90':days<=120?'90-120':'120+'
const effBucket=inv=>inv.bucketOverride||autoBucket(invAgeDays(inv))

// ── Heatmap color helpers ─────────────────────────────────────────────────────
function gradientColor(pct) {
  if (pct > 100) {
    return { bg:'#736F4C', text:'#F5F5F1', border:'#55512e', pipeColor:'rgba(245,245,241,0.75)' }
  }
  const p = Math.max(0, Math.min(pct, 100)) / 100
  const r = Math.round(245 + (189-245)*p)
  const g = Math.round(245 + (100-245)*p)
  const b = Math.round(241 + (57-241)*p)
  const brightness = (r*299 + g*587 + b*114) / 1000
  const text = brightness > 145 ? '#3D3935' : '#F5F5F1'
  const pipeColor = brightness > 145 ? '#736F4C' : 'rgba(245,245,241,0.75)'
  const border = brightness > 145
    ? 'rgba(61,57,53,0.2)'
    : `rgb(${Math.round(r*0.78)},${Math.round(g*0.78)},${Math.round(b*0.78)})`
  return { bg:`rgb(${r},${g},${b})`, text, border, pipeColor }
}

function coverageBgColor(pct) {
  if (pct > 100) return '#736F4C'
  const p = Math.max(0, Math.min(pct,100))/100
  const r = Math.round(245+(189-245)*p)
  const g = Math.round(245+(100-245)*p)
  const b = Math.round(241+(57-241)*p)
  return `rgb(${r},${g},${b})`
}

// ── PM Heatmap component ──────────────────────────────────────────────────────
function PMHeatmap({ pmData, activeOpps }) {
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(CY, CM-1+i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-US', {month:'short', year:'2-digit'})
    }
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#736F4C' }}>
          <span>0%</span>
          <div style={{ width:100, height:12, borderRadius:3, background:'linear-gradient(to right,#F5F5F1,#BD6439)' }} />
          <span>100%</span>
          <div style={{ width:14, height:12, borderRadius:3, background:'#736F4C', marginLeft:6 }} />
          <span>100%+</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#736F4C' }}>
          <div style={{ width:14, height:12, borderRadius:3, background:'#F5F5F1', border:'1.5px dashed #736F4C' }} />
          <span>+ pipeline</span>
        </div>
      </div>

      <table style={{ borderCollapse:'separate', borderSpacing:4, width:'100%', tableLayout:'fixed', minWidth:560 }}>
        <thead>
          <tr>
            <th style={{ width:44, textAlign:'left', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#736F4C', padding:'4px 0', fontWeight:600, border:'none', background:'transparent' }}>PM</th>
            {months.map(m => (
              <th key={m.key} style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#736F4C', padding:'4px 0', textAlign:'center', fontWeight:600, border:'none', background:'transparent' }}>{m.label}</th>
            ))}
            <th style={{ width:56, fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#736F4C', padding:'4px 0', textAlign:'right', fontWeight:600, border:'none', background:'transparent' }}>Goal</th>
          </tr>
        </thead>
        <tbody>
          {pmData.map(d => {
            const pmOpps = activeOpps.filter(o => o.pm === d.pm)
            return (
              <tr key={d.pm}>
                <td style={{ padding:0, border:'none', verticalAlign:'middle', height:84, fontSize:13, fontWeight:700, color:'#3D3935', paddingRight:8, whiteSpace:'nowrap' }}>{d.pm}</td>
                {months.map((m) => {
                  const alloc = d.pmProjects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[m.key]||0),0),0)
                  const pipe = pmOpps.reduce((s,o)=>s+Math.round((o.fee||0)*((o.confidence||50)/100)/6),0)
                  const pct = d.monthlyGoalUsed>0 ? Math.round(alloc/d.monthlyGoalUsed*100) : 0
                  const combinedPct = d.monthlyGoalUsed>0 ? Math.round((alloc+pipe)/d.monthlyGoalUsed*100) : 0
                  const s = gradientColor(pct)
                  return (
                    <td key={m.key} style={{ padding:0, border:'none', verticalAlign:'top' }}>
                      <div style={{
                        borderRadius:5, border:`1px solid ${s.border}`, background:s.bg,
                        width:'100%', height:84, display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'flex-start',
                        paddingTop:14, gap:2, overflow:'hidden', cursor:'default',
                      }}>
                        <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:24, fontWeight:700, lineHeight:1, letterSpacing:'0.02em', color:s.text, flexShrink:0 }}>
                          {pct > 0 ? `${pct}%` : '—'}
                        </div>
                        <div style={{ fontSize:11, fontWeight:600, color:s.text, flexShrink:0 }}>
                          {alloc > 0 ? fmtK(alloc) : ''}
                        </div>
                        {pipe > 0 && (
                          <div style={{ fontSize:10, color:s.pipeColor, borderTop:`1px dashed ${s.pipeColor}`, paddingTop:3, marginTop:2, width:'80%', textAlign:'center', flexShrink:0 }}>
                            +{fmtK(pipe)}
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding:0, border:'none', verticalAlign:'middle', paddingLeft:8, fontSize:11, color:'#736F4C', textAlign:'right', whiteSpace:'nowrap' }}>
                  {fmtK(d.monthlyGoalUsed)}
                </td>
              </tr>
            )
          })}

          {/* Firm totals row */}
          <tr>
            <td style={{ padding:0, border:'none', verticalAlign:'middle', height:84, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#736F4C', fontWeight:700, paddingRight:8 }}>Firm</td>
            {months.map(m => {
              const mAlloc = pmData.reduce((s,d)=>s+d.pmProjects.reduce((ps,p)=>ps+p.phases.reduce((phs,ph)=>phs+(ph.monthly?.[m.key]||0),0),0),0)
              const mGoal  = pmData.reduce((s,d)=>s+(d.monthlyGoalUsed||0),0)
              const mPipe  = activeOpps.reduce((s,o)=>s+Math.round((o.fee||0)*((o.confidence||50)/100)/6),0)
              const pct = mGoal>0 ? Math.round(mAlloc/mGoal*100) : 0
              const s = gradientColor(pct)
              return (
                <td key={m.key} style={{ padding:0, border:'none', verticalAlign:'top' }}>
                  <div style={{ borderRadius:5, border:`1px solid ${s.border}`, background:s.bg, width:'100%', height:84, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', paddingTop:14, gap:2, overflow:'hidden' }}>
                    <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:24, fontWeight:700, lineHeight:1, letterSpacing:'0.02em', color:s.text }}>{pct>0?`${pct}%`:'—'}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:s.text }}>{fmtK(mAlloc)}</div>
                    {mPipe>0 && <div style={{ fontSize:10, color:s.pipeColor, borderTop:`1px dashed ${s.pipeColor}`, paddingTop:3, marginTop:2, width:'80%', textAlign:'center' }}>+{fmtK(mPipe)}</div>}
                  </div>
                </td>
              )
            })}
            <td style={{ padding:0, border:'none', verticalAlign:'middle', paddingLeft:8, fontSize:11, color:'#736F4C', textAlign:'right' }}>
              {fmtK(pmData.reduce((s,d)=>s+(d.monthlyGoalUsed||0),0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPI({ label, sub, value, accent, delta }) {
  const color = delta !== undefined
    ? (delta >= 0 ? '#2d7a3a' : '#BD6439')
    : accent ? '#BD6439' : '#3D3935'
  return (
    <div style={{ background:'#ECEAE3', borderRadius:4, padding:'12px 14px' }}>
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-display tracking-display leading-none" style={{ fontSize:24, color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#736F4C', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function MetricCell({ label, sub, value, warn, accent }) {
  const color = warn ? '#BD6439' : accent ? '#BD6439' : '#3D3935'
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-display tracking-display leading-none" style={{ fontSize:20, color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#736F4C', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function Th({ children, left }) {
  return (
    <th className="px-3 py-2 font-display tracking-eyebrow uppercase"
      style={{ fontSize:9, textAlign:left?'left':'right', fontWeight:400 }}>
      {children}
    </th>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SummaryTab({ appState }) {
  const { projects, invoices, opportunities, settings } = appState
  const pmList      = (settings.pms||[]).map(p=>p.name)
  const monthlyGoal = settings.billing?.monthlyGoal || 395000

  const [coverageView, setCoverageView] = useState('heatmap')

  const active     = projects.filter(p=>!p.archived)
  const activeOpps = opportunities.filter(o=>!o.archived&&o.status!=='04 Won'&&o.status!=='05 Lost')

  const tF   = active.reduce((s,p)=>s+pFee(p),0)
  const tB   = active.reduce((s,p)=>s+pBil(p),0)
  const tYTD = Array.from({length:CM-1},(_,i)=>mTotalAll(`${CY}-${String(i+1).padStart(2,'0')}`,projects)).reduce((s,v)=>s+v,0)
  const tR   = tF-tB-tYTD
  const wip  = tF>0?(tB+tYTD)/tF:0

  const ytdMks    = Array.from({length:CM-1},(_,i)=>`${CY}-${String(i+1).padStart(2,'0')}`)
  const ytdActual = ytdMks.reduce((s,mk)=>s+mTotalAll(mk,projects),0)
  const ytdGoal   = ytdMks.length * monthlyGoal
  const ytdDelta  = ytdActual - ytdGoal

  const curMonthLabel = new Date(CY,CM-1,1).toLocaleDateString('en-US',{month:'short',year:'2-digit'})
  const curT     = mTotalAll(CUR_MK, active)
  const curDelta = curT - monthlyGoal

  const arTot   = invoices.filter(i=>!i.paid).reduce((s,i)=>s+(i.amount||0),0)
  const pipeline = activeOpps.reduce((s,o)=>s+(o.fee||0)*((o.confidence||50)/100),0)

  const byPM = {}
  active.forEach(p=>{
    if(!p.pm)return
    if(!byPM[p.pm])byPM[p.pm]={fee:0,billed:0,count:0,flags:0}
    byPM[p.pm].fee+=pFee(p);byPM[p.pm].billed+=pBil(p);byPM[p.pm].count++
    if(p.flag||p.phases.some(ph=>ph.flag))byPM[p.pm].flags++
  })

  const n3Mks  = Array.from({length:3},(_,i)=>{const d=new Date(CY,CM-1+i,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})
  const tBacklog = active.reduce((s,p)=>s+pRem(p),0)

  const pmData = pmList.map(pm=>{
    const pmProjects = active.filter(p=>p.pm===pm)
    if(!pmProjects.length) return null
    const backlog    = pmProjects.reduce((s,p)=>s+pRem(p),0)
    const n3Months   = n3Mks.map(mk=>pmProjects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0))
    const n3Alloc    = n3Months.reduce((s,v)=>s+v,0)
    const pmSettings = settings.pms?.find(p=>p.name===pm)
    const pmMonthlyGoal = pmSettings?.monthlyGoal>0?pmSettings.monthlyGoal:null
    const backlogShare  = tBacklog>0?backlog/tBacklog:1/pmList.length
    const n3Goal        = pmMonthlyGoal?pmMonthlyGoal*3:monthlyGoal*3*backlogShare
    const monthlyGoalUsed = pmMonthlyGoal||Math.round(monthlyGoal*backlogShare)
    const coverage      = n3Goal>0?Math.round(n3Alloc/n3Goal*100):0
    const coverageColor = coverage>100?'#736F4C':coverage>=80?'#BD6439':'#3D3935'
    const coverageIcon  = coverage>100?'✓✓':coverage>=80?'✓':'–'
    const pmPipeline    = activeOpps.filter(o=>o.pm===pm).reduce((s,o)=>s+Math.round((o.fee||0)*(o.confidence||50)/100),0)
    const totalCap      = backlog+pmPipeline
    const monthsOfWork  = monthlyGoalUsed>0?Math.round(totalCap/monthlyGoalUsed*10)/10:0
    return {pm,backlog,n3Alloc,n3Months,n3Goal,coverage,coverageColor,coverageIcon,pipeline:pmPipeline,totalCap,monthsOfWork,count:pmProjects.length,monthlyGoalUsed,hasCustomGoal:!!pmMonthlyGoal,pmProjects}
  }).filter(Boolean).sort((a,b)=>b.backlog-a.backlog)

  const fmtM = n => '$'+(Math.abs(n)/1e6).toFixed(2)+'M'

  return (
    <div className="p-5 space-y-5" style={{ background:'#F5F5F1', minHeight:'100%' }}>

      {/* YTD + Current Month */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="eyebrow mb-1">YTD {CY}</div>
          <div className="font-display tracking-display text-graphite mb-4" style={{ fontSize:13 }}>
            {ytdMks.length} MONTHS ELAPSED
          </div>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Billed YTD" sub="FF + hourly, Jan–last mo" value={fmtK(ytdActual)} accent />
            <KPI label="Goal YTD" sub="mo goal × months elapsed" value={fmtK(ytdGoal)} />
            <KPI label="vs. Goal" sub="billed − goal" value={(ytdDelta>=0?'+':'')+fmtK(ytdDelta)} delta={ytdDelta} />
          </div>
        </div>
        <div className="card">
          <div className="eyebrow mb-1">Current Month</div>
          <div className="font-display tracking-display text-graphite mb-4" style={{ fontSize:13 }}>
            {curMonthLabel.toUpperCase()}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Projected" sub="current mo allocations" value={fmtK(curT)} delta={curDelta} />
            <KPI label="Goal" sub="annual goal ÷ 12" value={fmtK(monthlyGoal)} />
            <KPI label="vs. Goal" sub="projected − mo goal" value={(curDelta>=0?'+':'')+fmtK(curDelta)} delta={curDelta} />
          </div>
        </div>
      </div>

      {/* Firm Overview */}
      <div className="card">
        <div className="eyebrow mb-4">Firm Overview</div>
        <div className="grid grid-cols-6 gap-5">
          <MetricCell label="Total Fees" sub="all contracted fees" value={fmtM(tF)} />
          <MetricCell label="Prior Billed" sub="pre-current year" value={fmtM(tB)} />
          <MetricCell label="Remaining" sub="fees − billed − YTD" value={fmtM(tR)} warn />
          <MetricCell label="Firm WIP" sub="billed ÷ total fees" value={Math.round(wip*100)+'%'} />
          <MetricCell label="Total A/R" sub="unpaid invoices" value={fmt(arTot)} warn />
          <MetricCell label="Pipeline (wtd)" sub="fee × confidence%" value={fmtM(pipeline)} accent />
        </div>
      </div>

      {/* By PM */}
      <div className="card">
        <div className="eyebrow mb-4">By Project Manager</div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>PM</th>
              <th className="text-right">Projects</th>
              <th className="text-right">Total Fees</th>
              <th className="text-right">Billed</th>
              <th className="text-right">Remaining</th>
              <th className="text-right">WIP %</th>
              <th className="text-right">Flags</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byPM).sort((a,b)=>b[1].fee-a[1].fee).map(([pm,d])=>{
              const rem=d.fee-d.billed, w=d.fee>0?Math.round(d.billed/d.fee*100):0
              return (
                <tr key={pm}>
                  <td className="font-semibold">{pm}</td>
                  <td className="text-right">{d.count}</td>
                  <td className="text-right">{fmt(d.fee)}</td>
                  <td className="text-right">{fmt(d.billed)}</td>
                  <td className="text-right" style={{ color:'#736F4C' }}>{fmt(rem)}</td>
                  <td className="text-right">{w}%</td>
                  <td className="text-right">{d.flags>0
                    ? <span style={{ color:'#c0392b', fontWeight:700 }}>{d.flags} <i className="ti ti-flag-filled" style={{fontSize:10}} /></span>
                    : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* PM Billing Coverage — toggled */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div className="eyebrow mb-1">PM Billing Coverage</div>
            <div style={{ fontSize:12, color:'#736F4C' }}>
              {coverageView==='heatmap'
                ? 'Next 6 months · Vellum → Terracotta gradient · Patina = over 100%'
                : 'Next 3 months allocated vs. proportional billing goal'}
            </div>
          </div>
          <div style={{ display:'flex', border:'1px solid rgba(61,57,53,0.2)', borderRadius:5, overflow:'hidden', flexShrink:0 }}>
            {['heatmap','table'].map((v,i) => (
              <button key={v}
                onClick={() => setCoverageView(v)}
                style={{
                  padding:'6px 16px', fontSize:11,
                  fontFamily:'"League Gothic",sans-serif', letterSpacing:'0.1em', textTransform:'uppercase',
                  border:'none', cursor:'pointer', transition:'background 0.15s',
                  borderLeft: i>0 ? '1px solid rgba(61,57,53,0.2)' : 'none',
                  background: coverageView===v ? '#3D3935' : '#F5F5F1',
                  color: coverageView===v ? '#F5F5F1' : '#736F4C',
                }}
              >{v}</button>
            ))}
          </div>
        </div>

        {coverageView === 'heatmap' && (
          <PMHeatmap pmData={pmData} activeOpps={activeOpps} />
        )}

        {coverageView === 'table' && (
          <>
            <div style={{ marginBottom:12, fontSize:12, color:'#736F4C' }}>
              Coverage = next 3 months allocated vs. proportional billing goal &nbsp;·&nbsp;
              <span style={{ color:'#BD6439' }}>✓ ≥80%</span> &nbsp;
              <span style={{ color:'#BD6439' }}>⚡ 60–80%</span> &nbsp;
              <span style={{ color:'#3D3935' }}>⚠️ &lt;60%</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#3D3935', color:'#F5F5F1' }}>
                    <Th left>PM</Th>
                    <Th>Backlog</Th>
                    <Th>Mo Goal</Th>
                    {n3Mks.map(mk=><Th key={mk}>{new Date(mk+'-01').toLocaleDateString('en-US',{month:'short'})}</Th>)}
                    <Th>3 Mo Goal</Th>
                    <Th>Coverage</Th>
                    <Th>Pipeline (wtd)</Th>
                    <Th>Total Capacity</Th>
                    <Th>Months of Work</Th>
                  </tr>
                </thead>
                <tbody>
                  {pmData.map(d=>(
                    <tr key={d.pm} style={{ borderBottom:'0.5px solid rgba(61,57,53,0.1)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(236,234,227,0.5)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td className="px-3 py-2 font-bold">{d.pm}</td>
                      <td className="px-3 py-2 text-right">{fmt(d.backlog)}</td>
                      <td className="px-3 py-2 text-right">
                        {d.hasCustomGoal
                          ? <span style={{ color:'#736F4C', fontWeight:600 }}>{fmt(d.monthlyGoalUsed)}</span>
                          : <span style={{ color:'#8a8580' }}>{fmt(d.monthlyGoalUsed)} <span style={{ fontSize:10 }}>(auto)</span></span>
                        }
                      </td>
                      {d.n3Months.map((v,i)=>(
                        <td key={i} className="px-3 py-2 text-right"
                          style={{ fontWeight:v>0?600:400, color:v>0?'#3D3935':'#8a8580' }}>
                          {v>0?fmt(v):'—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right" style={{ color:'#736F4C' }}>{fmt(Math.round(d.n3Goal))}</td>
                      <td className="px-3 py-2">
                        <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                          <div style={{ width:48, height:3, background:'#ECEAE3', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ width:Math.min(100,d.coverage)+'%', height:'100%', background:coverageBgColor(d.coverage), borderRadius:2 }} />
                          </div>
                          <span style={{ fontWeight:700, fontSize:11, color:d.coverageColor }}>
                            {d.coverageIcon} {d.coverage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color:'#BD6439' }}>{d.pipeline>0?fmt(d.pipeline):'—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(d.totalCap)}</td>
                      <td className="px-3 py-2 text-center">
                        <span style={{
                          fontSize:11, padding:'2px 8px', borderRadius:3, fontWeight:600,
                          background:d.monthsOfWork>=6?'rgba(115,111,76,0.12)':d.monthsOfWork>=3?'rgba(189,100,57,0.1)':'rgba(61,57,53,0.08)',
                          color:d.monthsOfWork>=6?'#736F4C':d.monthsOfWork>=3?'#BD6439':'#3D3935'
                        }}>
                          {d.monthsOfWork} mo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:12, fontSize:11, color:'#736F4C' }}>
              Goal share is proportional to each PM's backlog. Pipeline includes active opportunities weighted by confidence.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
