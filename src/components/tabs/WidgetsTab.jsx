import { useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import { fmtK, fmt } from '../../lib/utils'

const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const HIST_ALL = {
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

const GOAL_BY_YEAR = {
  2016:395000,2017:395000,2018:540000,2019:540000,2020:395000,2021:395000,
  2022:420000,2023:395000,2024:330000,2025:395000,2026:395000,
}

function mTotal(mk, projects) {
  return projects.filter(p=>!p.archived).reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

const TYPE_COLORS = {
  CA:'#4472C4', COM:'#C0392B', CODE:'#E67E22', MF:'#27AE60',
  SL:'#8E44AD', PLN:'#D4AC0D', SFD:'#5DADE2', DRP:'#E74C3C',
  OA:'#95A5A6', OTHER:'#E88B8B',
}

const PM_COLORS = [
  '#8B0000','#C0392B','#E67E22','#27AE60','#8E44AD','#D4AC0D','#1A3A5C','#E88B8B',
  '#2ECC71','#3498DB','#E74C3C','#9B59B6',
]

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ title, kpis, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 6, border: '1px solid rgba(61,57,53,0.08)', overflow: 'hidden' }}>
      <div style={{
        background: '#3D3935', padding: '10px 20px',
        fontFamily: '"League Gothic",sans-serif', fontSize: 14,
        letterSpacing: '0.06em', color: '#F5F5F1', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{title}</span>
        {kpis && (
          <div style={{ display: 'flex', gap: 24 }}>
            {kpis.map((k, i) => (
              <span key={i} style={{ fontSize: 12, fontFamily: '"Nunito Sans",sans-serif', letterSpacing: 0 }}>
                <span style={{ color: 'rgba(245,245,241,0.5)', marginRight: 6, textTransform: 'none' }}>{k.label}</span>
                <span style={{ color: k.color || '#F5F5F1', fontWeight: 700 }}>{k.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '24px 20px 16px' }}>{children}</div>
    </div>
  )
}

// ── D3 hook ──────────────────────────────────────────────────────────────────
function useD3(renderFn, deps) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    renderFn(svg, ref.current)
  }, deps)
  return ref
}

// ── WSJ-style hover crosshair ────────────────────────────────────────────────
function addCrosshair(g, x, y, h, w, data, xAccessor, series, formatX) {
  const overlay = g.append('rect').attr('width', w).attr('height', h).attr('fill', 'none').attr('pointer-events', 'all')
  const crosshair = g.append('line').attr('y1', 0).attr('y2', h).attr('stroke', '#3D3935').attr('stroke-width', 0.5).attr('stroke-dasharray', '3 2').style('opacity', 0)
  const tooltip = g.append('g').style('opacity', 0)
  const tooltipBg = tooltip.append('rect').attr('rx', 4).attr('fill', '#3D3935').attr('fill-opacity', 0.92)
  const tooltipText = tooltip.append('g')

  overlay.on('mousemove', function(event) {
    const [mx] = d3.pointer(event)
    const xVal = x.invert(mx)
    const bisect = d3.bisector(xAccessor).left
    const idx = Math.min(data.length - 1, Math.max(0, bisect(data, xVal) - (bisect(data, xVal) > 0 ? 0 : 0)))
    const closest = data[idx] || data[0]
    const cx = x(xAccessor(closest))

    crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1)

    tooltipText.selectAll('*').remove()
    const header = formatX(closest)
    tooltipText.append('text').attr('x', 10).attr('y', 16).text(header)
      .style('font-size', '11px').style('fill', '#F5F5F1').style('font-weight', 700)

    series.forEach((s, i) => {
      const val = s.accessor(closest)
      if (val == null) return
      const row = tooltipText.append('g').attr('transform', `translate(10,${32 + i * 16})`)
      row.append('circle').attr('r', 3).attr('cy', -3).attr('fill', s.color)
      row.append('text').attr('x', 10).attr('y', 0).text(`${s.label}: ${fmt(val)}`)
        .style('font-size', '10px').style('fill', 'rgba(245,245,241,0.8)')
    })

    const rows = series.filter(s => s.accessor(closest) != null).length
    const bw = 180, bh = 24 + rows * 16 + 4
    tooltipBg.attr('width', bw).attr('height', bh)

    let tx = cx + 12
    if (tx + bw > w) tx = cx - bw - 12
    tooltip.attr('transform', `translate(${tx},${10})`).style('opacity', 1)

    series.forEach(s => {
      const val = s.accessor(closest)
      if (val == null) return
      g.selectAll(`.dot-${s.key}`).remove()
      g.append('circle').attr('class', `dot-${s.key}`).attr('cx', cx).attr('cy', y(val)).attr('r', 4)
        .attr('fill', s.color).attr('stroke', '#fff').attr('stroke-width', 1.5)
    })
  })
  .on('mouseleave', function() {
    crosshair.style('opacity', 0)
    tooltip.style('opacity', 0)
    series.forEach(s => g.selectAll(`.dot-${s.key}`).remove())
  })
}

// ── Shared axis styling ──────────────────────────────────────────────────────
function styleAxes(g) {
  g.selectAll('.domain').remove()
  g.selectAll('.tick line').attr('stroke', '#ECEAE3').attr('stroke-width', 0.5)
  g.selectAll('.tick text').style('font-size', '10px').style('fill', '#736F4C').style('font-family', '"Nunito Sans",sans-serif')
}
function addGridlines(g, y, w, ticks) {
  g.append('g').selectAll('line').data(y.ticks(ticks)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', '#ECEAE3').attr('stroke-width', 0.5)
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. BILLING PROGRESS
// ══════════════════════════════════════════════════════════════════════════════
function BillingProgressChart({ projects, hourlyData, monthlyGoal }) {
  const data = []
  for (let mo = 1; mo <= 12; mo++) {
    const mk = `${CY}-${String(mo).padStart(2,'0')}`
    const ff = mTotal(mk, projects), hourly = hourlyData[mk] || 0
    data.push({ mo, label: MONTHS[mo-1], ff, gross: ff + hourly, goal: monthlyGoal })
  }
  const ytdFF = data.filter(d=>d.mo<CM).reduce((s,d)=>s+d.ff,0)

  const ref = useD3((svg, el) => {
    const W = el.clientWidth, H = 320
    const m = { top: 10, right: 130, bottom: 36, left: 64 }
    const w = W-m.left-m.right, h = H-m.top-m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const x = d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY = Math.max(monthlyGoal*1.15, d3.max(data,d=>d.gross)*1.15) || 1
    const y = d3.scaleLinear().domain([0,maxY]).range([h,0])

    addGridlines(g, y, w, 6)

    const area = (acc,color) => {
      g.append('path').datum(data).attr('d', d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(acc(d))).curve(d3.curveMonotoneX)).attr('fill',color)
    }
    area(d=>d.goal, 'rgba(70,130,210,0.08)')
    area(d=>d.gross, 'rgba(230,180,60,0.12)')
    area(d=>d.ff, 'rgba(192,57,43,0.12)')

    const ln = (acc,color,sw,dash) => {
      g.append('path').datum(data).attr('d', d3.line().x(d=>x(d.mo)).y(d=>y(acc(d))).curve(d3.curveMonotoneX))
        .attr('fill','none').attr('stroke',color).attr('stroke-width',sw)
      if (dash) g.select('path:last-child').attr('stroke-dasharray', dash)
    }
    ln(d=>d.goal,'#4472C4',2.5)
    ln(d=>d.ff,'#C0392B',2)
    ln(d=>d.gross,'#E6A800',1.5,'5 3')

    data.forEach(d => g.append('circle').attr('cx',x(d.mo)).attr('cy',y(d.goal)).attr('r',3).attr('fill','#4472C4').attr('stroke','#fff').attr('stroke-width',1))

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2))).call(styleAxes)
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(fmtK)).call(styleAxes)

    addCrosshair(g, x, y, h, w, data, d=>d.mo,
      [{key:'goal',label:'Goal',color:'#4472C4',accessor:d=>d.goal},{key:'ff',label:'FF',color:'#C0392B',accessor:d=>d.ff},{key:'gross',label:'Gross',color:'#E6A800',accessor:d=>d.gross}],
      d => d.label + ' ' + CY
    )

    const leg = svg.append('g').attr('transform',`translate(${W-110},${m.top+20})`)
    ;[{l:'Goal',c:'#4472C4'},{l:'Fixed Fee',c:'#C0392B'},{l:'Gross',c:'#E6A800'}].forEach((s,i)=>{
      const r=leg.append('g').attr('transform',`translate(0,${i*20})`)
      r.append('line').attr('x1',0).attr('x2',16).attr('y',0).attr('stroke',s.c).attr('stroke-width',2)
      r.append('text').attr('x',22).attr('y',4).text(s.l).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, hourlyData, monthlyGoal])

  return (
    <ChartCard title={`${CY} Billing Progress`} kpis={[
      {label:'YTD FF', value:fmtK(ytdFF), color:'#C0392B'},
      {label:'Monthly Goal', value:fmtK(monthlyGoal), color:'#4472C4'},
    ]}>
      <svg ref={ref} style={{width:'100%',height:320}} />
    </ChartCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. PROJECTIONS BY TYPE
// ══════════════════════════════════════════════════════════════════════════════
function ProjectionsByTypeChart({ projects }) {
  const ref = useD3((svg, el) => {
    const W = el.clientWidth, H = 300
    const m = { top: 10, right: 130, bottom: 36, left: 64 }
    const w = W-m.left-m.right, h = H-m.top-m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const typeCodes = [...new Set(projects.filter(p=>!p.archived).flatMap(p => p.phases.map(ph => ph.scope || p.type || 'OTHER')))]
    const data = []
    for (let mo=1;mo<=12;mo++) {
      const mk=`${CY}-${String(mo).padStart(2,'0')}`
      const row={mo,label:MONTHS[mo-1]}
      typeCodes.forEach(t=>{row[t]=0})
      projects.filter(p=>!p.archived).forEach(p=>p.phases.forEach(ph=>{const t=ph.scope||p.type||'OTHER';row[t]=(row[t]||0)+(ph.monthly?.[mk]||0)}))
      data.push(row)
    }
    const active = typeCodes.filter(t=>data.some(d=>(d[t]||0)>0))

    const x = d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY = d3.max(data,d=>active.reduce((s,t)=>s+(d[t]||0),0))*1.15||1
    const y = d3.scaleLinear().domain([0,maxY]).range([h,0])
    addGridlines(g,y,w,5)

    active.forEach(t=>{
      const c=TYPE_COLORS[t]||'#999'
      g.append('path').datum(data).attr('d',d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d[t]||0)).curve(d3.curveBasis)).attr('fill',c).attr('fill-opacity',0.18)
      g.append('path').datum(data).attr('d',d3.line().x(d=>x(d.mo)).y(d=>y(d[t]||0)).curve(d3.curveBasis)).attr('fill','none').attr('stroke',c).attr('stroke-width',1.5)
    })

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2))).call(styleAxes)
    g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(fmtK)).call(styleAxes)

    addCrosshair(g,x,y,h,w,data,d=>d.mo,
      active.map(t=>({key:t,label:t,color:TYPE_COLORS[t]||'#999',accessor:d=>d[t]||0})),
      d=>d.label+' '+CY
    )

    const leg=svg.append('g').attr('transform',`translate(${W-110},${m.top+5})`)
    active.forEach((t,i)=>{
      const r=leg.append('g').attr('transform',`translate(0,${i*17})`)
      r.append('circle').attr('r',4).attr('fill',TYPE_COLORS[t]||'#999')
      r.append('text').attr('x',12).attr('y',4).text(t).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects])
  return (
    <ChartCard title={`${CY} Projections by Project Type`}>
      <svg ref={ref} style={{width:'100%',height:300}} />
    </ChartCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. FEES BY PM
// ══════════════════════════════════════════════════════════════════════════════
function FeesByPMChart({ projects }) {
  const ref = useD3((svg, el) => {
    const W = el.clientWidth, H = 300
    const m = { top: 10, right: 110, bottom: 36, left: 64 }
    const w = W-m.left-m.right, h = H-m.top-m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const pmNames=[...new Set(projects.filter(p=>!p.archived).map(p=>p.pm).filter(Boolean))]
    const data=[]
    for(let mo=1;mo<=12;mo++){
      const mk=`${CY}-${String(mo).padStart(2,'0')}`
      const row={mo,label:MONTHS[mo-1]}
      pmNames.forEach(pm=>{row[pm]=0})
      projects.filter(p=>!p.archived).forEach(p=>{if(p.pm)row[p.pm]=(row[p.pm]||0)+p.phases.reduce((s,ph)=>s+(ph.monthly?.[mk]||0),0)})
      data.push(row)
    }
    const active=pmNames.filter(pm=>data.some(d=>(d[pm]||0)>0))

    const x=d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY=d3.max(data,d=>d3.max(active,pm=>d[pm]||0))*1.15||1
    const y=d3.scaleLinear().domain([0,maxY]).range([h,0])
    addGridlines(g,y,w,5)

    active.forEach((pm,i)=>{
      const c=PM_COLORS[i%PM_COLORS.length]
      g.append('path').datum(data).attr('d',d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d[pm]||0)).curve(d3.curveBasis)).attr('fill',c).attr('fill-opacity',0.15)
      g.append('path').datum(data).attr('d',d3.line().x(d=>x(d.mo)).y(d=>y(d[pm]||0)).curve(d3.curveBasis)).attr('fill','none').attr('stroke',c).attr('stroke-width',1.5)
    })

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2))).call(styleAxes)
    g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(fmtK)).call(styleAxes)

    addCrosshair(g,x,y,h,w,data,d=>d.mo,
      active.map((pm,i)=>({key:pm,label:pm,color:PM_COLORS[i%PM_COLORS.length],accessor:d=>d[pm]||0})),
      d=>d.label+' '+CY
    )

    const leg=svg.append('g').attr('transform',`translate(${W-90},${m.top+5})`)
    active.forEach((pm,i)=>{
      const r=leg.append('g').attr('transform',`translate(0,${i*17})`)
      r.append('circle').attr('r',4).attr('fill',PM_COLORS[i%PM_COLORS.length])
      r.append('text').attr('x',12).attr('y',4).text(pm).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects])
  return (
    <ChartCard title={`${CY} Fees by PM`}>
      <svg ref={ref} style={{width:'100%',height:300}} />
    </ChartCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. HISTORICAL MONTHLY
// ══════════════════════════════════════════════════════════════════════════════
function HistoricalMonthlyChart({ projects, hourlyData, monthlyGoal }) {
  const ref = useD3((svg, el) => {
    const W = el.clientWidth, H = 340
    const m = { top: 10, right: 130, bottom: 50, left: 64 }
    const w = W-m.left-m.right, h = H-m.top-m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const data=[]
    Object.keys(HIST_ALL).map(Number).sort().forEach(yr=>{
      Object.entries(HIST_ALL[yr]).forEach(([mo,d])=>{
        if(d.g!=null){const goal=GOAL_BY_YEAR[yr]||monthlyGoal;data.push({date:new Date(yr,+mo-1,1),gross:d.g,ff:d.g*0.85,goal})}
      })
    })
    for(let mo=1;mo<CM;mo++){
      const mk=`${CY}-${String(mo).padStart(2,'0')}`
      const ff=mTotal(mk,projects),hourly=hourlyData[mk]||0
      const ex=data.find(d=>d.date.getFullYear()===CY&&d.date.getMonth()===mo-1)
      if(ex){ex.ff=ff;ex.gross=ff+hourly}
    }

    const x=d3.scaleTime().domain(d3.extent(data,d=>d.date)).range([0,w])
    const maxY=d3.max(data,d=>Math.max(d.gross,d.goal))*1.1
    const y=d3.scaleLinear().domain([0,maxY]).range([h,0])
    addGridlines(g,y,w,6)

    g.append('path').datum(data).attr('d',d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.goal)).curve(d3.curveStepAfter)).attr('fill','rgba(70,130,210,0.06)')
    g.append('path').datum(data).attr('d',d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.gross)).curve(d3.curveMonotoneX)).attr('fill','rgba(230,180,60,0.1)')
    g.append('path').datum(data).attr('d',d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.ff)).curve(d3.curveMonotoneX)).attr('fill','rgba(192,57,43,0.1)')

    g.append('path').datum(data).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.goal)).curve(d3.curveStepAfter)).attr('fill','none').attr('stroke','#4472C4').attr('stroke-width',2)
    g.append('path').datum(data).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.ff)).curve(d3.curveMonotoneX)).attr('fill','none').attr('stroke','#C0392B').attr('stroke-width',1.5)
    g.append('path').datum(data).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.gross)).curve(d3.curveMonotoneX)).attr('fill','none').attr('stroke','#E6A800').attr('stroke-width',1.5)

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("'%y"))).call(styleAxes)
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(fmtK)).call(styleAxes)

    addCrosshair(g,x,y,h,w,data,d=>d.date,
      [{key:'goal',label:'Goal',color:'#4472C4',accessor:d=>d.goal},{key:'ff',label:'FF',color:'#C0392B',accessor:d=>d.ff},{key:'gross',label:'Gross',color:'#E6A800',accessor:d=>d.gross}],
      d=>MONTHS[d.date.getMonth()]+' '+d.date.getFullYear()
    )

    const leg=svg.append('g').attr('transform',`translate(${W-110},${m.top+20})`)
    ;[{l:'Goal',c:'#4472C4'},{l:'Fixed Fee',c:'#C0392B'},{l:'Gross',c:'#E6A800'}].forEach((s,i)=>{
      const r=leg.append('g').attr('transform',`translate(0,${i*20})`)
      r.append('line').attr('x1',0).attr('x2',16).attr('y',0).attr('stroke',s.c).attr('stroke-width',2)
      r.append('text').attr('x',22).attr('y',4).text(s.l).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, hourlyData, monthlyGoal])

  const years = Object.keys(HIST_ALL).map(Number).sort()
  return (
    <ChartCard title={`Historical Billings | ${years[0]}–${CY}`} kpis={[
      {label:'Years', value:String(years.length)},
      {label:'Peak', value:fmtK(d3.max(Object.values(HIST_ALL).flatMap(yr=>Object.values(yr).map(d=>d.g||0)))), color:'#E6A800'},
    ]}>
      <svg ref={ref} style={{width:'100%',height:340}} />
    </ChartCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. HISTORICAL ANNUAL TRACKING
// ══════════════════════════════════════════════════════════════════════════════
function HistoricalAnnualChart({ monthlyGoal }) {
  const ref = useD3((svg, el) => {
    const W = el.clientWidth, H = 340
    const m = { top: 10, right: 130, bottom: 50, left: 80 }
    const w = W-m.left-m.right, h = H-m.top-m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const grossData=[], goalData=[]
    Object.keys(HIST_ALL).map(Number).sort().forEach(yr=>{
      let cum=0,cumGoal=0
      const goal=GOAL_BY_YEAR[yr]||monthlyGoal
      Object.entries(HIST_ALL[yr]).sort((a,b)=>+a[0]-+b[0]).forEach(([mo,d])=>{
        const date=new Date(yr,+mo-1,1)
        if(d.g!=null){cum+=d.g;grossData.push({date,val:cum,yr})}
        cumGoal+=goal;goalData.push({date,val:cumGoal,yr})
      })
    })

    const x=d3.scaleTime().domain(d3.extent(grossData,d=>d.date)).range([0,w])
    const maxY=Math.max(d3.max(grossData,d=>d.val),d3.max(goalData,d=>d.val))*1.05
    const y=d3.scaleLinear().domain([0,maxY]).range([h,0])
    addGridlines(g,y,w,6)

    g.append('path').datum(goalData).attr('d',d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.val)).curve(d3.curveStepAfter)).attr('fill','rgba(192,57,43,0.06)')
    g.append('path').datum(grossData).attr('d',d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.val)).curve(d3.curveLinear)).attr('fill','rgba(70,130,210,0.08)')

    g.append('path').datum(goalData).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.val)).curve(d3.curveStepAfter)).attr('fill','none').attr('stroke','#C0392B').attr('stroke-width',2)
    g.append('path').datum(grossData).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.val)).curve(d3.curveLinear)).attr('fill','none').attr('stroke','#4472C4').attr('stroke-width',2)

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("'%y"))).call(styleAxes)
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(fmtK)).call(styleAxes)

    const merged=grossData.map((d,i)=>({...d,goal:goalData[i]?.val||0}))
    addCrosshair(g,x,y,h,w,merged,d=>d.date,
      [{key:'gross',label:'Gross YTD',color:'#4472C4',accessor:d=>d.val},{key:'goal',label:'Goal YTD',color:'#C0392B',accessor:d=>d.goal}],
      d=>MONTHS[d.date.getMonth()]+' '+d.date.getFullYear()
    )

    const leg=svg.append('g').attr('transform',`translate(${W-120},${m.top+20})`)
    ;[{l:'Gross Billings',c:'#4472C4'},{l:'Goal Billings',c:'#C0392B'}].forEach((s,i)=>{
      const r=leg.append('g').attr('transform',`translate(0,${i*20})`)
      r.append('line').attr('x1',0).attr('x2',16).attr('y',0).attr('stroke',s.c).attr('stroke-width',2)
      r.append('text').attr('x',22).attr('y',4).text(s.l).style('font-size','11px').style('fill','#3D3935')
    })
  }, [monthlyGoal])

  return (
    <ChartCard title="Historical Billings | Annual Tracking" kpis={[
      {label:'Current Goal', value:fmtK((GOAL_BY_YEAR[CY]||monthlyGoal)*12)+'/yr', color:'#C0392B'},
    ]}>
      <svg ref={ref} style={{width:'100%',height:340}} />
    </ChartCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN TAB
// ══════════════════════════════════════════════════════════════════════════════
export default function WidgetsTab({ appState }) {
  const { projects, settings } = appState
  const hourlyData  = settings.billing?.hourlyByMonth || {}
  const monthlyGoal = settings.billing?.monthlyGoal || 395000

  return (
    <div className="overflow-auto" style={{ height: 'calc(100vh - 88px)', background: '#F5F5F1', padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <BillingProgressChart projects={projects} hourlyData={hourlyData} monthlyGoal={monthlyGoal} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ProjectionsByTypeChart projects={projects} />
          <FeesByPMChart projects={projects} />
        </div>

        <HistoricalMonthlyChart projects={projects} hourlyData={hourlyData} monthlyGoal={monthlyGoal} />
        <HistoricalAnnualChart monthlyGoal={monthlyGoal} />

      </div>
    </div>
  )
}
