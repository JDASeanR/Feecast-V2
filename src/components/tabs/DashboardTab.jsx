import { useState, useRef, useEffect } from 'react'
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
const AR_COLORS  = {'0-30':'#736F4C','30-60':'#BD6439','60-90':'#9a4f2c','90-120':'#3D3935','120+':'#1a1816'}
const AR_LABELS  = {'0-30':'Current','30-60':'30–60d','60-90':'60–90d','90-120':'90–120d','120+':'120+d'}
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const phCAEst = ph => ph.scope==='CA'?(ph.fee||0)*(ph.caMonths||12):0
const phFeeFC = ph => ph.scope==='CA'?phCAEst(ph):(ph.fee||0)
function phYTD(ph) { let s=0; for(let m=1;m<CM;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;s+=ph.monthly?.[mk]||0;} return s; }
const pFee = p => (p.phases||[]).reduce((s,ph)=>s+phFeeFC(ph),0)
const pBil = p => (p.phases||[]).reduce((s,ph)=>s+(ph.billed||0),0)
const pRem = p => pFee(p)-pBil(p)-(p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0)

function mTotalAll(mk, projects) {
  return projects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}
function mTotal(mk, projects) {
  return projects.filter(p=>!p.archived).reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

// ── Popover ───────────────────────────────────────────────────────────────────
function Popover({ trigger, title, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(p=>!p)}>{trigger}</div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:100,
          background:'#F5F5F1', border:'1px solid rgba(61,57,53,0.15)',
          borderRadius:6, padding:'20px 24px', minWidth:380,
          boxShadow:'0 8px 32px rgba(61,57,53,0.14)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:15, letterSpacing:'0.06em', textTransform:'uppercase', color:'#3D3935' }}>{title}</div>
            <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', color:'#736F4C', cursor:'pointer', fontSize:14 }}>✕</button>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardTab({ appState, onNavigate }) {
  const { projects, invoices, opportunities, settings } = appState
  const hourlyData  = settings.billing?.hourlyByMonth || {}
  const monthlyGoal = settings.billing?.monthlyGoal || 395000
  const annualGoal  = settings.billing?.annualGoal || 4740000
  const billable    = settings.employees?.billable || 12
  const totEmp      = settings.employees?.total || 17

  const active     = projects.filter(p=>!p.archived)
  const activeOpps = opportunities.filter(o=>!o.archived&&o.status!=='04 Won'&&o.status!=='05 Lost')
  const openAR     = invoices.filter(i=>!i.paid&&(i.amount||0)>0)

  const BILLING_YTD = []
  for (let m=1; m<CM; m++) {
    const mk = `${CY}-${String(m).padStart(2,'0')}`
    const ff = mTotalAll(mk, projects), hourly = hourlyData[mk]||0
    BILLING_YTD.push({ m, mk, ff, hourly, gross:ff+hourly, goal:monthlyGoal })
  }
  const BILLING_YEAR = []
  for (let m=1; m<=12; m++) {
    const mk = `${CY}-${String(m).padStart(2,'0')}`
    const isPast = m < CM
    const ff = isPast?mTotalAll(mk,projects):0, hourly=isPast?(hourlyData[mk]||0):0
    const projFF=!isPast?mTotal(mk,projects):0, projHourly=!isPast?(hourlyData[mk]||0):0
    BILLING_YEAR.push({ m, mk, ff, hourly, gross:ff+hourly, goal:monthlyGoal, isPast, projFF, projHourly })
  }

  const ytdFF     = BILLING_YTD.reduce((s,r)=>s+r.ff,0)
  const ytdHourly = BILLING_YTD.reduce((s,r)=>s+r.hourly,0)
  const ytdGross  = BILLING_YTD.reduce((s,r)=>s+r.gross,0)
  const ytdGoal   = BILLING_YTD.reduce((s,r)=>s+r.goal,0)
  const ytdN      = BILLING_YTD.length

  const tF   = active.reduce((s,p)=>s+pFee(p),0)
  const tB   = active.reduce((s,p)=>s+pBil(p),0)
  const tYTD = Array.from({length:CM-1},(_,i)=>mTotalAll(`${CY}-${String(i+1).padStart(2,'0')}`,projects)).reduce((s,v)=>s+v,0)
  const tR   = tF-tB-tYTD
  const fWIP = tF>0?(tB+tYTD)/tF:0

  let futureFF = 0
  for(let m=CM;m<=12;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;futureFF+=mTotal(mk,projects)+(hourlyData[mk]||0);}
  const projFF = ytdFF+ytdHourly+futureFF

  const pipelineWtd = activeOpps.reduce((s,o)=>s+(o.fee||0)*((o.confidence||50)/100),0)
  const contractedBkMo = monthlyGoal>0?tR/monthlyGoal:0
  const combinedBkMo   = monthlyGoal>0?(tR+pipelineWtd)/monthlyGoal:0
  const ffPB = ytdN?ytdFF/ytdN/billable:0
  const ffPT = ytdN?ytdFF/ytdN/totEmp:0

  const arB = {}; AR_BUCKETS.forEach(b=>{arB[b]=0})
  openAR.forEach(i=>{const b=effBucket(i);arB[b]=(arB[b]||0)+(i.amount||0)})
  const arTot    = Object.values(arB).reduce((s,v)=>s+v,0)
  const arPD     = arTot-(arB['0-30']||0)
  const ar90plus = openAR.filter(i=>['90-120','120+'].includes(effBucket(i))).length
  const projFlags = active.filter(p=>p.flag||p.phases.some(ph=>ph.flag)).length

  const pctGoal = ytdGoal>0?Math.round(ytdGross/ytdGoal*100):0
  const pctProj = annualGoal>0?Math.round(projFF/annualGoal*100):0

  const oppMTotal = mk => activeOpps.reduce((s,o)=>s+(o.monthly?.[mk]||0)*((o.confidence||50)/100),0)
  const allBarVals = BILLING_YEAR.map(r=>(r.isPast?r.gross:(r.projFF+r.projHourly))+oppMTotal(r.mk))
  const maxBV = Math.max(...allBarVals, monthlyGoal)*1.15||1

  const Q1=BILLING_YTD.filter(r=>r.m<=3&&r.gross>0), Q2=BILLING_YTD.filter(r=>r.m>=4&&r.m<=6&&r.gross>0)
  const q1v=Q1.length?Q1.reduce((s,r)=>s+r.gross,0)/Q1.length:null
  const q2v=Q2.length?Q2.reduce((s,r)=>s+r.gross,0)/Q2.length:null
  const ytdAvg=ytdN?ytdGross/ytdN:0
  const prev1avg=Object.values(HIST_ALL[CY-1]||{}).reduce((s,d)=>s+(d.g||0),0)/12
  const prev2avg=Object.values(HIST_ALL[CY-2]||{}).reduce((s,d)=>s+(d.g||0),0)/12

  const [yoyYears,setYoyYears] = useState([CY,CY-1,CY-2])
  const availYears = Object.keys(HIST_ALL).map(Number).filter(y=>Object.values(HIST_ALL[y]).some(d=>d.g)).sort((a,b)=>b-a)
  const YOY_COLORS = ['#BD6439','#736F4C','#3D3935']
  const dateStr = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})

  return (
    <div style={{ background:'#F5F5F1', padding:14, display:'flex', flexDirection:'column', gap:10, height:'100%', overflow:'hidden' }}>

      {/* ── Hero ── */}
      <div style={{ background:'#3D3935', borderRadius:6, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:20, letterSpacing:'0.04em', textTransform:'uppercase', color:'#F5F5F1', lineHeight:1 }}>JD+A Projections Dashboard</div>
          <div style={{ fontSize:10, color:'rgba(245,245,241,0.45)', marginTop:3 }}>{CY} · Live from tracker</div>
        </div>
        <div style={{ display:'flex', gap:28, alignItems:'center' }}>
          <HeroKPI label={`Billed YTD (${ytdN} mo)`} value={fmtK(ytdGross)} sub={`${pctGoal}% of ${fmtK(ytdGoal)} goal`} accent={pctGoal>=100} />
          <Sep /><HeroKPI label="Projected Full Year" value={fmtK(projFF)} sub={`${pctProj}% of ${fmtK(annualGoal)} goal`} accent={pctProj>=100} />
          <Sep /><HeroKPI label="Firm WIP" value={Math.round(fWIP*100)+'%'} sub={`${fmtK(tB+tYTD)} of ${fmtK(tF)}`} />
          <Sep /><HeroKPI label="Backlog" value={`${contractedBkMo.toFixed(1)} mo`} sub={`${fmtK(tR)} contracted · ${fmtK(tR+pipelineWtd)} w/ pipeline`} />
        </div>
        <div style={{ fontSize:10, color:'rgba(245,245,241,0.35)' }}>{dateStr}</div>
      </div>

      {/* ── Signal strip ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8, flexShrink:0 }}>
        <SignalCard label="A/R Past Due" value={fmtK(arPD)} sub={`of ${fmtK(arTot)} total A/R`} warn={arPD>0} onClick={()=>onNavigate('ar')} />
        <SignalCard label="A/R 90+ Days" value={ar90plus} sub="invoices overdue" warn={ar90plus>0} onClick={()=>onNavigate('ar')} />
        <SignalCard label="Pipeline (wtd)" value={fmtK(pipelineWtd)} sub={`${activeOpps.length} active opportunities`} accent onClick={()=>onNavigate('opportunities')} />
        <SignalCard label="Project Flags" value={projFlags} sub="projects flagged" warn={projFlags>0} onClick={()=>onNavigate('followup')} />

        {/* More stats */}
        <div style={{ background:'#ECEAE3', borderRadius:5, border:'1px solid rgba(61,57,53,0.1)', borderTop:'2px solid #BD6439', padding:'10px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative' }}>
          <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#736F4C', marginBottom:10 }}>More Stats</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { icon:'ti-chart-line', label:'Year-over-Year', title:'Year-over-Year', content: <YOYChart years={yoyYears} setYears={setYoyYears} availYears={availYears} colors={YOY_COLORS} projects={projects} /> },
              { icon:'ti-users', label:'FF Per Employee', title:'FF Per Employee', content: (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <StatBox label={`Per billable (${billable})`} value={fmtK(ffPB)} sub={`${ytdN}-mo YTD avg`} />
                  <StatBox label={`Per total (${totEmp})`} value={fmtK(ffPT)} sub={`${ytdN}-mo YTD avg`} />
                </div>
              )},
              { icon:'ti-calendar-stats', label:'Quarterly Avgs', title:'Quarterly Averages', content: (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                    {[['Q1','Jan–Mar',q1v],['Q2','Apr–Jun',q2v],['Q3','Jul–Sep',null],['Q4','Oct–Dec',null]].map(([l,m,v])=>(
                      <div key={l} style={{ background:'#ECEAE3', borderRadius:4, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#736F4C', marginBottom:3 }}>{l}</div>
                        <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:18, color:v?(v>=monthlyGoal?'#736F4C':'#BD6439'):'#b0aca0' }}>{v?fmtK(v):'—'}</div>
                        <div style={{ fontSize:10, color:'#736F4C', marginTop:2 }}>{m}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, borderTop:'1px solid rgba(61,57,53,0.1)', paddingTop:12 }}>
                    <StatBox label={`${CY} avg`} value={fmtK(ytdAvg)} />
                    <StatBox label={`${CY-1} avg`} value={fmtK(prev1avg)} muted />
                    <StatBox label={`${CY-2} avg`} value={fmtK(prev2avg)} muted />
                  </div>
                </div>
              )},
            ].map(({icon,label,title,content})=>(
              <Popover key={label} title={title} trigger={
                <button style={{ fontSize:12, color:'#BD6439', background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
                  <i className={`ti ${icon}`} style={{fontSize:13}} /> {label} <span style={{opacity:0.5,fontSize:11}}>↗</span>
                </button>
              }>{content}</Popover>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content: bar chart + A/R ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:10, flex:1, minHeight:0 }}>

        {/* Monthly bars */}
        <div style={{ background:'#F5F5F1', borderRadius:5, border:'1px solid rgba(61,57,53,0.1)', padding:'14px 16px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10, flexShrink:0 }}>
            <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#736F4C' }}>{CY} Monthly Projections</div>
            <div style={{ fontSize:10, color:'#736F4C' }}>Goal: {fmtK(monthlyGoal)}/mo</div>
          </div>

          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
            {BILLING_YEAR.map(r => {
              const v = r.isPast ? r.gross : (r.projFF + r.projHourly)
              const oppAmt = oppMTotal(r.mk)
              const bp  = Math.min(100, v/maxBV*100)
              const opp = Math.min(100, oppAmt/maxBV*100)
              const goalLine = Math.min(100, monthlyGoal/maxBV*100)
              const bc  = r.isPast ? (v>=monthlyGoal?'#736F4C':'#BD6439') : 'rgba(115,111,76,0.4)'
              const vs  = r.isPast ? v - r.goal : null
              return (
                <div key={r.mk} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:26, fontSize:10, color:'#736F4C', flexShrink:0, letterSpacing:'0.03em' }}>{MONTHS_SHORT[r.m-1]}</div>
                  <div style={{ flex:1, position:'relative' }}>
                    <div style={{ position:'absolute', left:`${goalLine}%`, top:0, bottom:0, width:1, background:'rgba(61,57,53,0.18)', zIndex:1 }} />
                    <div style={{ height:11, background:'rgba(61,57,53,0.05)', borderRadius:3, position:'relative', overflow:'hidden' }}>
                      {v>0 && <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${bp}%`, background:bc, borderRadius:3 }} />}
                      {oppAmt>0 && <div style={{ position:'absolute', left:`${bp}%`, top:0, height:'100%', width:`${Math.min(100-bp,opp)}%`, background:'rgba(189,100,57,0.22)', borderRadius:3 }} />}
                    </div>
                  </div>
                  <div style={{ width:148, flexShrink:0, display:'flex', alignItems:'baseline', gap:6, justifyContent:'flex-end' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:r.isPast?(v>=monthlyGoal?'#736F4C':'#BD6439'):'#736F4C' }}>
                      {v ? fmtK(v) : '—'}
                    </span>
                    {vs!==null && <span style={{ fontSize:10, color:vs>=0?'#736F4C':'#BD6439' }}>{vs>=0?'+':''}{fmtK(vs)}</span>}
                    {oppAmt>0 && <span style={{ fontSize:10, color:'rgba(189,100,57,0.65)' }}>+{fmtK(oppAmt)}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', gap:16, marginTop:10, paddingTop:8, borderTop:'1px solid rgba(61,57,53,0.08)', flexShrink:0 }}>
            {[['#736F4C','At/above goal'],['#BD6439','Below goal'],['rgba(115,111,76,0.4)','Projected'],['rgba(189,100,57,0.22)','Pipeline']].map(([c,l])=>(
              <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#736F4C' }}>
                <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block', flexShrink:0 }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* A/R */}
        <div style={{ background:'#F5F5F1', borderRadius:5, border:'1px solid rgba(61,57,53,0.1)', padding:'14px 16px', cursor:'pointer', display:'flex', flexDirection:'column' }} onClick={()=>onNavigate('ar')}>
          <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#736F4C', marginBottom:10, flexShrink:0 }}>
            A/R Collections <span style={{ color:'#BD6439' }}>↗</span>
          </div>

          <div style={{ marginBottom:14, flexShrink:0 }}>
            <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:34, letterSpacing:'0.02em', color:'#3D3935', lineHeight:1 }}>{fmtK(arTot)}</div>
            <div style={{ fontSize:11, color:'#736F4C', marginTop:3 }}>total outstanding</div>
          </div>

          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
            {AR_BUCKETS.map(b => {
              const amt = arB[b]||0, pct = arTot>0?Math.round(amt/arTot*100):0
              return (
                <div key={b}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#736F4C', marginBottom:3 }}>
                    <span>{AR_LABELS[b]}</span>
                    <span><span style={{ fontWeight:600, color:'#3D3935' }}>{fmt(amt)}</span> <span style={{ color:'#736F4C' }}>{pct}%</span></span>
                  </div>
                  <div style={{ height:5, background:'rgba(61,57,53,0.07)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:AR_COLORS[b], borderRadius:3 }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:14, paddingTop:12, borderTop:'1px solid rgba(61,57,53,0.1)', flexShrink:0 }}>
            <div>
              <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:20, color:'#BD6439', lineHeight:1 }}>{fmtK(arPD)}</div>
              <div style={{ fontSize:10, color:'#736F4C', marginTop:3 }}>Past due</div>
            </div>
            <div>
              <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:20, color:'#736F4C', lineHeight:1 }}>{fmtK(arB['0-30']||0)}</div>
              <div style={{ fontSize:10, color:'#736F4C', marginTop:3 }}>Current (0–30)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const Sep = () => <div style={{ width:1, height:36, background:'rgba(245,245,241,0.12)', flexShrink:0 }} />

function HeroKPI({ label, value, sub, accent }) {
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(245,245,241,0.45)', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:28, letterSpacing:'0.02em', color:accent?'#BD6439':'#F5F5F1', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10, color:'rgba(245,245,241,0.38)', marginTop:3 }}>{sub}</div>
    </div>
  )
}

function SignalCard({ label, value, sub, warn, accent, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'#ECEAE3', borderRadius:5,
      border:'1px solid rgba(61,57,53,0.1)',
      borderTop: '2px solid #BD6439',
      padding:'10px 14px', cursor:onClick?'pointer':'default',
    }}>
      <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#736F4C', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:28, letterSpacing:'0.02em', lineHeight:1, color:warn?'#BD6439':accent?'#BD6439':'#3D3935' }}>{value}</div>
      <div style={{ fontSize:10, color:'#736F4C', marginTop:6 }}>{sub}</div>
    </div>
  )
}

function StatBox({ label, value, sub, muted }) {
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#736F4C', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:20, color:muted?'#736F4C':'#3D3935' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#736F4C', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function YOYChart({ years, setYears, availYears, colors, projects }) {
  const W=400,H=160,pL=36,pR=8,pT=8,pB=20,cW=W-pL-pR,cH=H-pT-pB
  const allVals = years.flatMap(y=>Object.values(HIST_ALL[y]||{}).map(d=>d.g||0).filter(Boolean))
  const maxV = Math.max(...allVals,1)*1.05
  const yS = v => cH-(v/maxV*cH)
  const yLabels = [0,Math.round(maxV*0.5),Math.round(maxV)]
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
        {availYears.slice(0,10).map(y=>(
          <button key={y} onClick={()=>setYears(prev=>prev.includes(y)?prev.filter(x=>x!==y):prev.length<3?[...prev,y].sort((a,b)=>b-a):prev)}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:3, border:'1px solid', cursor:'pointer', fontFamily:'inherit',
              background:years.includes(y)?'#3D3935':'transparent', color:years.includes(y)?'#F5F5F1':'#736F4C',
              borderColor:years.includes(y)?'#3D3935':'rgba(61,57,53,0.2)' }}>
            {y}
          </button>
        ))}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible',display:'block'}}>
        {yLabels.map(v=>(
          <g key={v}>
            <line x1={pL} x2={W-pR} y1={pT+yS(v)} y2={pT+yS(v)} stroke="#ECEAE3" strokeWidth="0.5"/>
            <text x={pL-3} y={pT+yS(v)+3} textAnchor="end" fontSize="8" fill="#a09c85">{fmtK(v)}</text>
          </g>
        ))}
        {'JFMAMJJASOND'.split('').map((m,i)=>(
          <text key={i} x={pL+(i/11)*cW} y={H-2} textAnchor="middle" fontSize="8" fill="#a09c85">{m}</text>
        ))}
        {years.map((y,yi)=>{
          const _CY=new Date().getFullYear(), _CM=new Date().getMonth()+1
          const data = y===_CY
            ? Array.from({length:_CM-1},(_,i)=>({i,v:mTotalAll(`${_CY}-${String(i+1).padStart(2,'0')}`,projects)})).filter(d=>d.v>0)
            : Object.entries(HIST_ALL[y]||{}).map(([m,d])=>({i:+m-1,v:d.g||0})).filter(d=>d.v)
          if(!data.length)return null
          const pts=data.map(d=>`${pL+(d.i/11)*cW},${pT+yS(d.v)}`).join(' ')
          return (
            <g key={y}>
              <polyline points={pts} fill="none" stroke={colors[yi]} strokeWidth={yi===0?2:1.5} strokeDasharray={yi>0?'4 3':undefined} opacity={yi>1?0.7:1}/>
              {data.map(d=><circle key={d.i} cx={pL+(d.i/11)*cW} cy={pT+yS(d.v)} r="2" fill={colors[yi]}/>)}
            </g>
          )
        })}
      </svg>
      <div style={{ display:'flex', gap:16, marginTop:8 }}>
        {years.map((y,i)=>(
          <span key={y} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#736F4C' }}>
            <span style={{ width:14, height:2, background:colors[i], display:'inline-block' }}/> {y}
          </span>
        ))}
      </div>
    </div>
  )
}
