import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const T = '#BD6439'
const D = '#3D3935'
const O = '#736F4C'
const S = '#ECEAE3'
const W = '#F5F5F1'

const PILL_COLORS = ['#2A5F44','#1E4A7A','#7A4A1A','#4A2A7A','#1A5F6B','#7A1A1A','#3D6B1F','#6B4A1A','#4A5F1F','#1F4A5F']
function scopeColor(code, scopeTypes) {
  if (!scopeTypes?.length) return PILL_COLORS[0]
  const idx = scopeTypes.findIndex(s => s.code === code)
  return PILL_COLORS[Math.max(0, idx) % PILL_COLORS.length]
}

const fmtD = n => !n ? '$0' : '$' + Math.round(n).toLocaleString()
const fmtP = n => Math.round(n || 0) + '%'

const C = { service: 2.6, contract: 1, prev: 1.15, cur: 1.15, total: 1.15, rem: 1.15 }

// Density tiers: compress spacing to keep invoice on one page.
// n = lineItems.length + 2 if notes present.
// Tier breakpoints: ≤6 | ≤10 | ≤13 | 14+
const DENSITY = [
  { // tier 0 — ≤6 effective phases — near-full design
    phPadV:6, pillH:20, phFsz:8.5, pctFsz:7, logoSz:108,
    infoMB:13, metaMB:11, divMY:10, thPadV:5, totPadV:7,
    sumMT:13, sumGap:17, noteMT:11, barH:16, progMB:10,
    showProgLabels:true, invTitleFsz:19, invTitleMB:9, billToFsz:11, amtFsz:20,
  },
  { // tier 1 — 7-10 — light compression
    phPadV:4, pillH:18, phFsz:8, pctFsz:6.5, logoSz:96,
    infoMB:9, metaMB:8, divMY:7, thPadV:4, totPadV:6,
    sumMT:9, sumGap:13, noteMT:8, barH:14, progMB:7,
    showProgLabels:true, invTitleFsz:17, invTitleMB:7, billToFsz:10, amtFsz:18,
  },
  { // tier 2 — 11-13 — medium compression
    phPadV:2, pillH:14, phFsz:7.5, pctFsz:6, logoSz:82,
    infoMB:6, metaMB:5, divMY:5, thPadV:3, totPadV:4,
    sumMT:6, sumGap:9, noteMT:5, barH:12, progMB:4,
    showProgLabels:false, invTitleFsz:14, invTitleMB:5, billToFsz:9, amtFsz:15,
  },
  { // tier 3 — 14+ — tight
    phPadV:1, pillH:12, phFsz:7, pctFsz:5.5, logoSz:67,
    infoMB:4, metaMB:4, divMY:3, thPadV:2, totPadV:2,
    sumMT:4, sumGap:6, noteMT:4, barH:10, progMB:3,
    showProgLabels:false, invTitleFsz:13, invTitleMB:4, billToFsz:8, amtFsz:13,
  },
]

const styles = StyleSheet.create({
  page: { fontFamily:'Helvetica', fontSize:9, color:D, backgroundColor:'#ffffff',
    paddingTop:28, paddingBottom:84, paddingHorizontal:32 },

  headerRow: { flexDirection:'row', alignItems:'center', marginBottom:5 },
  headerLine: { flex:1, height:1.5, backgroundColor:T },

  infoRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  infoLeft:  { width:160 },
  infoCenter:{ flex:1 },
  infoRight: { width:150, alignItems:'flex-end' },
  infoAddr:  { fontSize:6.5, color:T, fontFamily:'Helvetica-Bold', letterSpacing:0.1, lineHeight:1.6 },

  billToCol: { flex:1, paddingRight:12 },
  sectionLabel: { fontSize:7, color:T, fontFamily:'Helvetica-Bold', letterSpacing:1.2, marginBottom:4 },
  billToText:   { fontSize:8, color:D, lineHeight:1.55 },

  invoiceMetaCol: { width:228 },
  metaRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:3.5,
    borderBottomWidth:0.5, borderBottomColor:S },
  metaKey:      { fontSize:7, color:O, letterSpacing:0.5 },
  metaVal:      { fontSize:8, fontFamily:'Helvetica-Bold', textAlign:'right' },
  metaValOrange:{ fontSize:8, fontFamily:'Helvetica-Bold', textAlign:'right', color:T },

  sectionTitle: { fontSize:10, fontFamily:'Helvetica-Bold', letterSpacing:1.5, marginBottom:7 },

  tableHead:{ flexDirection:'row', backgroundColor:D, paddingHorizontal:6 },
  thCell:   { fontSize:6.5, color:'#ffffff', fontFamily:'Helvetica-Bold', letterSpacing:0.4 },
  thCellC:  { fontSize:6.5, color:'#ffffff', fontFamily:'Helvetica-Bold', letterSpacing:0.4, textAlign:'center' },

  phRow:    { flexDirection:'row', paddingHorizontal:6, borderBottomWidth:0.5,
    borderBottomColor:'rgba(61,57,53,0.1)', alignItems:'center', backgroundColor:'#ffffff' },
  phRowAlt: { flexDirection:'row', paddingHorizontal:6, borderBottomWidth:0.5,
    borderBottomColor:'rgba(61,57,53,0.1)', alignItems:'center', backgroundColor:W },
  totalRow: { flexDirection:'row', paddingHorizontal:6, backgroundColor:S,
    borderTopWidth:1.5, borderTopColor:D, alignItems:'center' },

  pillTxt: { fontSize:5.5, color:'#ffffff', fontFamily:'Helvetica-Bold', letterSpacing:0.2 },

  valCell:      { alignItems:'center' },
  valPct:       { color:O },
  valPctOrange: { color:T },
  valPctGreen:  { color:'#2D6B4A' },
  valAmt:       { fontFamily:'Helvetica-Bold' },
  valAmtOrange: { fontFamily:'Helvetica-Bold', color:T },
  valAmtGreen:  { fontFamily:'Helvetica-Bold', color:'#2D6B4A' },

  summaryLeft: { flex:1 },
  summaryRight:{ flex:1 },
  summaryTitle:{ fontSize:7.5, color:T, fontFamily:'Helvetica-Bold', letterSpacing:0.8, marginBottom:6 },
  summaryLine: { flexDirection:'row', justifyContent:'space-between', paddingVertical:2.5 },
  summaryLabel:      { fontSize:7.5, color:D },
  summaryLabelBold:  { fontSize:8, fontFamily:'Helvetica-Bold', color:D },
  summaryLabelOrange:{ fontSize:8, fontFamily:'Helvetica-Bold', color:T },
  summaryVal:        { fontSize:7.5, color:D },
  summaryValBold:    { fontSize:8, fontFamily:'Helvetica-Bold', color:D },
  summaryValOrange:  { fontSize:8, fontFamily:'Helvetica-Bold', color:T },
  summarySep: { borderTopWidth:0.5, borderTopColor:D, marginVertical:3 },

  progressItem: { alignItems:'center' },
  progPct: { fontSize:9.5, fontFamily:'Helvetica-Bold', marginBottom:1 },
  progAmt: { fontSize:6.5, color:O },
  progLbl: { fontSize:5.5, color:O, letterSpacing:0.5, marginTop:1 },

  amountRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingTop:8, borderTopWidth:1, borderTopColor:S },
  amountLabel:  { fontSize:7.5, color:T, fontFamily:'Helvetica-Bold', letterSpacing:0.8, marginBottom:2 },
  dueDateLabel: { fontSize:7, color:O, letterSpacing:0.5, marginBottom:3 },
  dueDateValue: { fontSize:11, fontFamily:'Helvetica-Bold', color:D },

  notesTitle: { fontSize:7, color:T, fontFamily:'Helvetica-Bold', letterSpacing:0.8, marginBottom:3 },
  notesText:  { fontSize:7.5, color:D, lineHeight:1.5 },

  footer: { position:'absolute', bottom:18, left:32, right:32 },
  footerBrandLine: { borderTopWidth:1.5, borderTopColor:T, marginBottom:8 },
  footerRow:  { flexDirection:'row' },
  footerCol:  { flex:1, paddingRight:8 },
  footerTitle:{ fontSize:6.5, color:T, fontFamily:'Helvetica-Bold', letterSpacing:0.8, marginBottom:3 },
  footerText: { fontSize:7, color:D, lineHeight:1.5 },
  footerBrand:{ textAlign:'center', fontSize:6.5, color:T, fontFamily:'Helvetica-Bold',
    letterSpacing:1.5, marginTop:10 },
})

export default function InvoicePDF({ data }) {
  const {
    project, client, invoiceNo, invoiceDate, servicesThrough,
    paymentTerms, dueDate, lineItems, totals, firm, banking, logo, scopeTypes, notes,
  } = data

  const {
    totalContract, totalPrev, totalPrevPct, totalCur, totalCurPct,
    totalBilled, totalBilledPct, totalRem, totalRemPct,
  } = totals

  // Notes add ~3 phases of vertical space
  const n = lineItems.length + (notes ? 3 : 0)
  const den = DENSITY[n <= 6 ? 0 : n <= 10 ? 1 : n <= 13 ? 2 : 3]
  const {
    phPadV, pillH, phFsz, pctFsz, logoSz,
    infoMB, metaMB, divMY, thPadV, totPadV,
    sumMT, sumGap, noteMT, barH, progMB,
    showProgLabels, invTitleFsz, invTitleMB, billToFsz, amtFsz,
  } = den

  const prevFlex = Math.max(0.1, totalPrevPct)
  const curFlex  = Math.max(0.1, totalCurPct)
  const remFlex  = Math.max(0.1, Math.max(0, 100 - totalBilledPct))

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* Header: lines flanking logo */}
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          {logo
            ? <Image src={logo} style={{ width:logoSz, height:logoSz, marginHorizontal:14 }} />
            : <View style={{ width:logoSz, height:logoSz, marginHorizontal:14 }} />}
          <View style={styles.headerLine} />
        </View>

        {/* Firm contact info — logo already contains firm name/tagline */}
        <View style={[styles.infoRow, { marginBottom:infoMB }]}>
          <View style={styles.infoLeft}>
            {firm.address1 ? <Text style={styles.infoAddr}>{firm.address1.toUpperCase()}</Text> : null}
            {firm.address2 ? <Text style={styles.infoAddr}>{firm.address2.toUpperCase()}</Text> : null}
          </View>
          <View style={styles.infoCenter} />
          <View style={styles.infoRight}>
            {firm.phone   ? <Text style={styles.infoAddr}>{firm.phone}</Text> : null}
            {firm.website ? <Text style={styles.infoAddr}>{firm.website.toUpperCase()}</Text> : null}
          </View>
        </View>

        <View style={{ height:0.5, backgroundColor:'#dedad0', marginVertical:divMY }} />

        {/* Bill To / Invoice Meta */}
        <View style={{ flexDirection:'row', marginBottom:metaMB }}>
          <View style={styles.billToCol}>
            <Text style={styles.sectionLabel}>BILL TO</Text>
            <Text style={{ fontSize:billToFsz, fontFamily:'Helvetica-Bold', color:D, marginBottom:3, lineHeight:1.3 }}>
              {client.name || '—'}
            </Text>
            {client.address1 ? <Text style={styles.billToText}>{client.address1}</Text> : null}
            {client.address2 ? <Text style={styles.billToText}>{client.address2}</Text> : null}

            <Text style={[styles.sectionLabel, { marginTop:12 }]}>PROJECT</Text>
            <Text style={{ fontSize:billToFsz, fontFamily:'Helvetica-Bold', color:D, marginBottom:3, lineHeight:1.3 }}>
              {project.name}
            </Text>
            {project.projNo ? <Text style={styles.billToText}>Project No.  {project.projNo}</Text> : null}
          </View>

          <View style={styles.invoiceMetaCol}>
            <Text style={{ fontSize:invTitleFsz, fontFamily:'Helvetica-Bold', letterSpacing:4, color:D,
              textAlign:'right', marginBottom:invTitleMB }}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>INVOICE NO.</Text>
              <Text style={styles.metaValOrange}>{invoiceNo}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>INVOICE DATE</Text>
              <Text style={styles.metaVal}>{invoiceDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>SERVICES THROUGH</Text>
              <Text style={styles.metaVal}>{servicesThrough}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>PROJECT MANAGER</Text>
              <Text style={styles.metaVal}>{project.pm || '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>PAYMENT TERMS</Text>
              <Text style={styles.metaVal}>{paymentTerms || 'Net 30 Days'}</Text>
            </View>
            <View style={[styles.metaRow, { borderBottomWidth:0 }]}>
              <Text style={styles.metaKey}>DUE DATE</Text>
              <Text style={styles.metaVal}>{dueDate}</Text>
            </View>
          </View>
        </View>

        <View style={{ height:0.5, backgroundColor:'#dedad0', marginVertical:divMY }} />

        {/* Phase table */}
        <Text style={styles.sectionTitle}>PROFESSIONAL SERVICES</Text>

        <View style={[styles.tableHead, { paddingVertical:thPadV }]}>
          <View style={{ flex:C.service }}>
            <Text style={styles.thCell}>PHASE / SERVICE</Text>
          </View>
          <View style={{ flex:C.contract, alignItems:'center' }}>
            <Text style={styles.thCellC}>CONTRACT</Text>
            <Text style={styles.thCellC}>(100%)</Text>
          </View>
          <View style={{ flex:C.prev, alignItems:'center' }}>
            <Text style={styles.thCellC}>PREVIOUSLY</Text>
            <Text style={styles.thCellC}>BILLED</Text>
          </View>
          <View style={{ flex:C.cur, alignItems:'center' }}>
            <Text style={styles.thCellC}>CURRENT</Text>
            <Text style={styles.thCellC}>BILLING</Text>
          </View>
          <View style={{ flex:C.total, alignItems:'center' }}>
            <Text style={styles.thCellC}>TOTAL</Text>
            <Text style={styles.thCellC}>BILLING</Text>
          </View>
          <View style={{ flex:C.rem, alignItems:'center' }}>
            <Text style={styles.thCellC}>REMAINING</Text>
            <Text style={{ fontSize:6 }}> </Text>
          </View>
        </View>

        {lineItems.map((item, i) => {
          const rowSt  = i % 2 === 0 ? styles.phRow : styles.phRowAlt
          const color  = scopeColor(item.scopeCode, scopeTypes)
          const hasCur = (item.curBilling || 0) > 0
          const hasRem = (item.remaining  || 0) > 0
          const pillR  = pillH / 2
          return (
            <View key={item.id ?? i} style={[rowSt, { paddingVertical:phPadV }]}>
              <View style={{ flex:C.service, flexDirection:'row', alignItems:'center' }}>
                <View style={{ width:pillH, height:pillH, borderRadius:pillR, backgroundColor:color,
                  alignItems:'center', justifyContent:'center', marginRight:7, flexShrink:0 }}>
                  <Text style={styles.pillTxt}>{(item.scopeCode||'').slice(0,5)}</Text>
                </View>
                <Text style={{ fontSize:phFsz, flex:1 }}>{item.phaseName}</Text>
              </View>
              <View style={{ flex:C.contract, alignItems:'center' }}>
                <Text style={[styles.valAmt, { fontSize:phFsz }]}>{fmtD(item.contractFee)}</Text>
              </View>
              <View style={{ flex:C.prev, ...styles.valCell }}>
                <Text style={[styles.valPct, { fontSize:pctFsz }]}>{fmtP(item.prevPct)}</Text>
                <Text style={[styles.valAmt, { fontSize:phFsz }]}>{fmtD(item.prevBilled)}</Text>
              </View>
              <View style={{ flex:C.cur, ...styles.valCell }}>
                <Text style={[hasCur ? styles.valPctOrange : styles.valPct, { fontSize:pctFsz }]}>{fmtP(item.curPct)}</Text>
                <Text style={[hasCur ? styles.valAmtOrange : styles.valAmt, { fontSize:phFsz }]}>{fmtD(item.curBilling)}</Text>
              </View>
              <View style={{ flex:C.total, ...styles.valCell }}>
                <Text style={[styles.valPct, { fontSize:pctFsz }]}>{fmtP(item.totalPct)}</Text>
                <Text style={[styles.valAmt, { fontSize:phFsz }]}>{fmtD(item.totalBilled)}</Text>
              </View>
              <View style={{ flex:C.rem, ...styles.valCell }}>
                <Text style={[hasRem ? styles.valPctGreen : styles.valPct, { fontSize:pctFsz }]}>{fmtP(item.remPct)}</Text>
                <Text style={[hasRem ? styles.valAmtGreen : styles.valAmt, { fontSize:phFsz }]}>{fmtD(item.remaining)}</Text>
              </View>
            </View>
          )
        })}

        <View style={[styles.totalRow, { paddingVertical:totPadV }]}>
          <View style={{ flex:C.service }}>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold' }}>TOTAL PROFESSIONAL SERVICES</Text>
          </View>
          <View style={{ flex:C.contract, alignItems:'center' }}>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold' }}>{fmtD(totalContract)}</Text>
          </View>
          <View style={{ flex:C.prev, alignItems:'flex-end' }}>
            <Text style={{ fontSize:7, color:O }}>{fmtP(totalPrevPct)}</Text>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold' }}>{fmtD(totalPrev)}</Text>
          </View>
          <View style={{ flex:C.cur, alignItems:'flex-end' }}>
            <Text style={{ fontSize:7, color:T }}>{fmtP(totalCurPct)}</Text>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color:T }}>{fmtD(totalCur)}</Text>
          </View>
          <View style={{ flex:C.total, alignItems:'flex-end' }}>
            <Text style={{ fontSize:7, color:O }}>{fmtP(totalBilledPct)}</Text>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold' }}>{fmtD(totalBilled)}</Text>
          </View>
          <View style={{ flex:C.rem, alignItems:'flex-end' }}>
            <Text style={{ fontSize:7, color:'#2D6B4A' }}>{fmtP(totalRemPct)}</Text>
            <Text style={{ fontSize:8, fontFamily:'Helvetica-Bold', color:'#2D6B4A' }}>{fmtD(totalRem)}</Text>
          </View>
        </View>

        {/* Contract Summary + Progress */}
        <View style={{ flexDirection:'row', marginTop:sumMT, gap:sumGap }}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryTitle}>CONTRACT SUMMARY</Text>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Original Contract Amount</Text>
              <Text style={styles.summaryVal}>{fmtD(totalContract)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Previously Billed</Text>
              <Text style={styles.summaryVal}>{fmtD(totalPrev)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabelOrange}>Current Invoice</Text>
              <Text style={styles.summaryValOrange}>{fmtD(totalCur)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total Billed (Including This Invoice)</Text>
              <Text style={styles.summaryVal}>{fmtD(totalBilled)}</Text>
            </View>
            <View style={styles.summarySep} />
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabelBold}>REMAINING CONTRACT BALANCE</Text>
              <Text style={styles.summaryValBold}>{fmtD(totalRem)}</Text>
            </View>
          </View>

          <View style={styles.summaryRight}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
              <Text style={styles.summaryTitle}>CONTRACT PROGRESS</Text>
              <Text style={{ fontSize:7.5, fontFamily:'Helvetica-Bold' }}>{fmtP(totalBilledPct)} BILLED</Text>
            </View>
            <View style={{ flexDirection:'row', height:barH, marginBottom:8, borderRadius:2 }}>
              <View style={{ flex:prevFlex, backgroundColor:'#3D6B5E', borderTopLeftRadius:2, borderBottomLeftRadius:2 }} />
              <View style={{ flex:curFlex, backgroundColor:T }} />
              <View style={{ flex:remFlex, backgroundColor:S, borderTopRightRadius:2, borderBottomRightRadius:2 }} />
            </View>
            {showProgLabels && (
              <View style={{ flexDirection:'row', justifyContent:'space-around', marginBottom:progMB }}>
                <View style={styles.progressItem}>
                  <Text style={[styles.progPct, { color:'#3D6B5E' }]}>{fmtP(totalPrevPct)}</Text>
                  <Text style={styles.progAmt}>{fmtD(totalPrev)}</Text>
                  <Text style={styles.progLbl}>PREVIOUSLY BILLED</Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={[styles.progPct, { color:T }]}>{fmtP(totalCurPct)}</Text>
                  <Text style={styles.progAmt}>{fmtD(totalCur)}</Text>
                  <Text style={styles.progLbl}>CURRENT INVOICE</Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={[styles.progPct, { color:O }]}>{fmtP(totalRemPct)}</Text>
                  <Text style={styles.progAmt}>{fmtD(totalRem)}</Text>
                  <Text style={styles.progLbl}>REMAINING</Text>
                </View>
              </View>
            )}
            <View style={styles.amountRow}>
              <View>
                <Text style={styles.amountLabel}>AMOUNT DUE</Text>
                <Text style={{ fontSize:amtFsz, fontFamily:'Helvetica-Bold', color:T }}>{fmtD(totalCur)}</Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={styles.dueDateLabel}>DUE DATE</Text>
                <Text style={styles.dueDateValue}>{dueDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notes */}
        {notes ? (
          <View style={{ marginTop:noteMT, paddingTop:10, borderTopWidth:0.5, borderTopColor:S }}>
            <Text style={styles.notesTitle}>NOTES</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* Footer — fixed position, outside content flow */}
        <View style={styles.footer} fixed>
          <View style={styles.footerBrandLine} />
          <View style={styles.footerRow}>
            <View style={styles.footerCol}>
              <Text style={styles.footerTitle}>MAIL PAYMENTS TO</Text>
              <Text style={styles.footerText}>{banking?.mailName || firm.fullName || firm.name || ''}</Text>
              {(banking?.mailAddr1||firm.address1) ? <Text style={styles.footerText}>{banking?.mailAddr1||firm.address1}</Text> : null}
              {(banking?.mailAddr2||firm.address2) ? <Text style={styles.footerText}>{banking?.mailAddr2||firm.address2}</Text> : null}
            </View>
            <View style={styles.footerCol}>
              {banking?.bankName ? <>
                <Text style={styles.footerTitle}>ACH / WIRE TRANSFER</Text>
                <Text style={styles.footerText}>{banking.bankName}</Text>
                {banking.routingNo   ? <Text style={styles.footerText}>{'Routing No: '+banking.routingNo}</Text>   : null}
                {banking.accountNo   ? <Text style={styles.footerText}>{'Account No: '+banking.accountNo}</Text>   : null}
                {banking.accountName ? <Text style={styles.footerText}>{'Account Name: '+banking.accountName}</Text> : null}
              </> : null}
            </View>
            <View style={[styles.footerCol, { paddingRight:0 }]}>
              <Text style={styles.footerTitle}>QUESTIONS?</Text>
              {banking?.questionsName  ? <Text style={styles.footerText}>{banking.questionsName}</Text>  : null}
              {banking?.questionsEmail ? <Text style={styles.footerText}>{banking.questionsEmail}</Text> : null}
              {banking?.questionsPhone ? <Text style={styles.footerText}>{banking.questionsPhone}</Text> : null}
            </View>
          </View>
          <Text style={styles.footerBrand}>
            {'WE APPRECIATE YOUR BUSINESS.  ·  '+(firm.website||'JDAARCH.COM').toUpperCase()}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
