import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page: { fontFamily:'Helvetica', fontSize:9, color:'#3D3935', backgroundColor:'#ffffff', paddingTop:32, paddingBottom:40, paddingHorizontal:36 },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, paddingBottom:12, borderBottomWidth:0.5, borderBottomColor:'#dedad0' },
  headerLeft: { flexDirection:'row', alignItems:'center' },
  logo: { width:36, height:36, borderRadius:4, marginRight:10 },
  firmName: { fontSize:11, fontFamily:'Helvetica-Bold', letterSpacing:1, color:'#3D3935' },
  firmSub: { fontSize:8, color:'#736F4C', letterSpacing:1, marginTop:2 },
  headerRight: { alignItems:'flex-end' },
  headerDate: { fontSize:8, color:'#a09c85' },
  headerConfidential: { fontSize:7, color:'#a09c85', marginTop:2, letterSpacing:0.5 },
  titleBlock: { marginTop:12, paddingBottom:10, borderBottomWidth:3, borderBottomColor:'#BD6439', marginBottom:16 },
  title: { fontSize:20, fontFamily:'Helvetica-Bold', color:'#3D3935', letterSpacing:0.5 },
  subtitle: { fontSize:9, color:'#736F4C', marginTop:3 },
  kpiRow: { flexDirection:'row', gap:8, marginBottom:16 },
  kpiCard: { flex:1, backgroundColor:'#F5F5F1', borderRadius:5, padding:10, borderTopWidth:3, borderTopColor:'#BD6439' },
  kpiLabel: { fontSize:7, color:'#736F4C', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 },
  kpiValue: { fontSize:16, fontFamily:'Helvetica-Bold', color:'#BD6439' },
  pmHeader: { flexDirection:'row', backgroundColor:'#3D3935', paddingVertical:6, paddingHorizontal:8, marginBottom:0 },
  pmHeaderText: { fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1', letterSpacing:0.5, flex:1 },
  pmHeaderAmt: { fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1', textAlign:'right' },
  projectBanner: { backgroundColor:'#F5F5F1', paddingVertical:4, paddingHorizontal:8, borderBottomWidth:0.5, borderBottomColor:'#dedad0' },
  phaseRow: { flexDirection:'row', paddingVertical:4, paddingHorizontal:8, borderBottomWidth:0.5, borderBottomColor:'rgba(61,57,53,0.06)', alignItems:'center' },
  phaseRowAlt: { flexDirection:'row', paddingVertical:4, paddingHorizontal:8, borderBottomWidth:0.5, borderBottomColor:'rgba(61,57,53,0.06)', backgroundColor:'rgba(236,234,227,0.3)', alignItems:'center' },
  pmTotalRow: { flexDirection:'row', paddingVertical:5, paddingHorizontal:8, backgroundColor:'#e9e5da', borderBottomWidth:1, borderBottomColor:'#3D3935', marginBottom:10 },
  grandTotalRow: { flexDirection:'row', paddingVertical:7, paddingHorizontal:8, backgroundColor:'#3D3935', marginTop:4 },
  colName: { flex:2.5, fontSize:8, color:'#3D3935' },
  colNameOlive: { flex:2.5, fontSize:8, color:'#736F4C' },
  colRight: { flex:1, fontSize:8, color:'#3D3935', textAlign:'right' },
  colRightOlive: { flex:1, fontSize:8, color:'#736F4C', textAlign:'right' },
  colRightTerra: { flex:1, fontSize:8, color:'#BD6439', textAlign:'right' },
  colRightBold: { flex:1, fontSize:8, fontFamily:'Helvetica-Bold', color:'#3D3935', textAlign:'right' },
  colRightWhite: { flex:1, fontSize:8, fontFamily:'Helvetica-Bold', color:'#F5F5F1', textAlign:'right' },
  colSm: { flex:0.7, fontSize:8, color:'#736F4C', textAlign:'center' },
  tableHead: { flexDirection:'row', backgroundColor:'#3D3935', paddingVertical:5, paddingHorizontal:8, borderRadius:3, marginBottom:1 },
  tableHeadCell: { fontSize:7, color:'#F5F5F1', fontFamily:'Helvetica-Bold', textTransform:'uppercase', letterSpacing:0.5 },
  footer: { position:'absolute', bottom:20, left:36, right:36, flexDirection:'row', justifyContent:'space-between', borderTopWidth:0.5, borderTopColor:'#dedad0', paddingTop:6 },
  footerText: { fontSize:7, color:'#a09c85' },
  wipBarOuter: { height:3, backgroundColor:'#ECEAE3', borderRadius:1.5, width:36 },
  wipBarInner: { height:3, backgroundColor:'#BD6439', borderRadius:1.5 },
})

const fmt = n => !n ? '—' : '$' + Math.round(n).toLocaleString()
const fmtK = n => !n ? '—' : Math.abs(n) >= 1e6 ? '$'+(Math.abs(n)/1e6).toFixed(2)+'M' : Math.abs(n) >= 1000 ? '$'+(Math.abs(n)/1000).toFixed(0)+'k' : '$'+Math.round(Math.abs(n))

const CONF_COLORS = { g:'#2d7a3a', y:'#b45309', r:'#c0392b' }
const CONF_LABELS = { g:'✓', y:'~', r:'!' }

export default function MonthlyBillingPDF({ appState, pm, client, mk, logo }) {
  const { projects, settings } = appState
  const monthlyGoal = settings.billing?.monthlyGoalOverrides?.[mk] || settings.billing?.monthlyGoal || 395000

  const [yr, mo] = mk.split('-').map(Number)
  const monthLabel = ['January','February','March','April','May','June','July','August','September','October','November','December'][mo-1] + ' ' + yr
  const dt = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  const firmName = settings.firm?.fullName || settings.firm?.name || 'JEFFREY DeMURE + ASSOCIATES'
  const useLogo = logo || settings.firm?.logo

  const active = projects.filter(p =>
    !p.archived &&
    (pm === 'ALL' || p.pm === pm) &&
    (client === 'ALL' || p.client === client)
  )

  // Build PM → project → phases with allocations for this month
  const pmGroups = {}
  const pmOrder = []
  active.forEach(p => {
    const phases = p.phases.filter(ph => (ph.monthly?.[mk] || 0) > 0)
    if (!phases.length) return
    if (!pmGroups[p.pm]) { pmGroups[p.pm] = []; pmOrder.push(p.pm) }
    pmGroups[p.pm].push({ ...p, filteredPhases: phases })
  })

  const grandTotal = pmOrder.reduce((s,k) => s + pmGroups[k].reduce((s2,p) => s2 + p.filteredPhases.reduce((s3,ph) => s3 + (ph.monthly?.[mk]||0), 0), 0), 0)
  const projectCount = pmOrder.reduce((s,k) => s + pmGroups[k].length, 0)
  const phaseCount = pmOrder.reduce((s,k) => s + pmGroups[k].reduce((s2,p) => s2 + p.filteredPhases.length, 0), 0)

  const subtitle = `${pm === 'ALL' ? 'All PMs' : 'PM: '+pm} · ${client === 'ALL' ? 'All Clients' : client}`

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
          <Text style={S.title}>Monthly Billing Report</Text>
          <Text style={S.subtitle}>{monthLabel} · {subtitle}</Text>
        </View>

        {/* KPIs */}
        <View style={S.kpiRow}>
          <View style={[S.kpiCard, { borderTopColor:'#BD6439' }]}>
            <Text style={S.kpiLabel}>Total Allocated</Text>
            <Text style={[S.kpiValue, { color:'#BD6439' }]}>{fmtK(grandTotal)}</Text>
          </View>
          <View style={[S.kpiCard, { borderTopColor:'#3D3935' }]}>
            <Text style={S.kpiLabel}>Monthly Goal</Text>
            <Text style={[S.kpiValue, { color:'#3D3935' }]}>{fmtK(monthlyGoal)}</Text>
          </View>
          <View style={[S.kpiCard, { borderTopColor: grandTotal >= monthlyGoal ? '#2d7a3a' : '#c0392b' }]}>
            <Text style={S.kpiLabel}>vs. Goal</Text>
            <Text style={[S.kpiValue, { color: grandTotal >= monthlyGoal ? '#2d7a3a' : '#c0392b' }]}>
              {grandTotal >= monthlyGoal ? '+' : ''}{fmtK(grandTotal - monthlyGoal)}
            </Text>
          </View>
          <View style={[S.kpiCard, { borderTopColor:'#736F4C' }]}>
            <Text style={S.kpiLabel}>Projects · Phases</Text>
            <Text style={[S.kpiValue, { color:'#736F4C' }]}>{projectCount} · {phaseCount}</Text>
          </View>
        </View>

        {/* Column header */}
        <View style={S.tableHead} fixed>
          <Text style={[S.tableHeadCell, { flex:2.5 }]}>Project / Phase</Text>
          <Text style={[S.tableHeadCell, { flex:0.7, textAlign:'center' }]}>Scope</Text>
          <Text style={[S.tableHeadCell, { flex:1, textAlign:'right' }]}>Phase Fee</Text>
          <Text style={[S.tableHeadCell, { flex:1, textAlign:'right' }]}>Remaining</Text>
          <Text style={[S.tableHeadCell, { flex:1, textAlign:'right' }]}>{mo < 10 ? '0' : ''}{mo}/{yr}</Text>
          <Text style={[S.tableHeadCell, { flex:0.7, textAlign:'right' }]}>% Alloc</Text>
          <Text style={[S.tableHeadCell, { flex:0.5, textAlign:'center' }]}>Conf</Text>
        </View>

        {/* PM groups */}
        {pmOrder.map(pmKey => {
          const pList = pmGroups[pmKey]
          const pmTotal = pList.reduce((s,p) => s + p.filteredPhases.reduce((s2,ph) => s2 + (ph.monthly?.[mk]||0), 0), 0)

          return (
            <View key={pmKey}>
              {/* PM header */}
              <View style={S.pmHeader}>
                <Text style={S.pmHeaderText}>PM: {pmKey.toUpperCase()} — {pList.length} project{pList.length !== 1 ? 's' : ''}</Text>
                <Text style={S.pmHeaderAmt}>{fmt(pmTotal)}</Text>
              </View>

              {/* Projects */}
              {pList.map(p => {
                const projTotal = p.filteredPhases.reduce((s,ph) => s + (ph.monthly?.[mk]||0), 0)
                return (
                  <View key={p.id}>
                    {/* Project banner */}
                    <View style={S.projectBanner}>
                      <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color:'#3D3935' }}>
                        {p.project}
                        <Text style={{ fontFamily:'Helvetica', color:'#736F4C' }}>  {p.client}  {p.pm}  {p.projNo ? '#'+p.projNo : ''}</Text>
                      </Text>
                    </View>

                    {/* Phase rows */}
                    {p.filteredPhases.map((ph, pi) => {
                      const phFee = ph.scope === 'CA' ? (ph.fee||0)*(ph.caMonths||12) : (ph.fee||0)
                      const phRem = Math.max(0, phFee - (ph.billed||0))
                      const moAmt = ph.monthly?.[mk] || 0
                      const allocPct = phFee > 0 ? Math.round(moAmt / phFee * 100) : 0
                      const conf = ph.billingConf?.[mk] || null
                      const RowStyle = pi % 2 === 1 ? S.phaseRowAlt : S.phaseRow
                      return (
                        <View key={ph.id} style={RowStyle}>
                          <Text style={[S.colNameOlive, { paddingLeft:10 }]}>{ph.name || '—'}</Text>
                          <Text style={S.colSm}>{ph.scope || '—'}</Text>
                          <Text style={S.colRightOlive}>{fmt(phFee)}</Text>
                          <Text style={S.colRightOlive}>{fmt(phRem)}</Text>
                          <Text style={[S.colRightBold, { color:'#BD6439' }]}>{fmt(moAmt)}</Text>
                          <View style={{ flex:0.7, flexDirection:'row', alignItems:'center', justifyContent:'flex-end' }}>
                            <View style={S.wipBarOuter}>
                              <View style={[S.wipBarInner, { width: Math.min(100,allocPct)+'%', backgroundColor: allocPct > 100 ? '#c0392b' : '#BD6439' }]} />
                            </View>
                            <Text style={{ fontSize:7, color:'#736F4C', marginLeft:3 }}>{allocPct}%</Text>
                          </View>
                          <Text style={{ flex:0.5, fontSize:9, textAlign:'center', color: conf ? CONF_COLORS[conf] : '#ECEAE3' }}>
                            {conf ? CONF_LABELS[conf] : '·'}
                          </Text>
                        </View>
                      )
                    })}

                    {/* Project subtotal */}
                    <View style={{ flexDirection:'row', paddingVertical:3, paddingHorizontal:8, backgroundColor:'#fafaf8', borderBottomWidth:1, borderBottomColor:'#dedad0' }}>
                      <Text style={{ flex:2.5, fontSize:7, color:'#736F4C', fontFamily:'Helvetica-Bold' }}>Project Total</Text>
                      <Text style={{ flex:0.7 }} />
                      <Text style={{ flex:1 }} />
                      <Text style={{ flex:1 }} />
                      <Text style={{ flex:1, fontSize:7, fontFamily:'Helvetica-Bold', color:'#BD6439', textAlign:'right' }}>{fmt(projTotal)}</Text>
                      <Text style={{ flex:0.7 }} />
                      <Text style={{ flex:0.5 }} />
                    </View>
                  </View>
                )
              })}

              {/* PM total */}
              <View style={S.pmTotalRow}>
                <Text style={{ flex:2.5, fontSize:8, fontFamily:'Helvetica-Bold', color:'#3D3935' }}>PM Total — {pmKey}</Text>
                <Text style={{ flex:0.7 }} />
                <Text style={{ flex:1 }} />
                <Text style={{ flex:1 }} />
                <Text style={{ flex:1, fontSize:8, fontFamily:'Helvetica-Bold', color:'#BD6439', textAlign:'right' }}>{fmt(pmTotal)}</Text>
                <Text style={{ flex:0.7 }} />
                <Text style={{ flex:0.5 }} />
              </View>
            </View>
          )
        })}

        {/* Grand total */}
        <View style={S.grandTotalRow}>
          <Text style={{ flex:2.5, fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1' }}>
            TOTAL — {projectCount} project{projectCount !== 1 ? 's' : ''} · {phaseCount} phase{phaseCount !== 1 ? 's' : ''}
          </Text>
          <Text style={{ flex:0.7 }} />
          <Text style={{ flex:1 }} />
          <Text style={{ flex:1 }} />
          <Text style={[S.colRightWhite, { fontSize:10 }]}>{fmt(grandTotal)}</Text>
          <Text style={{ flex:0.7 }} />
          <Text style={{ flex:0.5 }} />
        </View>

        {/* vs goal note */}
        <View style={{ flexDirection:'row', alignItems:'center', marginTop:6, gap:8 }}>
          <Text style={{ fontSize:8, color:'#736F4C' }}>vs. goal</Text>
          <View style={{ flex:1, height:4, backgroundColor:'#ECEAE3', borderRadius:2 }}>
            <View style={{ height:4, borderRadius:2, width: Math.min(100, grandTotal/monthlyGoal*100)+'%', backgroundColor: grandTotal >= monthlyGoal ? '#2d7a3a' : '#BD6439' }} />
          </View>
          <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color: grandTotal >= monthlyGoal ? '#2d7a3a' : '#BD6439' }}>
            {Math.round(grandTotal/monthlyGoal*100)}% of {fmtK(monthlyGoal)} goal
          </Text>
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
