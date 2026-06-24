import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#dedad0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 4 },
  firmName: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#3D3935' },
  firmSub: { fontSize: 8, color: '#736F4C', letterSpacing: 1, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 8, color: '#a09c85' },
  headerConfidential: { fontSize: 7, color: '#a09c85', marginTop: 2, letterSpacing: 0.5 },
  titleBlock: { marginTop: 12, paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: '#BD6439', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#3D3935', letterSpacing: 0.5 },
  subtitle: { fontSize: 9, color: '#736F4C', marginTop: 3 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#F5F5F1', borderRadius: 5, padding: 10, borderTopWidth: 3, borderTopColor: '#BD6439' },
  kpiLabel: { fontSize: 7, color: '#736F4C', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#BD6439' },
  tableHead: { flexDirection: 'row', backgroundColor: '#3D3935', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3 },
  tableHeadCell: { fontSize: 7, color: '#F5F5F1', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeHeader: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: 'rgba(115,104,76,0.09)' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.06)' },
  totalRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#3D3935' },
  cell: { fontSize: 8, color: '#3D3935' },
  cellRight: { fontSize: 8, color: '#3D3935', textAlign: 'right' },
  cellBold: { fontSize: 8, color: '#3D3935', fontFamily: 'Helvetica-Bold' },
  cellBoldRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cellOlive: { fontSize: 8, color: '#736F4C' },
  cellTerra: { fontSize: 8, color: '#BD6439', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  wipBarOuter: { height: 3, backgroundColor: '#ECEAE3', borderRadius: 1.5, width: 24 },
  wipBarInner: { height: 3, backgroundColor: '#BD6439', borderRadius: 1.5 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#dedad0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#a09c85' },
})

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => !n ? '—' : '$' + Math.round(n).toLocaleString()

const KpiCard = ({ label, value, color }) => (
  <View style={[S.kpiCard, { borderTopColor: color || '#BD6439' }]}>
    <Text style={S.kpiLabel}>{label}</Text>
    <Text style={[S.kpiValue, { color: color || '#BD6439' }]}>{value}</Text>
  </View>
)

const COLS = [
  { label: 'Opportunity', flex: 1.5 },
  { label: 'Client',      flex: 1 },
  { label: 'PM',           flex: 0.7 },
  { label: 'Status',       flex: 0.9 },
  { label: 'Est. Fee',     flex: 1,   right: true },
  { label: 'Confidence',   flex: 0.8, right: true },
  { label: 'Weighted',     flex: 1,   right: true },
]

// ── Main PDF Document ────────────────────────────────────────────────────────
export default function OpportunitiesPDF({ appState, pm, client, logo }) {
  const { opportunities, settings } = appState
  const typeList = settings.projectTypes || []

  const opps = (opportunities || []).filter(o =>
    !o.archived &&
    o.status !== '04 Won' &&
    o.status !== '05 Lost' &&
    (pm === 'ALL' || o.pm === pm) &&
    (client === 'ALL' || o.client === client)
  )

  const dt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const subtitle = `${pm === 'ALL' ? 'All PMs' : 'PM: ' + pm} · Active Opportunities as of ${dt}`
  const firmName = settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES'
  const useLogo = logo || settings.firm?.logo

  const typeOrder = typeList.map(t => t.code)
  const typeLabel = code => typeList.find(t => t.code === code)?.label || code

  const typeGroups = {}
  const typeGroupOrder = []
  opps.forEach(o => {
    const t = o.type || 'SFD'
    if (!typeGroups[t]) { typeGroups[t] = []; typeGroupOrder.push(t) }
    typeGroups[t].push(o)
  })
  typeGroupOrder.sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b))

  const totalFee = opps.reduce((s, o) => s + (o.fee || 0), 0)
  const totalWtd = opps.reduce((s, o) => s + Math.round((o.fee || 0) * (o.confidence || 50) / 100), 0)
  const avgConf = opps.length ? Math.round(opps.reduce((s, o) => s + (o.confidence || 50), 0) / opps.length) : 0

  return (
    <Document>
      <Page size="A4" style={S.page} wrap>

        {/* Header */}
        <View style={S.headerRow} fixed>
          <View style={S.headerLeft}>
            {useLogo ? <Image src={useLogo} style={S.logo} /> : null}
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
          <Text style={S.title}>Opportunities Report</Text>
          <Text style={S.subtitle}>{subtitle}</Text>
        </View>

        {/* KPI row */}
        <View style={S.kpiRow}>
          <KpiCard label="Active Opportunities" value={String(opps.length)} color="#3D3935" />
          <KpiCard label="Total Est. Fee" value={fmt(totalFee)} color="#3D3935" />
          <KpiCard label="Weighted Value" value={fmt(totalWtd)} color="#BD6439" />
          <KpiCard label="Avg Confidence" value={opps.length ? avgConf + '%' : '—'} color="#736F4C" />
        </View>

        {/* Table header */}
        <View style={S.tableHead} fixed>
          {COLS.map((c, i) => (
            <Text key={i} style={[S.tableHeadCell, { flex: c.flex || 1, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
          ))}
        </View>

        {/* Type groups */}
        {typeGroupOrder.map(t => {
          const items = typeGroups[t].sort((a, b) => (b.confidence || 50) - (a.confidence || 50))
          const typeFee = items.reduce((s, o) => s + (o.fee || 0), 0)
          const typeWtd = items.reduce((s, o) => s + Math.round((o.fee || 0) * (o.confidence || 50) / 100), 0)

          return (
            <View key={t}>
              {/* Type header */}
              <View style={S.typeHeader}>
                <Text style={[{ flex: 1.5 + 1 + 0.7 + 0.9, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#736F4C', letterSpacing: 0.5 }]}>
                  {typeLabel(t).toUpperCase()} — {items.length} opportunit{items.length !== 1 ? 'ies' : 'y'}
                </Text>
                <Text style={[S.cellBoldRight, { flex: 1, color: '#3D3935' }]}>{fmt(typeFee)}</Text>
                <Text style={{ flex: 0.8 }}></Text>
                <Text style={[S.cellTerra, { flex: 1 }]}>{fmt(typeWtd)}</Text>
              </View>

              {/* Opportunity rows */}
              {items.map((o, i) => {
                const wtd = Math.round((o.fee || 0) * (o.confidence || 50) / 100)
                const conf = o.confidence || 50
                return (
                  <View key={i} style={S.tableRow}>
                    <Text style={[S.cellBold, { flex: 1.5, paddingLeft: 8 }]}>{o.name || '—'}</Text>
                    <Text style={[S.cellOlive, { flex: 1 }]}>{o.client || '—'}</Text>
                    <Text style={[S.cellOlive, { flex: 0.7 }]}>{o.pm || '—'}</Text>
                    <Text style={[S.cellOlive, { flex: 0.9 }]}>{o.status || '—'}</Text>
                    <Text style={[S.cellRight, { flex: 1 }]}>{fmt(o.fee || 0)}</Text>
                    <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                      <View style={S.wipBarOuter}>
                        <View style={[S.wipBarInner, { width: conf + '%' }]} />
                      </View>
                      <Text style={{ fontSize: 7, color: '#3D3935' }}>{conf}%</Text>
                    </View>
                    <Text style={[S.cellTerra, { flex: 1 }]}>{fmt(wtd)}</Text>
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* No opps fallback */}
        {opps.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#a09c85' }}>No active opportunities</Text>
          </View>
        )}

        {/* Total row */}
        <View style={S.totalRow}>
          <Text style={{ flex: 1.5 + 1 + 0.7 + 0.9, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#F5F5F1' }}>TOTAL</Text>
          <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }}>{fmt(totalFee)}</Text>
          <Text style={{ flex: 0.8 }}></Text>
          <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#f8c4a0', textAlign: 'right' }}>{fmt(totalWtd)}</Text>
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
