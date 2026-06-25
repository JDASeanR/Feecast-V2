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
  titleBlock: { backgroundColor:'#3D3935', borderRadius:4, padding:'14px 16px', marginTop:12, marginBottom:16 },
  title: { fontSize:22, fontFamily:'Helvetica-Bold', color:'#F5F5F1', letterSpacing:0.5 },
  subtitle: { fontSize:9, color:'rgba(245,245,241,0.6)', marginTop:4 },
  titleAccent: { width:32, height:3, backgroundColor:'#BD6439', borderRadius:1.5, marginBottom:8 },
  kpiRow: { flexDirection:'row', gap:8, marginBottom:16 },
  kpiCard: { flex:1, backgroundColor:'#F5F5F1', borderRadius:5, padding:10, borderTopWidth:3 },
  kpiLabel: { fontSize:7, color:'#736F4C', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 },
  kpiValue: { fontSize:16, fontFamily:'Helvetica-Bold' },
  tableHead: { flexDirection:'row', backgroundColor:'#3D3935', paddingVertical:5, paddingHorizontal:8, borderRadius:3, marginBottom:1 },
  tableHeadCell: { fontSize:7, color:'#F5F5F1', fontFamily:'Helvetica-Bold', textTransform:'uppercase', letterSpacing:0.5 },
  pmHeader: { flexDirection:'row', backgroundColor:'#3D3935', paddingVertical:6, paddingHorizontal:8 },
  clientHeader: { flexDirection:'row', backgroundColor:'#736F4C', paddingVertical:4, paddingHorizontal:8 },
  projectBanner: { backgroundColor:'#ECEAE3', paddingVertical:5, paddingHorizontal:8, borderBottomWidth:1, borderBottomColor:'#dedad0' },
  phaseRow: { flexDirection:'row', paddingVertical:5, paddingHorizontal:8, borderBottomWidth:0.5, borderBottomColor:'rgba(61,57,53,0.1)', alignItems:'center', backgroundColor:'#ffffff' },
  phaseRowAlt: { flexDirection:'row', paddingVertical:5, paddingHorizontal:8, borderBottomWidth:0.5, borderBottomColor:'rgba(61,57,53,0.1)', backgroundColor:'#F5F5F1', alignItems:'center' },
  clientTotalRow: { flexDirection:'row', paddingVertical:4, paddingHorizontal:8, backgroundColor:'#ECEAE3', borderBottomWidth:1, borderBottomColor:'#736F4C' },
  grandTotalRow: { flexDirection:'row', paddingVertical:7, paddingHorizontal:8, backgroundColor:'#3D3935', marginTop:4 },
  footer: { position:'absolute', bottom:20, left:36, right:36, flexDirection:'row', justifyContent:'space-between', borderTopWidth:0.5, borderTopColor:'#dedad0', paddingTop:6 },
  footerText: { fontSize:7, color:'#a09c85' },
  wipBarOuter: { height:3, backgroundColor:'#ECEAE3', borderRadius:1.5, width:40 },
  wipBarInner: { height:3, backgroundColor:'#BD6439', borderRadius:1.5 },
})

const fmt  = n => !n ? '—' : '$' + Math.round(n).toLocaleString()
const fmtK = n => !n ? '—' : Math.abs(n) >= 1e6 ? '$'+(Math.abs(n)/1e6).toFixed(2)+'M' : Math.abs(n) >= 1000 ? '$'+(Math.abs(n)/1000).toFixed(0)+'k' : '$'+Math.round(Math.abs(n))

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

  // Build PM → Client → [projects] hierarchy
  const pmGroups = {}
  const pmOrder = []
  active.forEach(p => {
    const phases = p.phases.filter(ph => (ph.monthly?.[mk] || 0) > 0)
    if (!phases.length) return
    const pmKey = p.pm || '—'
    const clientKey = p._client || p.client || '—'
    if (!pmGroups[pmKey]) { pmGroups[pmKey] = {}; pmOrder.push(pmKey) }
    if (!pmGroups[pmKey][clientKey]) pmGroups[pmKey][clientKey] = []
    pmGroups[pmKey][clientKey].push({ ...p, filteredPhases: phases })
  })

  const grandTotal = pmOrder.reduce((s,k) =>
    s + Object.values(pmGroups[k]).flat().reduce((s2,p) =>
      s2 + p.filteredPhases.reduce((s3,ph) => s3 + (ph.monthly?.[mk]||0), 0), 0), 0)
  const projectCount = pmOrder.reduce((s,k) => s + Object.values(pmGroups[k]).flat().length, 0)
  const phaseCount   = pmOrder.reduce((s,k) => s + Object.values(pmGroups[k]).flat().reduce((s2,p) => s2 + p.filteredPhases.length, 0), 0)
  const subtitle = `${pm === 'ALL' ? 'All PMs' : 'PM: '+pm} · ${client === 'ALL' ? 'All Clients' : client}`

  // Column flex widths (no conf column)
  const C = { name:2.8, scope:0.65, fee:1, rem:1, mo:1, pct:0.8 }

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

        {/* Title banner — graphite */}
        <View style={S.titleBlock}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:7, color:'rgba(245,245,241,0.4)', letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>
                JEFFREY DeMURE + ASSOCIATES · ARCHITECTS · PLANNERS
              </Text>
              <View style={S.titleAccent} />
              <Text style={S.title}>Monthly Billing Report</Text>
              <Text style={S.subtitle}>{monthLabel} · {subtitle}</Text>
            </View>
            <View style={{ alignItems:'flex-end', gap:6 }}>
              {useLogo && <Image src={useLogo} style={{ width:44, height:44, borderRadius:4, opacity:0.85 }} />}
              <Text style={{ fontSize:7, color:'rgba(245,245,241,0.4)', textAlign:'right' }}>{dt} · CONFIDENTIAL</Text>
            </View>
          </View>
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
          <Text style={[S.tableHeadCell, { flex:C.name }]}>Project / Phase</Text>
          <Text style={[S.tableHeadCell, { flex:C.scope, textAlign:'center' }]}>Scope</Text>
          <Text style={[S.tableHeadCell, { flex:C.fee, textAlign:'right' }]}>Phase Fee</Text>
          <Text style={[S.tableHeadCell, { flex:C.rem, textAlign:'right' }]}>Remaining</Text>
          <Text style={[S.tableHeadCell, { flex:C.mo, textAlign:'right' }]}>{String(mo).padStart(2,'0')}/{yr}</Text>
          <Text style={[S.tableHeadCell, { flex:C.pct, textAlign:'right' }]}>% Alloc</Text>
        </View>

        {/* PM → Client → Project groups */}
        {pmOrder.map(pmKey => {
          const clientMap = pmGroups[pmKey]
          const clientOrder = Object.keys(clientMap)
          const pmTotal = clientOrder.reduce((s,ck) =>
            s + clientMap[ck].reduce((s2,p) =>
              s2 + p.filteredPhases.reduce((s3,ph) => s3 + (ph.monthly?.[mk]||0), 0), 0), 0)

          return (
            <View key={pmKey}>
              {/* PM header */}
              <View style={S.pmHeader}>
                <Text style={{ flex:1, fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1', letterSpacing:0.5 }}>
                  PM: {pmKey.toUpperCase()}
                </Text>
                <Text style={{ fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1' }}>{fmt(pmTotal)}</Text>
              </View>

              {clientOrder.map(clientKey => {
                const pList = clientMap[clientKey]
                const clientTotal = pList.reduce((s,p) =>
                  s + p.filteredPhases.reduce((s2,ph) => s2 + (ph.monthly?.[mk]||0), 0), 0)

                return (
                  <View key={clientKey}>
                    {/* Client header */}
                    <View style={S.clientHeader}>
                      <Text style={{ flex:1, fontSize:8, fontFamily:'Helvetica-Bold', color:'#F5F5F1', letterSpacing:0.5 }}>
                        {clientKey.toUpperCase()}
                      </Text>
                      <Text style={{ fontSize:8, color:'rgba(245,245,241,0.65)' }}>{pList.length} project{pList.length !== 1 ? 's' : ''}</Text>
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
                              <Text style={{ fontFamily:'Helvetica', color:'#a09c85' }}>
                                {p.projNo ? '  #'+p.projNo : ''}  {p.pm}
                              </Text>
                            </Text>
                          </View>

                          {/* Phase rows */}
                          {p.filteredPhases.map((ph, pi) => {
                            const phFee = ph.scope === 'CA' ? (ph.fee||0)*(ph.caMonths||12) : (ph.fee||0)
                            const phRem = Math.max(0, phFee - (ph.billed||0))
                            const moAmt = ph.monthly?.[mk] || 0
                            const allocPct = phFee > 0 ? Math.round(moAmt / phFee * 100) : 0
                            const rowStyle = pi % 2 === 1 ? S.phaseRowAlt : S.phaseRow
                            return (
                              <View key={ph.id} style={rowStyle}>
                                <Text style={{ flex:C.name, fontSize:8, color:'#736F4C', paddingLeft:10 }}>{ph.name || '—'}</Text>
                                <Text style={{ flex:C.scope, fontSize:8, color:'#736F4C', textAlign:'center' }}>{ph.scope || '—'}</Text>
                                <Text style={{ flex:C.fee, fontSize:8, color:'#736F4C', textAlign:'right' }}>{fmt(phFee)}</Text>
                                <Text style={{ flex:C.rem, fontSize:8, color:'#736F4C', textAlign:'right' }}>{fmt(phRem)}</Text>
                                <Text style={{ flex:C.mo, fontSize:8, fontFamily:'Helvetica-Bold', color:'#BD6439', textAlign:'right' }}>{fmt(moAmt)}</Text>
                                <View style={{ flex:C.pct, flexDirection:'row', alignItems:'center', justifyContent:'flex-end' }}>
                                  <View style={S.wipBarOuter}>
                                    <View style={[S.wipBarInner, { width:Math.min(100,allocPct)+'%', backgroundColor:allocPct>100?'#c0392b':'#BD6439' }]} />
                                  </View>
                                  <Text style={{ fontSize:7, color:'#736F4C', marginLeft:3 }}>{allocPct}%</Text>
                                </View>
                              </View>
                            )
                          })}

                          {/* Project subtotal */}
                          <View style={{ flexDirection:'row', paddingVertical:3, paddingHorizontal:8, backgroundColor:'#fafaf8', borderBottomWidth:0.5, borderBottomColor:'#dedad0' }}>
                            <Text style={{ flex:C.name, fontSize:7, color:'#736F4C', fontFamily:'Helvetica-Bold' }}>Project Total</Text>
                            <Text style={{ flex:C.scope+C.fee+C.rem }} />
                            <Text style={{ flex:C.mo, fontSize:7, fontFamily:'Helvetica-Bold', color:'#BD6439', textAlign:'right' }}>{fmt(projTotal)}</Text>
                            <Text style={{ flex:C.pct }} />
                          </View>
                        </View>
                      )
                    })}

                    {/* Client total */}
                    <View style={S.clientTotalRow}>
                      <Text style={{ flex:1, fontSize:7, fontFamily:'Helvetica-Bold', color:'#736F4C' }}>Client Total — {clientKey}</Text>
                      <Text style={{ fontSize:7, fontFamily:'Helvetica-Bold', color:'#BD6439' }}>{fmt(clientTotal)}</Text>
                    </View>
                  </View>
                )
              })}

              {/* PM spacer */}
              <View style={{ height:10 }} />
            </View>
          )
        })}

        {/* Grand total */}
        <View style={S.grandTotalRow}>
          <Text style={{ flex:1, fontSize:9, fontFamily:'Helvetica-Bold', color:'#F5F5F1' }}>
            TOTAL — {projectCount} project{projectCount !== 1 ? 's' : ''} · {phaseCount} phase{phaseCount !== 1 ? 's' : ''}
          </Text>
          <Text style={{ fontSize:10, fontFamily:'Helvetica-Bold', color:'#F5F5F1' }}>{fmt(grandTotal)}</Text>
        </View>

        {/* vs goal bar */}
        <View style={{ flexDirection:'row', alignItems:'center', marginTop:6, marginRight:0 }}>
          <Text style={{ fontSize:8, color:'#736F4C', marginRight:8 }}>vs. goal</Text>
          <View style={{ flex:1, height:4, backgroundColor:'#ECEAE3', borderRadius:2 }}>
            <View style={{ height:4, borderRadius:2, width:Math.min(100,grandTotal/monthlyGoal*100)+'%', backgroundColor:grandTotal>=monthlyGoal?'#2d7a3a':'#BD6439' }} />
          </View>
          <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color:grandTotal>=monthlyGoal?'#2d7a3a':'#BD6439', marginLeft:8 }}>
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
