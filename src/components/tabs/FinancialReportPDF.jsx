import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#3D3935',
    backgroundColor: '#ffffff',
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
  },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#dedad0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 4 },
  firmName: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#3D3935' },
  firmSub: { fontSize: 8, color: '#736F4C', letterSpacing: 1, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 8, color: '#a09c85' },
  headerConfidential: { fontSize: 7, color: '#a09c85', marginTop: 2, letterSpacing: 0.5 },
  // Title
  titleBlock: { marginTop: 12, paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: '#BD6439', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#3D3935', letterSpacing: 0.5 },
  subtitle: { fontSize: 9, color: '#736F4C', marginTop: 3 },
  // KPI grid
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#F5F5F1', borderRadius: 5, padding: 10, borderTopWidth: 3, borderTopColor: '#BD6439' },
  kpiLabel: { fontSize: 7, color: '#736F4C', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#BD6439' },
  // Section header
  sectionHeader: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#3D3935', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  // Table
  table: { marginBottom: 16 },
  tableHead: { flexDirection: 'row', backgroundColor: '#3D3935', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3 },
  tableHeadCell: { fontSize: 7, color: '#F5F5F1', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.08)' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.08)', backgroundColor: 'rgba(236,234,227,0.4)' },
  tableRowTotal: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#ECEAE3', borderTopWidth: 1, borderTopColor: '#BD6439' },
  cell: { fontSize: 8, color: '#3D3935' },
  cellRight: { fontSize: 8, color: '#3D3935', textAlign: 'right' },
  cellBold: { fontSize: 8, color: '#3D3935', fontFamily: 'Helvetica-Bold' },
  cellOlive: { fontSize: 8, color: '#736F4C', textAlign: 'right' },
  cellTerra: { fontSize: 8, color: '#BD6439', textAlign: 'right' },
  // Period billings
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodCard: { flex: 1, padding: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(61,57,53,0.1)' },
  periodLabel: { fontSize: 7, color: '#736F4C', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  periodValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#dedad0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#a09c85' },
  // WIP bar
  wipBarOuter: { height: 4, backgroundColor: '#ECEAE3', borderRadius: 2, marginTop: 3, flex: 1 },
  wipBarInner: { height: 4, backgroundColor: '#BD6439', borderRadius: 2 },
  wipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = n => !n ? '—' : '$' + Math.round(n).toLocaleString()
const fmtK = n => !n ? '—' : n >= 1000000 ? '$' + (n/1000000).toFixed(2) + 'M' : n >= 1000 ? '$' + Math.round(n/1000) + 'k' : '$' + Math.round(n)
const pct  = (a, b) => b > 0 ? Math.round(a/b*100) : 0

// ── Components ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, color }) => (
  <View style={[S.kpiCard, { borderTopColor: color || '#BD6439' }]}>
    <Text style={S.kpiLabel}>{label}</Text>
    <Text style={[S.kpiValue, { color: color || '#BD6439' }]}>{value}</Text>
  </View>
)

const TableHead = ({ cols }) => (
  <View style={S.tableHead}>
    {cols.map((c, i) => (
      <Text key={i} style={[S.tableHeadCell, { flex: c.flex || 1, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
    ))}
  </View>
)

const TableRow = ({ cells, cols, alt, total }) => (
  <View style={total ? S.tableRowTotal : alt ? S.tableRowAlt : S.tableRow}>
    {cells.map((cell, i) => (
      <Text key={i} style={[
        cols[i]?.right ? (total ? S.cellBold : S.cellRight) : (total ? S.cellBold : S.cell),
        { flex: cols[i]?.flex || 1 },
        cell?.color ? { color: cell.color } : {},
      ]}>
        {typeof cell === 'object' ? cell.value : cell}
      </Text>
    ))}
  </View>
)

// ── Main PDF Document ─────────────────────────────────────────────────────────
export default function FinancialReportPDF({ appState, pm, client, fromMk, toMk, logo }) {
  const { projects, settings } = appState
  const monthlyGoal = settings.billing?.monthlyGoal || 395000
  const CY = new Date().getFullYear()
  const CM = new Date().getMonth() + 1

  const phCAEst = ph => ph.scope === 'CA' ? (ph.fee||0) * (ph.caMonths||12) : 0
  const phFeeFC = ph => ph.scope === 'CA' ? phCAEst(ph) : (ph.fee||0)
  function phYTD(ph) { let s=0; for(let m=1;m<CM;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;s+=ph.monthly?.[mk]||0;} return s; }
  const pFee = p => (p.phases||[]).reduce((s,ph)=>s+phFeeFC(ph),0)
  const pBil = p => (p.phases||[]).reduce((s,ph)=>s+(ph.billed||0),0)
  const pYTD = p => (p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0)

  function mTotalAll(mk) {
    return projects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
  }

  const active = projects.filter(p =>
    !p.archived &&
    (pm === 'ALL' || p.pm === pm) &&
    (client === 'ALL' || p.client === client)
  )

  const tF   = active.reduce((s,p)=>s+pFee(p),0)
  const tB   = active.reduce((s,p)=>s+pBil(p),0)
  const tYTD = active.reduce((s,p)=>s+pYTD(p),0)
  const tR   = tF - tB - tYTD
  const tWIP = pct(tB + tYTD, tF)

  // Period billings
  const MONTH_KEYS = []
  if (fromMk && toMk) {
    let [fy, fm] = fromMk.split('-').map(Number)
    const [ty, tm] = toMk.split('-').map(Number)
    while (fy < ty || (fy === ty && fm <= tm)) {
      MONTH_KEYS.push(`${fy}-${String(fm).padStart(2,'0')}`)
      fm++; if (fm > 12) { fm = 1; fy++ }
    }
  }
  const rangeTotal = MONTH_KEYS.reduce((s,mk)=>s+mTotalAll(mk),0)
  const rangeGoal  = MONTH_KEYS.length * monthlyGoal

  // PM groups
  const pmGroups = {}
  active.forEach(p => {
    const k = p.pm || '—'
    if (!pmGroups[k]) pmGroups[k] = { pm: k, fee: 0, billed: 0, ytd: 0, projects: 0 }
    pmGroups[k].fee += pFee(p)
    pmGroups[k].billed += pBil(p)
    pmGroups[k].ytd += pYTD(p)
    pmGroups[k].projects++
  })
  const pmRows = Object.values(pmGroups).sort((a,b) => b.fee - a.fee)

  const subtitle = `${pm==='ALL'?'All PMs':'PM: '+pm} · ${client==='ALL'?'All Clients':client} · ${fromMk} – ${toMk}`
  const dt = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  const firmName = settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES'
  const useLogo  = logo || settings.firm?.logo

  const pmCols = [
    { label: 'PM',       flex: 0.8 },
    { label: 'Projects', flex: 0.6, right: true },
    { label: 'Total Fee',flex: 1.2, right: true },
    { label: 'Billed',  flex: 1.2, right: true },
    { label: 'YTD',     flex: 1.2, right: true },
    { label: 'Remaining',flex:1.2, right: true },
    { label: 'WIP %',   flex: 0.7, right: true },
  ]

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            {useLogo
              ? <Image src={useLogo} style={S.logo} />
              : null
            }
            <View>
              <Text style={S.firmName}>{firmName.toUpperCase()}</Text>
              <Text style={S.firmSub}>ARCHITECTS · PLANNERS</Text>
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerDate}>{dt}</Text>
            <Text style={S.headerConfidential}>CONFIDENTIAL</Text>
          </View>
        </View>

        {/* Title */}
        <View style={S.titleBlock}>
          <Text style={S.title}>Firm Financial Summary</Text>
          <Text style={S.subtitle}>{subtitle}</Text>
        </View>

        {/* KPI row */}
        <View style={S.kpiRow}>
          <KpiCard label="Total Contracted Fee" value={fmtK(tF)} color="#3D3935" />
          <KpiCard label="Prior Billed" value={fmtK(tB)} color="#736F4C" />
          <KpiCard label={`YTD ${CY}`} value={fmtK(tYTD)} color="#BD6439" />
          <KpiCard label="Remaining Backlog" value={fmtK(tR)} color="#BD6439" />
        </View>

        {/* Period billings */}
        <Text style={S.sectionHeader}>Period Billings</Text>
        <View style={S.periodRow}>
          <View style={S.periodCard}>
            <Text style={S.periodLabel}>Billed in Period</Text>
            <Text style={[S.periodValue, { color: rangeTotal >= rangeGoal ? '#736F4C' : '#BD6439' }]}>{fmt(rangeTotal)}</Text>
          </View>
          <View style={S.periodCard}>
            <Text style={S.periodLabel}>Goal for Period</Text>
            <Text style={[S.periodValue, { color: '#3D3935' }]}>{fmt(rangeGoal)}</Text>
          </View>
          <View style={[S.periodCard, { borderTopWidth: 3, borderTopColor: rangeTotal >= rangeGoal ? '#736F4C' : '#BD6439' }]}>
            <Text style={S.periodLabel}>vs. Goal</Text>
            <Text style={[S.periodValue, { color: rangeTotal >= rangeGoal ? '#736F4C' : '#BD6439' }]}>
              {rangeTotal >= rangeGoal ? '+' : ''}{fmt(rangeTotal - rangeGoal)}
            </Text>
          </View>
        </View>

        {/* PM table */}
        <Text style={S.sectionHeader}>Backlog by Project Manager</Text>
        <View style={S.table}>
          <TableHead cols={pmCols} />
          {pmRows.map((d, i) => {
            const rem = d.fee - d.billed - d.ytd
            const w   = pct(d.billed + d.ytd, d.fee)
            return (
              <TableRow key={d.pm} alt={i%2===1} cols={pmCols} cells={[
                d.pm,
                { value: String(d.projects), color: '#736F4C' },
                fmt(d.fee),
                fmt(d.billed),
                { value: fmt(d.ytd), color: '#BD6439' },
                { value: fmt(rem), color: '#736F4C' },
                w + '%',
              ]} />
            )
          })}
          <TableRow total cols={pmCols} cells={[
            'TOTAL',
            { value: String(active.length), color: '#736F4C' },
            fmt(tF),
            fmt(tB),
            { value: fmt(tYTD), color: '#BD6439' },
            { value: fmt(tR), color: '#736F4C' },
            tWIP + '%',
          ]} />
        </View>

        {/* Firm WIP */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <Text style={{ fontSize: 8, color: '#736F4C' }}>Firm WIP</Text>
          <View style={S.wipBarOuter}>
            <View style={[S.wipBarInner, { width: Math.min(100, tWIP) + '%' }]} />
          </View>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#BD6439' }}>{tWIP}%</Text>
          <Text style={{ fontSize: 8, color: '#a09c85' }}>{fmt(tB + tYTD)} billed of {fmt(tF)}</Text>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>JD+A Project Tracker · Confidential</Text>
          <Text style={S.footerText}>Generated {new Date().toLocaleString()}</Text>
        </View>

      </Page>
    </Document>
  )
}
