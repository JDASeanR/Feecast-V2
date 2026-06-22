import { useState } from 'react'
import { fmt, fmtK, clsx } from '../../lib/utils'

// ── Historical data ───────────────────────────────────────────────────────────
const HIST_ALL = {
  2004:{6:{g:94666},7:{g:174229},8:{g:154754},9:{g:230135},10:{g:164359},11:{g:131655},12:{g:141872}},
  2005:{1:{g:245821},2:{g:209145},3:{g:261819},4:{g:191044},5:{g:230701},6:{g:251920},7:{g:169903},8:{g:259684},9:{g:320105},10:{g:347057},11:{g:278334},12:{g:293676}},
  2006:{1:{g:448586},2:{g:449039},3:{g:661254},4:{g:474823},5:{g:568741},6:{g:499119},7:{g:624786},8:{g:358451},9:{g:334111},10:{g:310288},11:{g:392121},12:{g:313679}},
  2007:{1:{g:390333},2:{g:259538},3:{g:303375},4:{g:334668},5:{g:322691},6:{g:244163},7:{g:177927},8:{g:187550},9:{g:278376},10:{g:193704},11:{g:174446},12:{g:164350}},
  2008:{1:{g:167225},2:{g:165348},3:{g:144487},4:{g:151066},5:{g:142992},6:{g:163827},7:{g:198371},8:{g:165874},9:{g:154247},10:{g:151148},11:{g:128113},12:{g:140342}},
  2009:{1:{g:181741},2:{g:122611},3:{g:176689},4:{g:125868},5:{g:101872},6:{g:139798},7:{g:122605},8:{g:136189},9:{g:77894},10:{g:146924},11:{g:136942},12:{g:100564}},
  2010:{1:{g:101607},2:{g:81057},3:{g:150641},4:{g:120003},5:{g:118668},6:{g:115228},7:{g:82923},8:{g:148141},9:{g:111272},10:{g:162596},11:{g:108887},12:{g:70663}},
  2015:{1:{g:538011},2:{g:457961},3:{g:402171},4:{g:434630},5:{g:464079},6:{g:379217},7:{g:308017},8:{g:369391},9:{g:327172},10:{g:304625},11:{g:265951},12:{g:296030}},
  2016:{1:{g:304397},2:{g:398374},3:{g:402389},4:{g:312106},5:{g:249955},6:{g:493502},7:{g:428008},8:{g:360655},9:{g:494831},10:{g:450288},11:{g:348068},12:{g:432801}},
  2017:{1:{g:502050},2:{g:500020},3:{g:493135},4:{g:464618},5:{g:374360},6:{g:479722},7:{g:522012},8:{g:517541},9:{g:541706},10:{g:590943},11:{g:566707},12:{g:516043}},
  2018:{1:{g:587456},2:{g:585201},3:{g:651661},4:{g:684376},5:{g:655517},6:{g:718136},7:{g:572526},8:{g:606506},9:{g:577925},10:{g:563027},11:{g:641271},12:{g:500837}},
  2019:{1:{g:593157},2:{g:572714},3:{g:585035},4:{g:509773},5:{g:505477},6:{g:441275},7:{g:552375},8:{g:516730},9:{g:417027},10:{g:366042},11:{g:396371},12:{g:365167}},
  2020:{1:{g:425309},2:{g:335640},3:{g:414925},4:{g:351216},5:{g:266522},6:{g:349484},7:{g:429870},8:{g:343734},9:{g:396909},10:{g:372519},11:{g:463358},12:{g:421793}},
  2021:{1:{g:343965},2:{g:394661},3:{g:371560},4:{g:386526},5:{g:440519},6:{g:470287},7:{g:440385},8:{g:393323},9:{g:559349},10:{g:499650},11:{g:432871},12:{g:503682}},
  2022:{1:{g:450818},2:{g:480630},3:{g:576711},4:{g:392154},5:{g:460098},6:{g:475294},7:{g:423981},8:{g:385213},9:{g:467956},10:{g:314179},11:{g:286690},12:{g:193940}},
  2023:{1:{g:326537},2:{g:320384},3:{g:349952},4:{g:310936},5:{g:311074},6:{g:317032},7:{g:320572},8:{g:203372},9:{g:307468},10:{g:315012},11:{g:238859},12:{g:281271}},
  2024:{1:{g:256070},2:{g:225298},3:{g:178281},4:{g:233214},5:{g:279243},6:{g:240895},7:{g:285959},8:{g:300152},9:{g:414488},10:{g:450142},11:{g:456130},12:{g:421759}},
  2025:{1:{g:403412},2:{g:422644},3:{g:391000},4:{g:349412},5:{g:324854},6:{g:331119},7:{g:305257},8:{g:267484},9:{g:308896},10:{g:317147},11:{g:297913},12:{g:158460}},
  2026:{1:{g:288760},2:{g:246125},3:{g:319853},4:{g:228927},5:{g:201505},6:{g:165845},7:{g:136963},8:{g:50300},9:{g:8810},10:{g:10837},11:{g:null},12:{g:null}},
}

const AR_BUCKETS = ['0-30','30-60','60-90','90-120','120+']
const AR_COLORS  = {'0-30':'#4ade80','30-60':'#fde047','60-90':'#fb923c','90-120':'#f87171','120+':'#dc2626'}
const AR_LABELS  = {'0-30':'Current','30-60':'30–60d','60-90':'60–90d','90-120':'90–120d','120+':'120+d'}
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const YOY_COLORS = ['#f97316','#3b82f6','#6366f1','#94a3b8']

function invAgeDays(inv) {
  const ino = String(inv.invoiceNo || '')
  if (ino.length >= 6) {
    const yr = +ino.slice(0,4), mo = +ino.slice(4,6)
    if (yr > 2000 && mo >= 1 && mo <= 12) {
      const d = new Date(yr, mo-1, 1); d.setDate(d.getDate()+30)
      return Math.max(0, Math.floor((Date.now()-d.getTime())/86400000))
    }
  }
  return 0
}
const autoBucket = days => days<=30?'0-30':days<=60?'30-60':days<=90?'60-90':days<=120?'90-120':'120+'
const effBucket  = inv => inv.bucketOverride || autoBucket(invAgeDays(inv))

// Phase helpers
const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const phCAEst = ph => ph.scope==='CA'?(ph.fee||0)*(ph.caMonths||12):0
const phFeeFC = ph => ph.scope==='CA'?phCAEst(ph):(ph.fee||0)
function phYTD(ph) { let s=0; for(let m=1;m<CM;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;s+=ph.monthly?.[mk]||0;} return s; }
const phRem   = ph => Math.max(0, phFeeFC(ph)-(ph.billed||0)-phYTD(ph))
const pFee    = p  => (p.phases||[]).reduce((s,ph)=>s+phFeeFC(ph),0)
const pBil    = p  => (p.phases||[]).reduce((s,ph)=>s+(ph.billed||0),0)
const pYTD    = p  => (p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0)
const pRem    = p  => pFee(p)-pBil(p)-pYTD(p)

function mTotalAll(mk, projects) {
  return projects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}
function mTotal(mk, projects) {
  return projects.filter(p=>!p.archived).reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

export default function DashboardTab({ appState, onNavigate }) {
  const { projects, invoices, opportunities, settings } = appState
  const hourlyData   = settings.billing?.hourlyByMonth || {}
  const monthlyGoal  = settings.billing?.monthlyGoal || 395000
  const annualGoal   = settings.billing?.annualGoal || 4740000
  const billable     = settings.employees?.billable || 12
  const totEmp       = settings.employees?.total || 17

  const [yoyYears, setYoyYears] = useState([CY, CY-1, CY-2])
  const [yoyOpen,  setYoyOpen]  = useState(false)

  const active      = projects.filter(p=>!p.archived)
  const activeOpps  = opportunities.filter(o=>!o.archived&&o.status!=='04 Won'&&o.status!=='05 Lost')
  const openAR      = invoices.filter(i=>!i.paid&&(i.amount||0)>0)

  // YTD billing (completed months)
  const BILLING_YTD = []
  for (let m=1; m<CM; m++) {
    const mk = `${CY}-${String(m).padStart(2,'0')}`
    const ff = mTotalAll(mk, projects)
    const hourly = hourlyData[mk]||0
    BILLING_YTD.push({ m, mk, ff, hourly, gross: ff+hourly, goal: monthlyGoal })
  }

  // Full year
  const BILLING_YEAR = []
  for (let m=1; m<=12; m++) {
    const mk = `${CY}-${String(m).padStart(2,'0')}`
    const isPast = m < CM
    const ff     = isPast ? mTotalAll(mk, projects) : 0
    const hourly = isPast ? (hourlyData[mk]||0) : 0
    const projFF   = !isPast ? mTotal(mk, projects) : 0
    const projHourly = !isPast ? (hourlyData[mk]||0) : 0
    BILLING_YEAR.push({ m, mk, ff, hourly, gross:ff+hourly, goal:monthlyGoal, isPast, projFF, projHourly })
  }

  const ytdFF    = BILLING_YTD.reduce((s,r)=>s+r.ff,0)
  const ytdHourly = BILLING_YTD.reduce((s,r)=>s+r.hourly,0)
  const ytdGross = BILLING_YTD.reduce((s,r)=>s+r.gross,0)
  const ytdGoal  = BILLING_YTD.reduce((s,r)=>s+r.goal,0)
  const ytdN     = BILLING_YTD.length

  const tF  = active.reduce((s,p)=>s+pFee(p),0)
  const tB  = active.reduce((s,p)=>s+pBil(p),0)
  const tYTD = Array.from({length:CM-1},(_,i)=>mTotalAll(`${CY}-${String(i+1).padStart(2,'0')}`,projects)).reduce((s,v)=>s+v,0)
  const tR  = tF-tB-tYTD
  const fWIP = tF>0?(tB+tYTD)/tF:0

  let futureFF = 0
  for(let m=CM; m<=12; m++) { const mk=`${CY}-${String(m).padStart(2,'0')}`; futureFF+=mTotal(mk,projects)+(hourlyData[mk]||0); }
  const projFF = ytdFF+ytdHourly+futureFF

  const pipelineWtd = activeOpps.reduce((s,o)=>s+(o.fee||0)*((o.confidence||50)/100),0)
  const contractedBacklogMo = monthlyGoal>0?tR/monthlyGoal:0
  const combinedBacklogMo   = monthlyGoal>0?(tR+pipelineWtd)/monthlyGoal:0

  const ffPB = ytdN?ytdFF/ytdN/billable:0
  const ffPT = ytdN?ytdFF/ytdN/totEmp:0

  const arB = {}; AR_BUCKETS.forEach(b=>{arB[b]=0;})
  openAR.forEach(i=>{const b=effBucket(i);arB[b]=(arB[b]||0)+(i.amount||0);})
  const arTot = Object.values(arB).reduce((s,v)=>s+v,0)
  const arPD  = arTot-(arB['0-30']||0)
  const ar90plus = openAR.filter(i=>['90-120','120+'].includes(effBucket(i))).length

  const projFlags = active.filter(p=>p.flag||p.phases.some(ph=>ph.flag)).length
  const pctGoal   = ytdGoal>0?Math.round(ytdGross/ytdGoal*100):0
  const pctProj   = annualGoal>0?Math.round(projFF/annualGoal*100):0
  const goalClr   = pctGoal>=100?'#2d7a3a':pctGoal>=75?'#b45309':'#c0392b'
  const projClr   = pctProj>=100?'#2d7a3a':'#b45309'

  // PM map
  const pmMap = {}
  active.forEach(p=>{
    if(!p.pm)return
    if(!pmMap[p.pm])pmMap[p.pm]={fee:0,billed:0,proj:0,flags:0}
    pmMap[p.pm].proj++; pmMap[p.pm].fee+=pFee(p); pmMap[p.pm].billed+=pBil(p)
    if(p.flag||p.phases.some(ph=>ph.flag))pmMap[p.pm].flags++
  })

  // Quarterly
  const Q1 = BILLING_YTD.filter(r=>r.m<=3&&r.gross>0)
  const Q2 = BILLING_YTD.filter(r=>r.m>=4&&r.m<=6&&r.gross>0)
  const q1v = Q1.length?Q1.reduce((s,r)=>s+r.gross,0)/Q1.length:null
  const q2v = Q2.length?Q2.reduce((s,r)=>s+r.gross,0)/Q2.length:null
  const ytdAvg = ytdN?ytdGross/ytdN:0
  const prev1avg = Object.values(HIST_ALL[CY-1]||{}).reduce((s,d)=>s+(d.g||0),0)/12
  const prev2avg = Object.values(HIST_ALL[CY-2]||{}).reduce((s,d)=>s+(d.g||0),0)/12

  // A/R donut
  const R=28,cx=40,cy=40,circ=2*Math.PI*R; let doff=0
  const arSegs = AR_BUCKETS.map(b=>{const p=arTot>0?(arB[b]||0)/arTot:0;const len=p*circ;const s={b,len,doff,color:AR_COLORS[b]};doff+=len;return s;}).filter(s=>s.len>0)

  // Cumulative YTD chart SVG
  const W=295,H=105,pL=36,pR=8,pT=7,pB=18,cW=W-pL-pR,cH=H-pT-pB
  let _cG=0,_cGoal=0
  const gPts=[],qPts=[]
  for(let i=0;i<BILLING_YTD.length;i++){
    const r=BILLING_YTD[i]; const x=pL+(i/11)*cW
    _cG+=r.gross; _cGoal+=r.goal
    if(r.gross>0) gPts.push(`${x},${pT+cH-(_cG/Math.max(_cG,_cGoal)*1.08*cH)}`)
    qPts.push(`${x},${pT+cH-(_cGoal/Math.max(_cG,_cGoal)*1.08*cH)}`)
  }
  const maxC = Math.max(_cG,_cGoal,1)*1.08
  const recalcY = v => pT+cH-(v/maxC*cH)
  const gPts2=[],qPts2=[]
  let cg2=0,cq2=0
  for(let i=0;i<BILLING_YTD.length;i++){const r=BILLING_YTD[i];const x=pL+(i/11)*cW;cg2+=r.gross;cq2+=r.goal;if(r.gross>0)gPts2.push(`${x},${recalcY(cg2)}`);qPts2.push(`${x},${recalcY(cq2)}`)}
  const yLabels=[0,Math.round(maxC*0.5),Math.round(maxC)]
  const cSvg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">${yLabels.map(v=>`<line x1="${pL}" x2="${W-pR}" y1="${recalcY(v)}" y2="${recalcY(v)}" stroke="#eceae3" stroke-width="0.5"/><text x="${pL-3}" y="${recalcY(v)+3}" text-anchor="end" font-size="8" fill="#a09c85">${fmtK(v)}</text>`).join('')}${'JFMAMJJASOND'.split('').map((m,i)=>`<text x="${pL+(i/11)*cW}" y="${H-2}" text-anchor="middle" font-size="8" fill="#a09c85">${m}</text>`).join('')}${qPts2.length?`<polyline points="${qPts2.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 3"/>`:''}${gPts2.length?`<polyline points="${gPts2.join(' ')}" fill="none" stroke="#f97316" stroke-width="2"/>`:''}${gPts2.length?`<circle cx="${gPts2[gPts2.length-1].split(',')[0]}" cy="${gPts2[gPts2.length-1].split(',')[1]}" r="3" fill="#f97316"/>`:''}  </svg>`

  // Monthly bars
  const oppMTotal = mk => activeOpps.reduce((s,o)=>s+(o.monthly?.[mk]||0)*((o.confidence||50)/100),0)
  const allBarVals = BILLING_YEAR.map(r=>(r.isPast?r.gross:(r.projFF+r.projHourly))+oppMTotal(r.mk))
  const maxBV = Math.max(...allBarVals, monthlyGoal)*1.15||1

  // YOY chart
  const availYears = Object.keys(HIST_ALL).map(Number).filter(y=>Object.values(HIST_ALL[y]).some(d=>d.g)).sort((a,b)=>b-a)
  const W2=295,H2=120,pL2=36,pR2=8,pT2=7,pB2=18,cW2=W2-pL2-pR2,cH2=H2-pT2-pB2
  const allYOY = yoyYears.flatMap(y=>Object.values(HIST_ALL[y]||{}).map(d=>d.g||0).filter(Boolean))
  const maxV2 = Math.max(...allYOY,1)*1.05
  const yS2 = v => cH2-(v/maxV2*cH2)
  const yoyLabels = [0,Math.round(maxV2*0.5),Math.round(maxV2)]

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between bg-dark text-white rounded-lg px-5 py-3">
        <div>
          <div className="font-display text-xl tracking-widest uppercase">JD+A Projections Dashboard</div>
          <div className="text-xs opacity-60 mt-0.5">{CY} · Live from tracker</div>
        </div>
        <div className="text-xs opacity-70">{new Date().toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}</div>
      </div>

      {/* Row 1: Budget + Cumulative Chart */}
      <div className="grid grid-cols-2 gap-4">

        {/* Budget card */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">
            {CY} Budget <span className="font-normal">· YTD {ytdN} months</span>
          </div>
          <div className="mb-3">
            <div className="text-2xs text-dark-3 mb-1">Annual goal</div>
            <div className="text-xl font-bold">{fmt(annualGoal)}</div>
          </div>
          <ProgressRow label="YTD FF progress" pct={pctGoal} color={goalClr}
            sub={`${fmt(ytdFF)} of ${fmt(ytdGoal)} goal YTD`} />
          <ProgressRow label="Projected full-year FF" pct={pctProj} color={projClr}
            sub={`${fmt(projFF)} projected`} />
          <div className="mt-3 pt-3 border-t border-sand-2">
            <div className="text-2xs font-bold text-dark-3 uppercase tracking-wider mb-2">Backlog</div>
            <div className="grid grid-cols-2 gap-2">
              <KPI label="What is" value={`${contractedBacklogMo.toFixed(1)} mo`} sub={`${fmtK(tR)} contracted`} color="#3b82f6" />
              <KPI label="What could be" value={`${combinedBacklogMo.toFixed(1)} mo`} sub={`${fmtK(tR+pipelineWtd)} w/ pipeline`} color="#BD6439" />
            </div>
          </div>
        </div>

        {/* Cumulative chart */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-2">
            {CY} Billing Progress <span className="font-normal">cumulative YTD</span>
          </div>
          <div dangerouslySetInnerHTML={{ __html: cSvg }} />
          <div className="flex gap-3 mt-1 text-2xs text-dark-3 flex-wrap">
            <span className="flex items-center gap-1"><span style={{borderTop:'2px dashed #3b82f6',width:14,display:'inline-block'}} /> Goal</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-orange-400" /> Gross</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-sand-2 text-center">
            <div><div className="text-sm font-bold text-orange-500">{fmt(ytdFF)}</div><div className="text-2xs text-dark-3">FF YTD</div></div>
            <div><div className="text-sm font-bold text-orange-400">{fmt(ytdGross)}</div><div className="text-2xs text-dark-3">Gross YTD</div></div>
            <div><div className="text-sm font-bold text-blue-500">{fmt(ytdGoal)}</div><div className="text-2xs text-dark-3">Goal YTD</div></div>
          </div>
        </div>
      </div>

      {/* Row 2: Monthly bars + A/R */}
      <div className="grid grid-cols-2 gap-4">

        {/* Monthly bars */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-2">
            {CY} FF + Hourly Projections <span className="font-normal">Goal: {fmt(monthlyGoal)}</span>
          </div>
          <div className="space-y-1">
            {BILLING_YEAR.map(r => {
              const v     = r.isPast ? r.gross : (r.projFF + r.projHourly)
              const oppAmt = oppMTotal(r.mk)
              if (!v && !oppAmt) return null
              const bp   = Math.min(100, v/maxBV*100)
              const bc   = r.isPast?(v>=monthlyGoal?'#2d7a3a':'#BD6439'):'#736F4C'
              const vs   = r.isPast ? v - r.goal : null
              const oppBp = Math.min(100, oppAmt/maxBV*100)
              return (
                <div key={r.mk} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 text-2xs text-dark-3">{MONTHS_SHORT[r.m-1]}</span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    {v > 0 && <div className="h-2 rounded-sm" style={{width:`${bp}%`,background:bc,opacity:r.isPast?1:0.7}} />}
                    {oppAmt > 0 && <div className="h-1.5 rounded-sm bg-terracotta/40" style={{width:`${oppBp}%`}} />}
                  </div>
                  <div className="text-right text-2xs w-20 shrink-0" style={{color:r.isPast?(v>=monthlyGoal?'#2d7a3a':'#BD6439'):'#736F4C'}}>
                    {v ? fmtK(v) : '—'}
                    {vs !== null && <span className="ml-1" style={{color:vs>=0?'#2d7a3a':'#c0392b'}}>{vs>=0?'+':''}{fmtK(vs)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-2 text-2xs text-dark-3 flex-wrap">
            <span><span className="text-success">■</span> At/above goal</span>
            <span><span className="text-terracotta">■</span> Below goal</span>
            <span><span className="text-olive">■</span> Projected</span>
          </div>
        </div>

        {/* A/R card */}
        <div className="bg-white rounded-lg border border-sand-3 p-4 cursor-pointer" onClick={() => onNavigate('ar')}>
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">
            A/R Collections <span className="text-blue-400 font-normal">↗ view all</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative shrink-0 w-20 h-20">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="#eceae3" strokeWidth="11" />
                {arSegs.map((s,i)=>(
                  <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth="11"
                    strokeDasharray={`${s.len} ${circ-s.len}`} strokeDashoffset={-s.doff+circ/4}
                    transform={`rotate(-90 ${cx} ${cy})`} />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <strong className="text-xs">{fmtK(arTot)}</strong>
                <span className="text-2xs text-dark-3">total A/R</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              {AR_BUCKETS.map(b=>{
                const amt=arB[b]||0,p=arTot>0?Math.round(amt/arTot*100):0
                return <div key={b} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{background:AR_COLORS[b]}} />
                  <span className="flex-1 text-dark-3 text-2xs">{AR_LABELS[b]}</span>
                  <span className="font-semibold text-2xs">{fmt(amt)}</span>
                  <span className="text-2xs text-dark-3">{p}%</span>
                </div>
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-sand-2">
            <div><div className="text-sm font-bold text-flag">{fmt(arPD)}</div><div className="text-2xs text-dark-3">Past due</div></div>
            <div><div className="text-sm font-bold text-success">{fmt(arB['0-30']||0)}</div><div className="text-2xs text-dark-3">Current (0–30)</div></div>
          </div>
        </div>
      </div>

      {/* Row 3: Per employee + WIP + Follow-up */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">FF Per Employee <span className="font-normal">{CY} avg/month</span></div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <KPI label="Per billable" value={fmtK(ffPB)} sub={`${billable} billable`} color="#3b82f6" />
            <KPI label="Per total staff" value={fmtK(ffPT)} sub={`${totEmp} total`} />
          </div>
          <div className="text-2xs text-dark-3">{ytdN}-month YTD average</div>
        </div>

        <div className="bg-white rounded-lg border border-sand-3 p-4 text-center">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-2">Firm WIP</div>
          <div className="text-3xl font-bold text-blue-500 leading-none my-2">{Math.round(fWIP*100)}%</div>
          <div className="text-xs text-dark-3 mb-2">billed of contracted</div>
          <div className="progress-bar mb-2">
            <div className="progress-bar-fill bg-terracotta" style={{width:Math.min(100,Math.round(fWIP*100))+'%'}} />
          </div>
          <div className="text-2xs text-dark-3">{fmt(tF)} total · {fmt(tR)} remaining</div>
        </div>

        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">Follow-up Items</div>
          <div className="space-y-2">
            <ActionCard icon="ti-flag-filled" iconColor="text-flag" label="Project flags"
              count={projFlags} onClick={() => onNavigate('followup')} />
            <ActionCard icon="ti-receipt" iconColor="text-warning" label="A/R 90+ days"
              count={ar90plus} onClick={() => onNavigate('ar')} />
            <ActionCard icon="ti-rocket" iconColor="text-terracotta" label="Pipeline opps"
              count={activeOpps.length} onClick={() => onNavigate('opportunities')} />
          </div>
        </div>
      </div>

      {/* PM table */}
      <div className="bg-white rounded-lg border border-sand-3 p-4">
        <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">
          {CY} Fees By Project Manager <span className="font-normal">· {active.filter(p=>p.pm).length} projects</span>
        </div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>PM</th><th className="text-right">Projects</th><th className="text-right">Fees</th>
              <th className="text-right">Billed</th><th className="text-right">Remaining</th>
              <th className="text-right">WIP %</th><th className="text-right">Flags</th>
              <th style={{minWidth:90}}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pmMap).sort((a,b)=>b[1].fee-a[1].fee).filter(([pm])=>pm).map(([pm,d])=>{
              const rem=d.fee-d.billed, w=d.fee>0?Math.round(d.billed/d.fee*100):0
              return <tr key={pm}>
                <td className="px-2 font-semibold text-xs">{pm}</td>
                <td className="px-2 text-right text-xs">{d.proj}</td>
                <td className="px-2 text-right text-xs">{fmt(d.fee)}</td>
                <td className="px-2 text-right text-xs">{fmt(d.billed)}</td>
                <td className="px-2 text-right text-xs text-olive">{fmt(rem)}</td>
                <td className="px-2 text-right text-xs">{w}%</td>
                <td className="px-2 text-right text-xs">{d.flags>0?<span className="text-flag font-bold">{d.flags} <i className="ti ti-flag-filled" style={{fontSize:10}} /></span>:'—'}</td>
                <td className="px-2">
                  <div className="progress-bar w-20">
                    <div className="progress-bar-fill bg-blue-400" style={{width:w+'%'}} />
                  </div>
                </td>
              </tr>
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-sand-3">
              <td className="px-2 font-bold text-xs py-1.5">Total</td>
              <td className="px-2 text-right text-xs">{active.filter(p=>p.pm).length}</td>
              <td className="px-2 text-right text-xs font-bold">{fmt(tF)}</td>
              <td className="px-2 text-right text-xs font-bold">{fmt(tB)}</td>
              <td className="px-2 text-right text-xs text-olive font-bold">{fmt(tR)}</td>
              <td className="px-2 text-right text-xs font-bold">{Math.round(fWIP*100)}%</td>
              <td className="px-2 text-right text-xs">{projFlags||'—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Row 4: Quarterly + YOY */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="text-2xs font-semibold text-olive uppercase tracking-wider mb-3">
            Quarterly Averages <span className="font-normal">{CY} gross</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[['Q1','Jan–Mar',q1v],['Q2','Apr–Jun',q2v],['Q3','Jul–Sep',null],['Q4','Oct–Dec',null]].map(([l,m,v])=>(
              <div key={l} className="bg-sand rounded p-2 text-center">
                <div className="text-2xs font-semibold text-dark-3 mb-1">{l}</div>
                <div className="text-sm font-bold" style={{color:v?(v>=monthlyGoal?'#2d7a3a':'#b45309'):'#a09c85'}}>
                  {v?fmtK(v):'—'}
                </div>
                <div className="text-2xs text-dark-3 mt-0.5">{m}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-sand-2">
            <div><div className="text-sm font-bold">{fmtK(ytdAvg)}</div><div className="text-2xs text-dark-3">{CY} avg</div></div>
            <div><div className="text-sm font-bold text-dark-3">{fmtK(prev1avg)}</div><div className="text-2xs text-dark-3">{CY-1} avg</div></div>
            <div><div className="text-sm font-bold text-dark-3">{fmtK(prev2avg)}</div><div className="text-2xs text-dark-3">{CY-2} avg</div></div>
          </div>
        </div>

        {/* YOY */}
        <div className="bg-white rounded-lg border border-sand-3 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xs font-semibold text-olive uppercase tracking-wider">
              Year-over-Year <span className="font-normal">{yoyYears.join(' · ')}</span>
            </div>
            <button onClick={() => setYoyOpen(p=>!p)} className="btn btn-sm text-2xs">
              <i className={clsx('ti', yoyOpen?'ti-chevron-up':'ti-chevron-down')} />
            </button>
          </div>
          {yoyOpen && (
            <div className="mb-3">
              <div className="text-2xs text-dark-3 mb-2">Select up to 3 years:</div>
              <div className="flex flex-wrap gap-1">
                {availYears.map(y=>(
                  <button key={y} onClick={()=>{
                    setYoyYears(prev=>prev.includes(y)?prev.filter(x=>x!==y):prev.length<3?[...prev,y].sort((a,b)=>b-a):prev)
                  }} className={clsx('text-2xs px-2 py-0.5 rounded border',yoyYears.includes(y)?'bg-terracotta text-white border-terracotta':'border-sand-3')}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}
          <svg width={W2} height={H2} viewBox={`0 0 ${W2} ${H2}`} style={{overflow:'visible'}}>
            {yoyLabels.map(v=>(
              <g key={v}>
                <line x1={pL2} x2={W2-pR2} y1={pT2+yS2(v)} y2={pT2+yS2(v)} stroke="#eceae3" strokeWidth="0.5" />
                <text x={pL2-3} y={pT2+yS2(v)+3} textAnchor="end" fontSize="8" fill="#a09c85">{fmtK(v)}</text>
              </g>
            ))}
            {'JFMAMJJASOND'.split('').map((m,i)=>(
              <text key={i} x={pL2+(i/11)*cW2} y={H2-2} textAnchor="middle" fontSize="8" fill="#a09c85">{m}</text>
            ))}
            {yoyYears.map((y,yi)=>{
              const yd = HIST_ALL[y]||{}
              const data = y===CY
                ? Array.from({length:CM-1},(_,i)=>({i,v:mTotalAll(`${CY}-${String(i+1).padStart(2,'0')}`,projects)})).filter(d=>d.v>0)
                : Object.entries(yd).map(([m,d])=>({i:+m-1,v:d.g||0})).filter(d=>d.v)
              if(!data.length) return null
              const pts=data.map(d=>`${pL2+(d.i/11)*cW2},${pT2+yS2(d.v)}`).join(' ')
              return (
                <g key={y}>
                  <polyline points={pts} fill="none" stroke={YOY_COLORS[yi]} strokeWidth={yi===0?2.5:1.5} strokeDasharray={yi>0?'4 3':undefined} opacity={yi>1?0.7:1} />
                  {data.map(d=><circle key={d.i} cx={pL2+(d.i/11)*cW2} cy={pT2+yS2(d.v)} r="2" fill={YOY_COLORS[yi]} />)}
                </g>
              )
            })}
          </svg>
          <div className="flex gap-3 mt-1 flex-wrap">
            {yoyYears.map((y,i)=>(
              <span key={y} className="flex items-center gap-1 text-2xs text-dark-3">
                <span className="inline-block w-3 h-0.5" style={{background:YOY_COLORS[i]}} /> {y}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function ProgressRow({ label, pct, color, sub }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-dark-3">{label}</span>
        <span className="font-bold" style={{color}}>{pct}%</span>
      </div>
      <div className="progress-bar mb-1">
        <div className="progress-bar-fill" style={{width:Math.min(100,pct)+'%',background:color}} />
      </div>
      <div className="text-2xs text-dark-3">{sub}</div>
    </div>
  )
}

function KPI({ label, value, sub, color }) {
  return (
    <div className="bg-sand rounded p-2 border border-sand-3">
      <div className="text-2xs text-dark-3 mb-1">{label}</div>
      <div className="text-sm font-bold" style={{color:color||'#3D3935'}}>{value}</div>
      {sub && <div className="text-2xs text-dark-3 mt-0.5">{sub}</div>}
    </div>
  )
}

function ActionCard({ icon, iconColor, label, count, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-between w-full bg-sand rounded p-2 border border-sand-2 hover:border-sand-3 transition-colors">
      <div className="flex items-center gap-2">
        <i className={clsx('ti', icon, iconColor, 'text-sm')} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-lg font-bold" style={{color:'inherit'}}>{count}</span>
        <i className="ti ti-arrow-right text-2xs opacity-40" />
      </div>
    </button>
  )
}
