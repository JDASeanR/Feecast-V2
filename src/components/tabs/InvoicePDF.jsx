import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const T = '#BD6439'
const D = '#3D3935'
const O = '#736F4C'
const S = '#ECEAE3'
const W = '#F5F5F1'

const PILL_COLORS = ['#2A5F44', '#1E4A7A', '#7A4A1A', '#4A2A7A', '#1A5F6B', '#7A1A1A', '#3D6B1F', '#6B4A1A', '#4A5F1F', '#1F4A5F']

function scopeColor(code, scopeTypes) {
  if (!scopeTypes?.length) return PILL_COLORS[0]
  const idx = scopeTypes.findIndex(s => s.code === code)
  return PILL_COLORS[Math.max(0, idx) % PILL_COLORS.length]
}

const fmtD = n => !n ? '$0' : '$' + Math.round(n).toLocaleString()
const fmtP = n => Math.round(n || 0) + '%'

// Column flex weights
const C = { service: 2.6, contract: 1, prev: 1.15, cur: 1.15, total: 1.15, rem: 1.15 }

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: D,
    backgroundColor: '#ffffff',
    paddingTop: 28,
    paddingBottom: 84,
    paddingHorizontal: 32,
  },

  // ── Header ──
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  headerLine: { flex: 1, height: 1.5, backgroundColor: T },
  logo: { width: 90, height: 90, marginHorizontal: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  infoLeft: { width: 160 },
  infoCenter: { flex: 1, alignItems: 'center' },
  infoRight: { width: 150, alignItems: 'flex-end' },
  infoAddr: { fontSize: 6.5, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 0.1, lineHeight: 1.6 },
  infoFirmName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, color: D, textAlign: 'center' },
  infoFirmSub: { fontSize: 7, letterSpacing: 2.5, color: D, marginTop: 2 },

  divider: { height: 0.5, backgroundColor: '#dedad0', marginVertical: 10 },

  // ── Bill To / Invoice Meta ──
  billMetaRow: { flexDirection: 'row', marginBottom: 12 },
  billToCol: { flex: 1, paddingRight: 12 },

  sectionLabel: { fontSize: 7, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, marginBottom: 4 },
  billToName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: D, marginBottom: 3, lineHeight: 1.3 },
  billToText: { fontSize: 8, color: D, lineHeight: 1.55 },

  invoiceMetaCol: { width: 228 },
  invoiceTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', letterSpacing: 4, color: D, textAlign: 'right', marginBottom: 9 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: S },
  metaKey: { fontSize: 7, color: O, letterSpacing: 0.5 },
  metaVal: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  metaValOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: T },

  // ── Professional Services ──
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 7 },

  // ── Phase table ──
  tableHead: { flexDirection: 'row', backgroundColor: D, paddingVertical: 5, paddingHorizontal: 6, marginBottom: 0 },
  thCell: { fontSize: 6.5, color: '#ffffff', fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  thCellC: { fontSize: 6.5, color: '#ffffff', fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, textAlign: 'center' },

  phRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.1)', alignItems: 'center', backgroundColor: '#ffffff' },
  phRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(61,57,53,0.1)', alignItems: 'center', backgroundColor: W },
  totalRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 6, backgroundColor: S, borderTopWidth: 1.5, borderTopColor: D, alignItems: 'center' },

  pill: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 7, flexShrink: 0 },
  pillTxt: { fontSize: 5.5, color: '#ffffff', fontFamily: 'Helvetica-Bold', letterSpacing: 0.2 },
  phName: { fontSize: 8.5, flex: 1 },

  valCell: { alignItems: 'center' },
  valPct: { fontSize: 7, color: O },
  valPctOrange: { fontSize: 7, color: T },
  valPctGreen: { fontSize: 7, color: '#2D6B4A' },
  valAmt: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  valAmtOrange: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: T },
  valAmtGreen: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#2D6B4A' },

  // ── Summary + Progress ──
  summaryRow: { flexDirection: 'row', marginTop: 14, gap: 18 },
  summaryLeft: { flex: 1 },
  summaryRight: { flex: 1 },

  summaryTitle: { fontSize: 7.5, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginBottom: 7 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  summaryLabel: { fontSize: 7.5, color: D },
  summaryLabelBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: D },
  summaryLabelOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: T },
  summaryVal: { fontSize: 7.5, color: D },
  summaryValBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: D },
  summaryValOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: T },
  summarySep: { borderTopWidth: 0.5, borderTopColor: D, marginVertical: 3 },

  progressBar: { flexDirection: 'row', height: 16, marginBottom: 8, borderRadius: 2 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  progressItem: { alignItems: 'center' },
  progPct: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  progAmt: { fontSize: 6.5, color: O },
  progLbl: { fontSize: 5.5, color: O, letterSpacing: 0.5, marginTop: 1 },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: S },
  amountLabel: { fontSize: 7.5, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginBottom: 2 },
  amountValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: T },
  dueDateLabel: { fontSize: 7, color: O, letterSpacing: 0.5, marginBottom: 3 },
  dueDateValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: D },

  // ── Notes ──
  notesSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: S },
  notesTitle: { fontSize: 7, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginBottom: 3 },
  notesText: { fontSize: 7.5, color: D, lineHeight: 1.5 },

  // ── Footer ──
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32 },
  footerBrandLine: { borderTopWidth: 1.5, borderTopColor: T, marginBottom: 8 },
  footerRow: { flexDirection: 'row' },
  footerCol: { flex: 1, paddingRight: 8 },
  footerTitle: { fontSize: 6.5, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginBottom: 3 },
  footerText: { fontSize: 7, color: D, lineHeight: 1.5 },
  footerBrand: { textAlign: 'center', fontSize: 6.5, color: T, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginTop: 10 },
})

export default function InvoicePDF({ data }) {
  const {
    project, client, invoiceNo, invoiceDate, servicesThrough,
    paymentTerms, dueDate, lineItems, totals, firm, banking, logo, scopeTypes, notes,
  } = data

  const {
    totalContract, totalPrev, totalPrevPct,
    totalCur, totalCurPct,
    totalBilled, totalBilledPct,
    totalRem, totalRemPct,
  } = totals

  // Progress bar flex values — need at least 0.1 to avoid render issues
  const prevFlex  = Math.max(0.1, totalPrevPct)
  const curFlex   = Math.max(0.1, totalCurPct)
  const remFlex   = Math.max(0.1, Math.max(0, 100 - totalBilledPct))

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* ── Header: lines + logo ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          {logo && <Image src={logo} style={styles.logo} />}
          {!logo && <View style={{ width: 70, height: 70, marginHorizontal: 16 }} />}
          <View style={styles.headerLine} />
        </View>

        {/* Firm info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            {firm.address1 ? <Text style={styles.infoAddr}>{firm.address1.toUpperCase()}</Text> : null}
            {firm.address2 ? <Text style={styles.infoAddr}>{firm.address2.toUpperCase()}</Text> : null}
          </View>
          <View style={styles.infoCenter}>
            <Text style={styles.infoFirmName}>{firm.fullName || 'JEFFREY DeMURE + ASSOCIATES'}</Text>
          </View>
          <View style={styles.infoRight}>
            {firm.phone ? <Text style={styles.infoAddr}>{firm.phone}</Text> : null}
            {firm.website ? <Text style={styles.infoAddr}>{firm.website.toUpperCase()}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Bill To / Invoice Meta ── */}
        <View style={styles.billMetaRow}>
          {/* Left: Bill To + Project */}
          <View style={styles.billToCol}>
            <Text style={styles.sectionLabel}>BILL TO</Text>
            <Text style={styles.billToName}>{client.name || '—'}</Text>
            {client.address1 ? <Text style={styles.billToText}>{client.address1}</Text> : null}
            {client.address2 ? <Text style={styles.billToText}>{client.address2}</Text> : null}

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>PROJECT</Text>
            <Text style={styles.billToName}>{project.name}</Text>
            {project.projNo ? <Text style={styles.billToText}>Project No.  {project.projNo}</Text> : null}
          </View>

          {/* Right: Invoice metadata */}
          <View style={styles.invoiceMetaCol}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>

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
            <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.metaKey}>DUE DATE</Text>
              <Text style={styles.metaVal}>{dueDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Professional Services ── */}
        <Text style={styles.sectionTitle}>PROFESSIONAL SERVICES</Text>

        {/* Table header */}
        <View style={styles.tableHead}>
          <View style={{ flex: C.service }}>
            <Text style={styles.thCell}>PHASE / SERVICE</Text>
          </View>
          <View style={{ flex: C.contract, alignItems: 'center' }}>
            <Text style={styles.thCellC}>CONTRACT</Text>
            <Text style={styles.thCellC}>(100%)</Text>
          </View>
          <View style={{ flex: C.prev, alignItems: 'center' }}>
            <Text style={styles.thCellC}>PREVIOUSLY</Text>
            <Text style={styles.thCellC}>BILLED</Text>
          </View>
          <View style={{ flex: C.cur, alignItems: 'center' }}>
            <Text style={styles.thCellC}>CURRENT</Text>
            <Text style={styles.thCellC}>BILLING</Text>
          </View>
          <View style={{ flex: C.total, alignItems: 'center' }}>
            <Text style={styles.thCellC}>TOTAL</Text>
            <Text style={styles.thCellC}>BILLING</Text>
          </View>
          <View style={{ flex: C.rem, alignItems: 'center' }}>
            <Text style={styles.thCellC}>REMAINING</Text>
            <Text style={{ fontSize: 6 }}> </Text>
          </View>
        </View>

        {/* Phase rows */}
        {lineItems.map((item, i) => {
          const rowSt = i % 2 === 0 ? styles.phRow : styles.phRowAlt
          const color = scopeColor(item.scopeCode, scopeTypes)
          const hasCur = (item.curBilling || 0) > 0
          const hasRem = (item.remaining || 0) > 0
          return (
            <View key={item.id ?? i} style={rowSt}>
              <View style={{ flex: C.service, flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.pill, { backgroundColor: color }]}>
                  <Text style={styles.pillTxt}>{(item.scopeCode || '').slice(0, 5)}</Text>
                </View>
                <Text style={styles.phName}>{item.phaseName}</Text>
              </View>

              <View style={{ flex: C.contract, alignItems: 'center' }}>
                <Text style={styles.valAmt}>{fmtD(item.contractFee)}</Text>
              </View>

              <View style={{ flex: C.prev, ...styles.valCell }}>
                <Text style={styles.valPct}>{fmtP(item.prevPct)}</Text>
                <Text style={styles.valAmt}>{fmtD(item.prevBilled)}</Text>
              </View>

              <View style={{ flex: C.cur, ...styles.valCell }}>
                <Text style={hasCur ? styles.valPctOrange : styles.valPct}>{fmtP(item.curPct)}</Text>
                <Text style={hasCur ? styles.valAmtOrange : styles.valAmt}>{fmtD(item.curBilling)}</Text>
              </View>

              <View style={{ flex: C.total, ...styles.valCell }}>
                <Text style={styles.valPct}>{fmtP(item.totalPct)}</Text>
                <Text style={styles.valAmt}>{fmtD(item.totalBilled)}</Text>
              </View>

              <View style={{ flex: C.rem, ...styles.valCell }}>
                <Text style={hasRem ? styles.valPctGreen : styles.valPct}>{fmtP(item.remPct)}</Text>
                <Text style={hasRem ? styles.valAmtGreen : styles.valAmt}>{fmtD(item.remaining)}</Text>
              </View>
            </View>
          )
        })}

        {/* Totals row */}
        <View style={styles.totalRow}>
          <View style={{ flex: C.service }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>TOTAL PROFESSIONAL SERVICES</Text>
          </View>
          <View style={{ flex: C.contract, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{fmtD(totalContract)}</Text>
          </View>
          <View style={{ flex: C.prev, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: O }}>{fmtP(totalPrevPct)}</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{fmtD(totalPrev)}</Text>
          </View>
          <View style={{ flex: C.cur, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: T }}>{fmtP(totalCurPct)}</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: T }}>{fmtD(totalCur)}</Text>
          </View>
          <View style={{ flex: C.total, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: O }}>{fmtP(totalBilledPct)}</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{fmtD(totalBilled)}</Text>
          </View>
          <View style={{ flex: C.rem, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: '#2D6B4A' }}>{fmtP(totalRemPct)}</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#2D6B4A' }}>{fmtD(totalRem)}</Text>
          </View>
        </View>

        {/* ── Contract Summary + Progress ── */}
        <View style={styles.summaryRow}>

          {/* Left: Contract Summary box */}
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

          {/* Right: Progress bar + Amount Due */}
          <View style={styles.summaryRight}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.summaryTitle}>CONTRACT PROGRESS</Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>{fmtP(totalBilledPct)} BILLED</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View style={{ flex: prevFlex, backgroundColor: '#3D6B5E', borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
              <View style={{ flex: curFlex, backgroundColor: T }} />
              <View style={{ flex: remFlex, backgroundColor: S, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
            </View>

            {/* Progress labels */}
            <View style={styles.progressLabels}>
              <View style={styles.progressItem}>
                <Text style={[styles.progPct, { color: '#3D6B5E' }]}>{fmtP(totalPrevPct)}</Text>
                <Text style={styles.progAmt}>{fmtD(totalPrev)}</Text>
                <Text style={styles.progLbl}>PREVIOUSLY BILLED</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={[styles.progPct, { color: T }]}>{fmtP(totalCurPct)}</Text>
                <Text style={styles.progAmt}>{fmtD(totalCur)}</Text>
                <Text style={styles.progLbl}>CURRENT INVOICE</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={[styles.progPct, { color: O }]}>{fmtP(totalRemPct)}</Text>
                <Text style={styles.progAmt}>{fmtD(totalRem)}</Text>
                <Text style={styles.progLbl}>REMAINING</Text>
              </View>
            </View>

            {/* Amount Due */}
            <View style={styles.amountRow}>
              <View>
                <Text style={styles.amountLabel}>AMOUNT DUE</Text>
                <Text style={styles.amountValue}>{fmtD(totalCur)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dueDateLabel}>DUE DATE</Text>
                <Text style={styles.dueDateValue}>{dueDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>NOTES</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* ── Footer (fixed — repeats on every page) ── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerBrandLine} />
          <View style={styles.footerRow}>
            <View style={styles.footerCol}>
              <Text style={styles.footerTitle}>MAIL PAYMENTS TO</Text>
              <Text style={styles.footerText}>{banking?.mailName || firm.fullName || firm.name || ''}</Text>
              {(banking?.mailAddr1 || firm.address1) ? <Text style={styles.footerText}>{banking?.mailAddr1 || firm.address1}</Text> : null}
              {(banking?.mailAddr2 || firm.address2) ? <Text style={styles.footerText}>{banking?.mailAddr2 || firm.address2}</Text> : null}
            </View>

            <View style={styles.footerCol}>
              {banking?.bankName ? (
                <>
                  <Text style={styles.footerTitle}>ACH / WIRE TRANSFER</Text>
                  <Text style={styles.footerText}>{banking.bankName}</Text>
                  {banking.routingNo ? <Text style={styles.footerText}>{'Routing No: ' + banking.routingNo}</Text> : null}
                  {banking.accountNo ? <Text style={styles.footerText}>{'Account No: ' + banking.accountNo}</Text> : null}
                  {banking.accountName ? <Text style={styles.footerText}>{'Account Name: ' + banking.accountName}</Text> : null}
                </>
              ) : null}
            </View>

            <View style={[styles.footerCol, { paddingRight: 0 }]}>
              <Text style={styles.footerTitle}>QUESTIONS?</Text>
              {banking?.questionsName  ? <Text style={styles.footerText}>{banking.questionsName}</Text>  : null}
              {banking?.questionsEmail ? <Text style={styles.footerText}>{banking.questionsEmail}</Text> : null}
              {banking?.questionsPhone ? <Text style={styles.footerText}>{banking.questionsPhone}</Text> : null}
            </View>
          </View>
          <Text style={styles.footerBrand}>
            {'WE APPRECIATE YOUR BUSINESS.  ·  ' + (firm.website || 'JDAARCH.COM').toUpperCase()}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
