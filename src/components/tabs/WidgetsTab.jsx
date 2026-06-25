import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { fmtK } from '../../lib/utils'

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

const phFeeFC = ph => ph.scope === 'CA' ? (ph.fee||0) * (ph.caMonths||12) : (ph.fee||0)

function mTotal(mk, projects) {
  return projects.filter(p=>!p.archived).reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

const TYPE_COLORS = {
  CA:'#4472C4', COM:'#C0392B', CODE:'#E67E22', MF:'#27AE60',
  SL:'#8E44AD', PLN:'#F1C40F', SFD:'#5DADE2', DRP:'#E74C3C',
  OA:'#95A5A6', OTHER:'#E88B8B',
}

const PM_COLORS = [
  '#8B0000','#C0392B','#E67E22','#27AE60','#8E44AD','#F1C40F','#1A3A5C','#E88B8B',
  '#2ECC71','#3498DB','#E74C3C','#9B59B6',
]

// ── Chart wrapper ─────────────────────────────────────────────────────────────
function ChartCard({ title, color, children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 6, border: '1px solid rgba(61,57,53,0.1)',
      overflow: 'hidden', ...style,
    }}>
      <div style={{
        background: color || '#8BC34A', padding: '8px 16px',
        fontFamily: '"League Gothic",sans-serif', fontSize: 14,
        letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{ padding: '20px 16px 12px' }}>{children}</div>
    </div>
  )
}

// ── D3 Area Chart (reusable) ─────────────────────────────────────────────────
function useD3Chart(renderFn, deps) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    renderFn(svg, ref.current)
  }, deps)
  return ref
}

// ── 1. Billing Progress (current year) ───────────────────────────────────────
function BillingProgressChart({ projects, hourlyData, monthlyGoal }) {
  const ref = useD3Chart((svg, el) => {
    const W = el.clientWidth, H = 300
    const m = { top: 20, right: 120, bottom: 40, left: 70 }
    const w = W - m.left - m.right, h = H - m.top - m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const data = []
    for (let mo = 1; mo <= 12; mo++) {
      const mk = `${CY}-${String(mo).padStart(2,'0')}`
      const ff = mTotal(mk, projects)
      const hourly = hourlyData[mk] || 0
      data.push({ mo, ff, gross: ff + hourly, goal: monthlyGoal })
    }

    const x = d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY = Math.max(monthlyGoal * 1.1, d3.max(data, d => d.gross) * 1.1)
    const y = d3.scaleLinear().domain([0, maxY]).range([h, 0])

    const goalArea = d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d.goal)).curve(d3.curveLinear)
    g.append('path').datum(data).attr('d', goalArea).attr('fill', 'rgba(70,130,210,0.12)')
    const ffArea = d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d.ff)).curve(d3.curveMonotoneX)
    g.append('path').datum(data.filter(d=>d.ff>0||d.mo<CM)).attr('d', ffArea).attr('fill', 'rgba(192,57,43,0.2)')
    const grossArea = d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d.gross)).curve(d3.curveMonotoneX)
    g.append('path').datum(data.filter(d=>d.gross>0||d.mo<CM)).attr('d', grossArea).attr('fill', 'rgba(230,180,60,0.15)')

    const goalLine = d3.line().x(d=>x(d.mo)).y(d=>y(d.goal)).curve(d3.curveLinear)
    g.append('path').datum(data).attr('d', goalLine).attr('fill','none').attr('stroke','#4472C4').attr('stroke-width',2.5)
    const ffLine = d3.line().x(d=>x(d.mo)).y(d=>y(d.ff)).curve(d3.curveMonotoneX)
    g.append('path').datum(data.filter(d=>d.ff>0||d.mo<CM)).attr('d', ffLine).attr('fill','none').attr('stroke','#C0392B').attr('stroke-width',2)
    const grossLine = d3.line().x(d=>x(d.mo)).y(d=>y(d.gross)).curve(d3.curveMonotoneX)
    g.append('path').datum(data.filter(d=>d.gross>0||d.mo<CM)).attr('d', grossLine).attr('fill','none').attr('stroke','#E6A800').attr('stroke-width',1.5).attr('stroke-dasharray','4 2')

    data.forEach(d => {
      g.append('circle').attr('cx',x(d.mo)).attr('cy',y(d.goal)).attr('r',3).attr('fill','#4472C4')
    })

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d=>fmtK(d))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.selectAll('.domain,.tick line').attr('stroke','#ECEAE3')

    const legend = svg.append('g').attr('transform',`translate(${W-100},${m.top+10})`)
    ;[{label:'GOAL',color:'#4472C4'},{label:'FF',color:'#C0392B'},{label:'GROSS',color:'#E6A800'}].forEach((l,i) => {
      const ly = legend.append('g').attr('transform',`translate(0,${i*18})`)
      ly.append('circle').attr('r',4).attr('fill',l.color)
      ly.append('text').attr('x',10).attr('y',4).text(l.label).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, hourlyData, monthlyGoal])
  return <svg ref={ref} style={{ width: '100%', height: 300 }} />
}

// ── 2. Projections by Project Type ───────────────────────────────────────────
function ProjectionsByTypeChart({ projects, types }) {
  const ref = useD3Chart((svg, el) => {
    const W = el.clientWidth, H = 300
    const m = { top: 20, right: 140, bottom: 40, left: 70 }
    const w = W - m.left - m.right, h = H - m.top - m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const typeCodes = [...new Set(projects.flatMap(p => p.phases.map(ph => ph.scope || p.type || 'OTHER')))]
    const data = []
    for (let mo = 1; mo <= 12; mo++) {
      const mk = `${CY}-${String(mo).padStart(2,'0')}`
      const row = { mo }
      typeCodes.forEach(t => { row[t] = 0 })
      projects.filter(p=>!p.archived).forEach(p => {
        p.phases.forEach(ph => {
          const t = ph.scope || p.type || 'OTHER'
          row[t] = (row[t]||0) + (ph.monthly?.[mk]||0)
        })
      })
      data.push(row)
    }

    const activeTypes = typeCodes.filter(t => data.some(d => (d[t]||0) > 0))
    const x = d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY = d3.max(data, d => activeTypes.reduce((s,t)=>s+(d[t]||0),0)) * 1.1 || 1
    const y = d3.scaleLinear().domain([0, maxY]).range([h, 0])

    activeTypes.forEach(t => {
      const color = TYPE_COLORS[t] || '#999'
      const area = d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d[t]||0)).curve(d3.curveBasis)
      g.append('path').datum(data).attr('d', area).attr('fill', color).attr('fill-opacity', 0.25)
      const line = d3.line().x(d=>x(d.mo)).y(d=>y(d[t]||0)).curve(d3.curveBasis)
      g.append('path').datum(data).attr('d', line).attr('fill','none').attr('stroke', color).attr('stroke-width', 1.5)
    })

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2)+' $')).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d=>fmtK(d))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.selectAll('.domain,.tick line').attr('stroke','#ECEAE3')

    const legend = svg.append('g').attr('transform',`translate(${W-120},${m.top+5})`)
    activeTypes.forEach((t,i) => {
      const ly = legend.append('g').attr('transform',`translate(0,${i*17})`)
      ly.append('circle').attr('r',4).attr('fill',TYPE_COLORS[t]||'#999')
      ly.append('text').attr('x',10).attr('y',4).text(t).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, types])
  return <svg ref={ref} style={{ width: '100%', height: 300 }} />
}

// ── 3. Fees by PM ────────────────────────────────────────────────────────────
function FeesByPMChart({ projects, pms }) {
  const ref = useD3Chart((svg, el) => {
    const W = el.clientWidth, H = 300
    const m = { top: 20, right: 120, bottom: 40, left: 70 }
    const w = W - m.left - m.right, h = H - m.top - m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const pmNames = [...new Set(projects.filter(p=>!p.archived).map(p=>p.pm).filter(Boolean))]
    const data = []
    for (let mo = 1; mo <= 12; mo++) {
      const mk = `${CY}-${String(mo).padStart(2,'0')}`
      const row = { mo }
      pmNames.forEach(pm => { row[pm] = 0 })
      projects.filter(p=>!p.archived).forEach(p => {
        const v = p.phases.reduce((s,ph)=>s+(ph.monthly?.[mk]||0),0)
        if (p.pm) row[p.pm] = (row[p.pm]||0) + v
      })
      data.push(row)
    }

    const activePMs = pmNames.filter(pm => data.some(d => (d[pm]||0) > 0))
    const x = d3.scaleLinear().domain([1,12]).range([0,w])
    const maxY = d3.max(data, d => d3.max(activePMs, pm=>d[pm]||0)) * 1.15 || 1
    const y = d3.scaleLinear().domain([0, maxY]).range([h, 0])

    activePMs.forEach((pm, i) => {
      const color = PM_COLORS[i % PM_COLORS.length]
      const area = d3.area().x(d=>x(d.mo)).y0(h).y1(d=>y(d[pm]||0)).curve(d3.curveBasis)
      g.append('path').datum(data).attr('d', area).attr('fill', color).attr('fill-opacity', 0.2)
      const line = d3.line().x(d=>x(d.mo)).y(d=>y(d[pm]||0)).curve(d3.curveBasis)
      g.append('path').datum(data).attr('d', line).attr('fill','none').attr('stroke', color).attr('stroke-width', 1.5)
    })

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(12).tickFormat(i=>MONTHS[i-1]+' '+String(CY).slice(2))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d=>fmtK(d))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.selectAll('.domain,.tick line').attr('stroke','#ECEAE3')

    const legend = svg.append('g').attr('transform',`translate(${W-100},${m.top+5})`)
    activePMs.forEach((pm, i) => {
      const ly = legend.append('g').attr('transform',`translate(0,${i*17})`)
      ly.append('circle').attr('r',4).attr('fill',PM_COLORS[i % PM_COLORS.length])
      ly.append('text').attr('x',10).attr('y',4).text(pm).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, pms])
  return <svg ref={ref} style={{ width: '100%', height: 300 }} />
}

// ── 4. Historical Billings (monthly) ─────────────────────────────────────────
function HistoricalMonthlyChart({ projects, hourlyData, monthlyGoal }) {
  const ref = useD3Chart((svg, el) => {
    const W = el.clientWidth, H = 320
    const m = { top: 20, right: 120, bottom: 50, left: 70 }
    const w = W - m.left - m.right, h = H - m.top - m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const data = []
    Object.keys(HIST_ALL).map(Number).sort().forEach(yr => {
      Object.entries(HIST_ALL[yr]).forEach(([mo, d]) => {
        if (d.g != null) {
          const goal = GOAL_BY_YEAR[yr] || monthlyGoal
          data.push({ date: new Date(yr, +mo-1, 1), gross: d.g, ff: d.g * 0.85, goal })
        }
      })
    })
    for (let mo = 1; mo < CM; mo++) {
      const mk = `${CY}-${String(mo).padStart(2,'0')}`
      const ff = mTotal(mk, projects)
      const hourly = hourlyData[mk] || 0
      const existing = data.find(d => d.date.getFullYear() === CY && d.date.getMonth() === mo-1)
      if (existing) { existing.ff = ff; existing.gross = ff + hourly }
    }

    const x = d3.scaleTime().domain(d3.extent(data, d=>d.date)).range([0,w])
    const maxY = d3.max(data, d => Math.max(d.gross, d.goal)) * 1.1
    const y = d3.scaleLinear().domain([0, maxY]).range([h, 0])

    const goalArea = d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.goal)).curve(d3.curveStepAfter)
    g.append('path').datum(data).attr('d', goalArea).attr('fill', 'rgba(70,130,210,0.1)')
    const ffArea = d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.ff)).curve(d3.curveMonotoneX)
    g.append('path').datum(data).attr('d', ffArea).attr('fill', 'rgba(192,57,43,0.15)')
    const grossArea = d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.gross)).curve(d3.curveMonotoneX)
    g.append('path').datum(data).attr('d', grossArea).attr('fill', 'rgba(230,180,60,0.12)')

    g.append('path').datum(data).attr('d', d3.line().x(d=>x(d.date)).y(d=>y(d.goal)).curve(d3.curveStepAfter)).attr('fill','none').attr('stroke','#4472C4').attr('stroke-width',2)
    g.append('path').datum(data).attr('d', d3.line().x(d=>x(d.date)).y(d=>y(d.ff)).curve(d3.curveMonotoneX)).attr('fill','none').attr('stroke','#C0392B').attr('stroke-width',1.5)
    g.append('path').datum(data).attr('d', d3.line().x(d=>x(d.date)).y(d=>y(d.gross)).curve(d3.curveMonotoneX)).attr('fill','none').attr('stroke','#E6A800').attr('stroke-width',1.5)

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%b \'%y'))).selectAll('text').style('font-size','9px').style('fill','#736F4C').attr('transform','rotate(-45)').attr('text-anchor','end')
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d=>fmtK(d))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.selectAll('.domain,.tick line').attr('stroke','#ECEAE3')

    const legend = svg.append('g').attr('transform',`translate(${W-100},${m.top+10})`)
    ;[{label:'GOAL',color:'#4472C4'},{label:'FF',color:'#C0392B'},{label:'GROSS',color:'#E6A800'}].forEach((l,i) => {
      const ly = legend.append('g').attr('transform',`translate(0,${i*18})`)
      ly.append('circle').attr('r',4).attr('fill',l.color)
      ly.append('text').attr('x',10).attr('y',4).text(l.label).style('font-size','11px').style('fill','#3D3935')
    })
  }, [projects, hourlyData, monthlyGoal])
  return <svg ref={ref} style={{ width: '100%', height: 320 }} />
}

// ── 5. Historical Annual Tracking (cumulative sawtooth) ──────────────────────
function HistoricalAnnualChart({ monthlyGoal }) {
  const ref = useD3Chart((svg, el) => {
    const W = el.clientWidth, H = 320
    const m = { top: 20, right: 120, bottom: 50, left: 80 }
    const w = W - m.left - m.right, h = H - m.top - m.bottom
    svg.attr('width', W).attr('height', H)
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    const grossData = [], goalData = []
    Object.keys(HIST_ALL).map(Number).sort().forEach(yr => {
      let cum = 0
      const goal = GOAL_BY_YEAR[yr] || monthlyGoal
      let cumGoal = 0
      Object.entries(HIST_ALL[yr]).sort((a,b)=>+a[0]-+b[0]).forEach(([mo, d]) => {
        const date = new Date(yr, +mo-1, 1)
        if (d.g != null) { cum += d.g; grossData.push({ date, val: cum }) }
        cumGoal += goal; goalData.push({ date, val: cumGoal })
      })
    })

    const allDates = grossData.map(d=>d.date)
    const x = d3.scaleTime().domain(d3.extent(allDates)).range([0,w])
    const maxY = Math.max(d3.max(grossData, d=>d.val), d3.max(goalData, d=>d.val)) * 1.05
    const y = d3.scaleLinear().domain([0, maxY]).range([h, 0])

    const goalArea = d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.val)).curve(d3.curveStepAfter)
    g.append('path').datum(goalData).attr('d', goalArea).attr('fill', 'rgba(192,57,43,0.08)')
    const grossArea = d3.area().x(d=>x(d.date)).y0(h).y1(d=>y(d.val)).curve(d3.curveLinear)
    g.append('path').datum(grossData).attr('d', grossArea).attr('fill', 'rgba(70,130,210,0.1)')

    g.append('path').datum(goalData).attr('d', d3.line().x(d=>x(d.date)).y(d=>y(d.val)).curve(d3.curveStepAfter)).attr('fill','none').attr('stroke','#C0392B').attr('stroke-width',2)
    g.append('path').datum(grossData).attr('d', d3.line().x(d=>x(d.date)).y(d=>y(d.val)).curve(d3.curveLinear)).attr('fill','none').attr('stroke','#4472C4').attr('stroke-width',2)

    g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%b \'%y'))).selectAll('text').style('font-size','9px').style('fill','#736F4C').attr('transform','rotate(-45)').attr('text-anchor','end')
    g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d=>fmtK(d))).selectAll('text').style('font-size','10px').style('fill','#736F4C')
    g.selectAll('.domain,.tick line').attr('stroke','#ECEAE3')

    const legend = svg.append('g').attr('transform',`translate(${W-115},${m.top+10})`)
    ;[{label:'Gross Billings',color:'#4472C4'},{label:'Goal Billings',color:'#C0392B'}].forEach((l,i) => {
      const ly = legend.append('g').attr('transform',`translate(0,${i*18})`)
      ly.append('circle').attr('r',4).attr('fill',l.color)
      ly.append('text').attr('x',10).attr('y',4).text(l.label).style('font-size','11px').style('fill','#3D3935')
    })
  }, [monthlyGoal])
  return <svg ref={ref} style={{ width: '100%', height: 320 }} />
}

// ── Main Tab ─────────────────────────────────────────────────────────────────
export default function WidgetsTab({ appState }) {
  const { projects, settings } = appState
  const hourlyData  = settings.billing?.hourlyByMonth || {}
  const monthlyGoal = settings.billing?.monthlyGoal || 395000
  const pms = (settings.pms || []).map(p => p.name)
  const types = settings.projectTypes || []

  return (
    <div className="overflow-auto" style={{ height: 'calc(100vh - 88px)', background: '#ECEAE3', padding: 20 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <ChartCard title={`${CY} Billing Progress`} color="#8BC34A">
          <BillingProgressChart projects={projects} hourlyData={hourlyData} monthlyGoal={monthlyGoal} />
        </ChartCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title={`${CY} Projections by Project Type`} color="#8BC34A">
            <ProjectionsByTypeChart projects={projects} types={types} />
          </ChartCard>
          <ChartCard title={`${CY} Fees by PM`} color="#8BC34A">
            <FeesByPMChart projects={projects} pms={pms} />
          </ChartCard>
        </div>

        <ChartCard title="Historical Billings Data | From 2016" color="#6FA8DC">
          <HistoricalMonthlyChart projects={projects} hourlyData={hourlyData} monthlyGoal={monthlyGoal} />
        </ChartCard>

        <ChartCard title="Historical Billings | Annual Tracking" color="#6FA8DC">
          <HistoricalAnnualChart monthlyGoal={monthlyGoal} />
        </ChartCard>

      </div>
    </div>
  )
}
