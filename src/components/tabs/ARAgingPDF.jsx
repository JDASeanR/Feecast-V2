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
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
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
  bucketHeader: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.06)' },
  totalRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#3D3935' },
  cell: { fontSize: 8, color: '#3D3935' },
  cellRight: { fontSize: 8, color: '#3D3935', textAlign: 'right' },
  cellBold: { fontSize: 8, color: '#3D3935', fontFamily: 'Helvetica-Bold' },
  cellBoldRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cellOlive: { fontSize: 8, color: '#736F4C' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#dedad0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#a09c85' },
})

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => !n ? '—' : '$' + Math.round(n).toLocaleString()

const AR_BUCKETS = ['0-30', '30-60', '60-90', '90-120', '120+']
const AR_LABELS = { '0-30': 'Current (0-30 days)', '30-60': '30-60 Days', '60-90': '60-90 Days', '90-120': '90-120 Days', '120+': '120+ Days (Critical)' }
const AR_COLORS = { '0-30': '#3a7a4a', '30-60': '#736F4C', '60-90': '#BD6439', '90-120': '#c0392b', '120+': '#8B0000' }

function invAgeDays(inv) {
  const ino = String(inv.invoiceNo || '')
  if (ino.length >= 6) {
    const yr = +ino.slice(0, 4), mo = +ino.slice(4, 6)
    if (yr > 2000 && mo >= 1 && mo <= 12) {
      const d = new Date(yr, mo - 1, 1)
      d.setDate(d.getDate() + 30)
      return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
    }
  }
  return 0
}
const autoBucket = days => days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : days <= 120 ? '90-120' : '120+'
const effBucket = inv => inv.bucketOverride || autoBucket(invAgeDays(inv))

function invMonthLabel(inv) {
  const ino = String(inv.invoiceNo || '')
  if (ino.length >= 6) {
    const yr = ino.slice(0, 4), mo = +ino.slice(4, 6)
    if (+yr > 2000 && mo >= 1 && mo <= 12)
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1] + ' ' + yr
  }
  return inv.invoiceDate || '—'
}

const KpiCard = ({ label, value, color }) => (
  <View style={[S.kpiCard, { borderTopColor: color || '#BD6439' }]}>
    <Text style={S.kpiLabel}>{label}</Text>
    <Text style={[S.kpiValue, { color: color || '#BD6439' }]}>{value}</Text>
  </View>
)

const COLS = [
  { label: 'Invoice #',     flex: 0.8 },
  { label: 'Invoice Month', flex: 0.8 },
  { label: 'Client',        flex: 1.2 },
  { label: 'Project',       flex: 1.2 },
  { label: 'Amount',        flex: 1, right: true },
  { label: 'Notes',         flex: 1 },
]

// ── Main PDF Document ────────────────────────────────────────────────────────
export default function ARAgingPDF({ appState, pm, client, logo }) {
  const { invoices, settings } = appState

  const openInv = (invoices || []).filter(i => !i.paid && (client === 'ALL' || i.client === client))
  const grouped = {}
  AR_BUCKETS.forEach(b => { grouped[b] = [] })
  openInv.forEach(i => { const b = effBucket(i); if (grouped[b]) grouped[b].push(i) })

  const total = openInv.reduce((s, i) => s + (i.amount || 0), 0)
  const currentAmt = (grouped['0-30'] || []).reduce((s, i) => s + (i.amount || 0), 0)
  const pastDue = total - currentAmt

  const dt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const subtitle = `${pm === 'ALL' ? 'All PMs' : 'PM: ' + pm} · Outstanding as of ${dt}`
  const firmName = settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES'
  const useLogo = logo || settings.firm?.logo

  return (
    <Document>
      <Page size="A4" style={S.page} wrap>

        {/* Header */}
        <View style={S.headerRow} fixed>
          <View style={S.headerLeft}>
            {useLogo ? <Image src={useLogo} style={[S.logo, { marginRight: 10 }]} /> : null}
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
          <Text style={S.title}>A/R Aging Report</Text>
          <Text style={S.subtitle}>{subtitle}</Text>
        </View>

        {/* KPI row */}
        <View style={S.kpiRow}>
          <KpiCard label="Total Outstanding" value={fmt(total)} color="#3D3935" />
          <KpiCard label="Past Due (30+)" value={fmt(pastDue)} color="#c0392b" />
          <KpiCard label="Current (0-30)" value={fmt(currentAmt)} color="#3a7a4a" />
          <KpiCard label="Invoices" value={String(openInv.length)} color="#736F4C" />
        </View>

        {/* Table header */}
        <View style={S.tableHead} fixed>
          {COLS.map((c, i) => (
            <Text key={i} style={[S.tableHeadCell, { flex: c.flex || 1, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
          ))}
        </View>

        {/* Bucket groups */}
        {AR_BUCKETS.map(b => {
          const items = grouped[b]
          if (!items || !items.length) return null
          const bTotal = items.reduce((s, i) => s + (i.amount || 0), 0)
          const color = AR_COLORS[b]

          return (
            <View key={b}>
              {/* Bucket header */}
              <View style={[S.bucketHeader, { backgroundColor: color + '15' }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color, letterSpacing: 0.5 }}>
                  {AR_LABELS[b].toUpperCase()} — {items.length} invoice{items.length !== 1 ? 's' : ''} · {fmt(bTotal)}
                </Text>
              </View>

              {/* Invoice rows */}
              {items.sort((a, b2) => (b2.amount || 0) - (a.amount || 0)).map((inv, i) => (
                <View key={i} style={S.tableRow}>
                  <Text style={[S.cell, { flex: 0.8 }]}>{inv.invoiceNo || '—'}</Text>
                  <Text style={[S.cellOlive, { flex: 0.8 }]}>{invMonthLabel(inv)}</Text>
                  <Text style={[S.cellBold, { flex: 1.2 }]}>{inv.client}</Text>
                  <Text style={[S.cellOlive, { flex: 1.2 }]}>{inv.project || '—'}</Text>
                  <Text style={[S.cellBoldRight, { flex: 1, color: '#3D3935' }]}>{fmt(inv.amount)}</Text>
                  <Text style={[S.cellOlive, { flex: 1 }]}>{inv.status || '—'}</Text>
                </View>
              ))}
            </View>
          )
        })}

        {/* No invoices fallback */}
        {openInv.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#a09c85' }}>No outstanding invoices</Text>
          </View>
        )}

        {/* Total row */}
        <View style={S.totalRow}>
          <Text style={{ flex: 0.8 + 0.8 + 1.2 + 1.2, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#F5F5F1' }}>TOTAL OUTSTANDING</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }}>{fmt(total)}</Text>
          <Text style={{ flex: 1 }}></Text>
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
