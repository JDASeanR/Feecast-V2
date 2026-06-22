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
const pRem    = p  => pFee(p)-pBil(p)-phYTDArr(p)
function phYTDArr(p){return(p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0);}

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

export default function SummaryTab({ appState }) {
  const { projects, invoices, opportunities, settings } = appState
  const pmList      = (settings.pms||[]).map(p=>p.name)
  const monthlyGoal = settings.billing?.monthlyGoal || 395000

  const active       = projects.filter(p=>!p.archived)
  const activeOpps   = opportunities.filter(o=>!o.archived&&o.status!=='04 Won'&&o.status!=='05 Lost')

  const tF  = active.reduce((s,p)=>s+pFee(p),0)
  const tB  = active.reduce((s,p)=>s+pBil(p),0)
  const tYTD = Array.from({length:CM-1},(_,i)=>mTotalAll(`${CY}-${String(i+1).padStart(2,'0')}`,projects)).reduce((s,v)=>s+v,0)
  const tR  = tF-tB-tYTD
  const wip = tF>0?(tB+tYTD)/tF:0

  // YTD spotlight
  const ytdMks = Array.from({length:CM-1},(_,i)=>`${CY}-${String(i+1).padStart(2,'0')}`)
  const ytdActual = ytdMks.reduce((s,mk)=>s+mTotalAll(mk,projects),0)
  const ytdGoal   = ytdMks.length * monthlyGoal
  const ytdDelta  = ytdActual - ytdGoal

  // Current month
  const curMonthLabel = new Date(CY,CM-1,1).toLocaleDateString('en-US',{month:'short',year:'2-digit'})
  const curT  = mTotalAll(CUR_MK, projects.filter(p=>!p.archived))
  const curDelta = curT - monthlyGoal

  // A/R
  const arTot = invoices.filter(i=>!i.paid).reduce((s,i)=>s+(i.amount||0),0)
  const arPD  = invoices.filter(i=>!i.paid&&effBucket(i)!=='0-30').reduce((s,i)=>s+(i.amount||0),0)

  // Pipeline
  const pipeline = activeOpps.reduce((s,o)=>s+(o.fee||0)*((o.confidence||50)/100),0)

  // By PM
  const byPM = {}
  active.forEach(p=>{
    if(!p.pm)return
    if(!byPM[p.pm])byPM[p.pm]={fee:0,billed:0,count:0,flags:0}
    byPM[p.pm].fee+=pFee(p);byPM[p.pm].billed+=pBil(p);byPM[p.pm].count++
    if(p.flag||p.phases.some(ph=>ph.flag))byPM[p.pm].flags++
  })

  // PM billing coverage (next 3 months)
  const n3Mks = Array.from({length:3},(_,i)=>{const d=new Date(CY,CM-1+i,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})
  const tBacklog = active.reduce((s,p)=>s+pRem(p),0)

  const pmData = pmList.map(pm=>{
    const pmProjects = active.filter(p=>p.pm===pm)
    if(!pmProjects.length) return null
    const backlog = pmProjects.reduce((s,p)=>s+pRem(p),0)
    const n3Months = n3Mks.map(mk=>pmProjects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0))
    const n3Alloc  = n3Months.reduce((s,v)=>s+v,0)
    const pmSettings = settings.pms?.find(p=>p.name===pm)
    const pmMonthlyGoal = pmSettings?.monthlyGoal>0?pmSettings.monthlyGoal:null
    const backlogShare = tBacklog>0?backlog/tBacklog:1/pmList.length
    const n3Goal = pmMonthlyGoal?pmMonthlyGoal*3:monthlyGoal*3*backlogShare
    const monthlyGoalUsed = pmMonthlyGoal||Math.round(monthlyGoal*backlogShare)
    const coverage = n3Goal>0?Math.round(n3Alloc/n3Goal*100):0
    const coverageColor = coverage>=80?'#2d7a3a':coverage>=60?'#BD6439':'#c0392b'
    const coverageIcon  = coverage>=80?'✓':coverage>=60?'⚡':'⚠️'
    const pmPipeline = activeOpps.filter(o=>o.pm===pm).reduce((s,o)=>s+Math.round((o.fee||0)*(o.confidence||50)/100),0)
    const totalCap = backlog+pmPipeline
    const monthsOfWork = monthlyGoalUsed>0?Math.round(totalCap/monthlyGoalUsed*10)/10:0
    return {pm,backlog,n3Alloc,n3Months,n3Goal,coverage,coverageColor,coverageIcon,pipeline:pmPipeline,totalCap,monthsOfWork,count:pmProjects.length,monthlyGoalUsed,hasCustomGoal:!!pmMonthlyGoal}
  }).filter(Boolean).sort((a,b)=>b.backlog-a.backlog)

  const fmtM = n => '$'+(Math.abs(n)/1e6).toFixed(2)+'M'

  return (
    <div className="p-4 space-y-4">

      {/* Top KPI rows */}
      <div className="grid grid-cols-2 gap-4">

        {/* YTD */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="font-display text-base tracking-wide mb-3">YTD {CY} — {ytdMks.length} months</div>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Billed YTD" sub="FF + hourly, Jan–last mo" value={fmtK(ytdActual)} color="text-terracotta" />
            <KPI label="Goal YTD" sub="mo goal × months elapsed" value={fmtK(ytdGoal)} />
            <KPI label="vs. Goal" sub="billed − goal" value={(ytdDelta>=0?'+':'')+fmtK(ytdDelta)} color={ytdDelta>=0?'text-success':'text-warning'} />
          </div>
        </div>

        {/* Current month */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="font-display text-base tracking-wide mb-3">{curMonthLabel} — Current Month</div>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Projected" sub="current mo allocations" value={fmtK(curT)} color={curDelta>=0?'text-success':'text-warning'} />
            <KPI label="Goal" sub="annual goal ÷ 12" value={fmtK(monthlyGoal)} />
            <KPI label="vs. Goal" sub="projected − mo goal" value={(curDelta>=0?'+':'')+fmtK(curDelta)} color={curDelta>=0?'text-success':'text-warning'} />
          </div>
        </div>
      </div>

      {/* Firm metrics strip */}
      <div className="bg-white rounded-lg border border-sand-3 p-4">
        <div className="grid grid-cols-6 gap-4">
          <MetricCell label="Total Fees" sub="all contracted fees" value={fmtM(tF)} />
          <MetricCell label="Prior Billed" sub="pre-current year" value={fmtM(tB)} />
          <MetricCell label="Remaining" sub="fees − billed − YTD" value={fmtM(tR)} warn />
          <MetricCell label="Firm WIP" sub="billed ÷ total fees" value={Math.round(wip*100)+'%'} />
          <MetricCell label="Total A/R" sub="unpaid invoices" value={fmt(arTot)} warn />
          <MetricCell label="Pipeline (wtd)" sub="fee × confidence%" value={fmtM(pipeline)} purple />
        </div>
      </div>

      {/* By PM table */}
      <div className="bg-white rounded-lg border border-sand-3 p-4">
        <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">By Project Manager</div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>PM</th>
              <th className="text-right">Projects</th>
              <th className="text-right">Total Fees <span className="font-normal text-dark-3">(all phase fees)</span></th>
              <th className="text-right">Billed <span className="font-normal text-dark-3">(prior + YTD)</span></th>
              <th className="text-right">Remaining</th>
              <th className="text-right">WIP %</th>
              <th className="text-right">Flags</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byPM).sort((a,b)=>b[1].fee-a[1].fee).map(([pm,d])=>{
              const rem=d.fee-d.billed,w=d.fee>0?Math.round(d.billed/d.fee*100):0
              return <tr key={pm}>
                <td className="px-2 font-semibold text-xs">{pm}</td>
                <td className="px-2 text-right text-xs">{d.count}</td>
                <td className="px-2 text-right text-xs">{fmt(d.fee)}</td>
                <td className="px-2 text-right text-xs">{fmt(d.billed)}</td>
                <td className="px-2 text-right text-xs text-olive">{fmt(rem)}</td>
                <td className="px-2 text-right text-xs">{w}%</td>
                <td className="px-2 text-right text-xs">{d.flags>0?<span className="text-flag font-bold">{d.flags} <i className="ti ti-flag-filled" style={{fontSize:10}} /></span>:'—'}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      {/* PM Billing Coverage */}
      <div className="bg-white rounded-lg border border-sand-3 p-4">
        <div className="font-display text-lg tracking-wide mb-1">PM Billing Coverage</div>
        <div className="text-xs text-dark-3 mb-3">
          Coverage = next 3 months allocated vs. proportional billing goal &nbsp;·&nbsp;
          <span className="text-success">✓ ≥80%</span> &nbsp;
          <span className="text-terracotta">⚡ 60–80%</span> &nbsp;
          <span className="text-flag">⚠️ &lt;60%</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-dark text-white">
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
                <tr key={d.pm} className="border-b border-sand-2 hover:bg-sand">
                  <td className="px-3 py-2 font-bold">{d.pm}</td>
                  <td className="px-3 py-2 text-right">{fmt(d.backlog)}</td>
                  <td className="px-3 py-2 text-right">
                    {d.hasCustomGoal
                      ? <span className="text-olive font-semibold">{fmt(d.monthlyGoalUsed)}</span>
                      : <span className="text-dark-3">{fmt(d.monthlyGoalUsed)} <span className="text-2xs">(auto)</span></span>
                    }
                  </td>
                  {d.n3Months.map((v,i)=>(
                    <td key={i} className={clsx('px-3 py-2 text-right', v>0?'font-semibold':'text-dark-3')}>
                      {v>0?fmt(v):'—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-olive">{fmt(Math.round(d.n3Goal))}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-12 h-1.5 bg-sand-3 rounded overflow-hidden">
                        <div className="h-full rounded" style={{width:Math.min(100,d.coverage)+'%',background:d.coverageColor}} />
                      </div>
                      <span className="font-bold text-2xs" style={{color:d.coverageColor}}>
                        {d.coverageIcon} {d.coverage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-terracotta">{d.pipeline>0?fmt(d.pipeline):'—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(d.totalCap)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={clsx(
                      'text-2xs px-2 py-0.5 rounded font-semibold',
                      d.monthsOfWork>=6?'bg-green-50 text-success':d.monthsOfWork>=3?'bg-orange-50 text-terracotta':'bg-red-50 text-flag'
                    )}>
                      {d.monthsOfWork} mo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-2xs text-dark-3 mt-2">
          Goal share is proportional to each PM's backlog. Pipeline includes active opportunities weighted by confidence.
        </div>
      </div>
    </div>
  )
}

function KPI({ label, sub, value, color }) {
  return (
    <div className="bg-sand rounded p-3">
      <div className="text-2xs text-dark-3 mb-1">{label}</div>
      <div className={clsx('text-lg font-bold leading-none', color||'text-dark')}>{value}</div>
      {sub && <div className="text-2xs text-dark-3 mt-1">{sub}</div>}
    </div>
  )
}

function MetricCell({ label, sub, value, warn, purple }) {
  return (
    <div>
      <div className="text-2xs text-dark-3 mb-1">{label}</div>
      <div className={clsx('text-lg font-bold leading-none',warn?'text-warning':purple?'text-terracotta':'text-dark')}>{value}</div>
      {sub && <div className="text-2xs text-dark-3 mt-0.5">{sub}</div>}
    </div>
  )
}

function Th({ children, left }) {
  return (
    <th className={clsx('px-3 py-2 text-2xs font-semibold uppercase tracking-wider', left?'text-left':'text-right')}>
      {children}
    </th>
  )
}
