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
  tableHead: { flexDirection: 'row', backgroundColor: '#3D3935', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3 },
  tableHeadCell: { fontSize: 7, color: '#F5F5F1', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupHeader: { flexDirection: 'row', backgroundColor: '#3D3935', paddingVertical: 6, paddingHorizontal: 8 },
  groupHeaderText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', letterSpacing: 0.5 },
  projectBanner: { backgroundColor: '#F5F5F1', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: '#dedad0' },
  phaseRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.06)' },
  projectTotalRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fafaf8', borderBottomWidth: 1, borderBottomColor: '#dedad0' },
  groupTotalRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#e9e5da', borderBottomWidth: 2, borderBottomColor: '#3D3935' },
  grandTotalRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: '#3D3935' },
  cell: { fontSize: 8, color: '#3D3935' },
  cellRight: { fontSize: 8, color: '#3D3935', textAlign: 'right' },
  cellBold: { fontSize: 8, color: '#3D3935', fontFamily: 'Helvetica-Bold' },
  cellBoldRight: { fontSize: 8, color: '#3D3935', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cellOlive: { fontSize: 8, color: '#736F4C' },
  cellOliveRight: { fontSize: 8, color: '#736F4C', textAlign: 'right' },
  cellTerra: { fontSize: 8, color: '#BD6439', textAlign: 'right' },
  cellSmall: { fontSize: 7, color: '#736F4C' },
  cellSmallRight: { fontSize: 7, color: '#736F4C', textAlign: 'right' },
  cellDone: { fontSize: 7, color: '#3a7a4a' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#dedad0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#a09c85' },
})

// ── Column defs ──────────────────────────────────────────────────────────────
const COLS = [
  { label: 'Project / Phase', flex: 2 },
  { label: 'Scope',           flex: 0.5, right: true },
  { label: 'Fee',             flex: 1,   right: true },
  { label: 'Prior Billed',    flex: 1,   right: true },
  { label: 'YTD',             flex: 1,   right: true },
  { label: 'Remaining',       flex: 1,   right: true },
  { label: 'WIP',             flex: 0.6, right: true },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => !n ? '—' : '$' + Math.round(n).toLocaleString()
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0

const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1

const phCAEst = ph => ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : 0
const phFeeFC = ph => ph.scope === 'CA' ? phCAEst(ph) : (ph.fee || 0)
function phYTD(ph) { let s = 0; for (let m = 1; m < CM; m++) { const mk = `${CY}-${String(m).padStart(2, '0')}`; s += ph.monthly?.[mk] || 0; } return s; }
const pFee = p => (p.phases || []).reduce((s, ph) => s + phFeeFC(ph), 0)
const pBil = p => (p.phases || []).reduce((s, ph) => s + (ph.billed || 0), 0)
const pYTD = p => (p.phases || []).reduce((s, ph) => s + phYTD(ph), 0)
const pRem = p => pFee(p) - pBil(p) - pYTD(p)

// ── Main PDF Document ────────────────────────────────────────────────────────
export default function ProjectStatusPDF({ appState, pm, client, fromMk, toMk, logo }) {
  const { projects, settings } = appState
  const hideDone = appState.rHideDone || false
  const sortBy = appState.rSort || 'pm'

  let filtered = projects.filter(p =>
    !p.archived &&
    (pm === 'ALL' || p.pm === pm) &&
    (client === 'ALL' || p.client === client)
  )
  if (hideDone) filtered = filtered.filter(p => !p.done)

  const subtitle = `${pm === 'ALL' ? 'All PMs' : 'PM: ' + pm} · ${client === 'ALL' ? 'All Clients' : client} · Sorted by ${sortBy === 'pm' ? 'PM' : 'Client'}`
  const dt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const firmName = settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES'
  const useLogo = logo || settings.firm?.logo

  // Group
  const groups = {}
  const groupOrder = []
  filtered
    .sort((a, b) => sortBy === 'pm'
      ? (a.pm + a.project).localeCompare(b.pm + b.project)
      : (a.client + a.project).localeCompare(b.client + b.project))
    .forEach(p => {
      const k = sortBy === 'pm' ? (p.pm || '—') : (p._client || p.client || '—')
      if (!groups[k]) { groups[k] = []; groupOrder.push(k) }
      groups[k].push(p)
    })

  let grandFee = 0, grandBilled = 0, grandYtd = 0, grandRem = 0

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
          <Text style={S.title}>Project Status Report</Text>
          <Text style={S.subtitle}>{subtitle}</Text>
        </View>

        {/* Table header */}
        <View style={S.tableHead} fixed>
          {COLS.map((c, i) => (
            <Text key={i} style={[S.tableHeadCell, { flex: c.flex || 1, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
          ))}
        </View>

        {/* Groups */}
        {groupOrder.map(k => {
          const gps = groups[k]
          const gFee = gps.reduce((s, p) => s + pFee(p), 0)
          const gBil = gps.reduce((s, p) => s + pBil(p), 0)
          const gYtd = gps.reduce((s, p) => s + pYTD(p), 0)
          const gRem = gps.reduce((s, p) => s + pRem(p), 0)
          const gWip = pct(gBil + gYtd, gFee)
          grandFee += gFee; grandBilled += gBil; grandYtd += gYtd; grandRem += gRem

          return (
            <View key={k}>
              {/* Group header */}
              <View style={S.groupHeader}>
                <Text style={S.groupHeaderText}>
                  {sortBy === 'pm' ? 'PM' : 'CLIENT'}: {k.toUpperCase()} — {gps.length} project{gps.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Projects */}
              {gps.map(p => {
                const fee = pFee(p), billed = pBil(p), ytd = pYTD(p), rem = pRem(p)
                const wip = pct(billed + ytd, fee)
                let phases = p.phases || []
                if (hideDone) phases = phases.filter(ph => !ph.done)

                return (
                  <View key={p.id || p.project}>
                    {/* Project header — full-width banner */}
                    <View style={S.projectBanner}>
                      <Text style={S.cellBold}>{p.project}   <Text style={S.cellSmall}>{p.client}   {p.pm}   {p.projNo ? '#' + p.projNo : ''}{p.done ? '   Done' : ''}</Text></Text>
                    </View>

                    {/* Phase rows */}
                    {phases.map((ph, pi) => {
                      const phFee = phFeeFC(ph), phBilled = ph.billed || 0, phYtd = phYTD(ph)
                      const phRem2 = Math.max(0, phFee - phBilled - phYtd)
                      const phWip = pct(phBilled + phYtd, phFee)
                      return (
                        <View key={pi} style={S.phaseRow}>
                          <Text style={[S.cellOlive, { flex: 2, paddingLeft: 12, fontSize: 7 }]}>{ph.name || '—'}</Text>
                          <Text style={[S.cellSmallRight, { flex: 0.5 }]}>{ph.scope || '—'}</Text>
                          <Text style={[S.cellSmallRight, { flex: 1, color: '#3D3935' }]}>{fmt(phFee)}</Text>
                          <Text style={[S.cellSmallRight, { flex: 1 }]}>{fmt(phBilled)}</Text>
                          <Text style={[S.cellSmallRight, { flex: 1, color: '#BD6439' }]}>{fmt(phYtd)}</Text>
                          <Text style={[S.cellSmallRight, { flex: 1, fontFamily: ph.done ? 'Helvetica' : 'Helvetica-Bold', color: '#3D3935' }]}>{fmt(phRem2)}</Text>
                          <Text style={[S.cellSmallRight, { flex: 0.6 }]}>
                            {ph.done ? 'Done' : phWip + '%'}
                          </Text>
                        </View>
                      )
                    })}

                    {/* Project total */}
                    <View style={S.projectTotalRow}>
                      <Text style={[S.cellBold, { flex: 2, fontSize: 7, color: '#736F4C' }]}>Project Total</Text>
                      <Text style={{ flex: 0.5 }}></Text>
                      <Text style={[S.cellBoldRight, { flex: 1, fontSize: 7 }]}>{fmt(fee)}</Text>
                      <Text style={[S.cellSmallRight, { flex: 1 }]}>{fmt(billed)}</Text>
                      <Text style={[S.cellSmallRight, { flex: 1, color: '#BD6439' }]}>{fmt(ytd)}</Text>
                      <Text style={[S.cellBoldRight, { flex: 1, fontSize: 7 }]}>{fmt(rem)}</Text>
                      <Text style={[S.cellBoldRight, { flex: 0.6, fontSize: 7 }]}>{wip}%</Text>
                    </View>
                  </View>
                )
              })}

              {/* Group total */}
              <View style={S.groupTotalRow}>
                <Text style={[S.cellBold, { flex: 2, fontSize: 7 }]}>{sortBy === 'pm' ? 'PM' : 'Client'} Total — {k}</Text>
                <Text style={{ flex: 0.5 }}></Text>
                <Text style={[S.cellBoldRight, { flex: 1, fontSize: 7 }]}>{fmt(gFee)}</Text>
                <Text style={[S.cellSmallRight, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>{fmt(gBil)}</Text>
                <Text style={[S.cellSmallRight, { flex: 1, color: '#BD6439', fontFamily: 'Helvetica-Bold' }]}>{fmt(gYtd)}</Text>
                <Text style={[S.cellBoldRight, { flex: 1, fontSize: 7 }]}>{fmt(gRem)}</Text>
                <Text style={[S.cellBoldRight, { flex: 0.6, fontSize: 7 }]}>{gWip}%</Text>
              </View>
            </View>
          )
        })}

        {/* Grand total */}
        {groupOrder.length > 1 && (() => {
          const grandWip = pct(grandBilled + grandYtd, grandFee)
          return (
            <View style={S.grandTotalRow}>
              <Text style={[{ flex: 2, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#F5F5F1' }]}>
                GRAND TOTAL — {filtered.length} project{filtered.length !== 1 ? 's' : ''}
              </Text>
              <Text style={{ flex: 0.5 }}></Text>
              <Text style={[{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }]}>{fmt(grandFee)}</Text>
              <Text style={[{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }]}>{fmt(grandBilled)}</Text>
              <Text style={[{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#f8c4a0', textAlign: 'right' }]}>{fmt(grandYtd)}</Text>
              <Text style={[{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }]}>{fmt(grandRem)}</Text>
              <Text style={[{ flex: 0.6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F5F5F1', textAlign: 'right' }]}>{grandWip}%</Text>
            </View>
          )
        })()}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>JD+A Project Tracker · Confidential</Text>
          <Text style={S.footerText}>Generated {new Date().toLocaleString()}</Text>
        </View>

      </Page>
    </Document>
  )
}
