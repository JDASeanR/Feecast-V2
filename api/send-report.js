const { Resend } = require('resend')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, message, pdfBase64, filename, reportName } = req.body || {}
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Missing required fields' })

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const result = await resend.emails.send({
      from: 'Feecast <digest@feecast.app>',
      to: [to],
      subject: `${reportName} — JD+A Feecast`,
      html: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#3D3935">
        <div style="background:#3D3935;padding:20px 24px;border-radius:6px 6px 0 0">
          <div style="font-size:18px;font-weight:700;color:#F5F5F1;text-transform:uppercase">${reportName}</div>
          <div style="font-size:11px;color:rgba(245,245,241,0.5);margin-top:4px">JD+A Feecast &middot; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
        </div>
        <div style="background:#F5F5F1;padding:20px 24px;border:1px solid rgba(61,57,53,0.1);border-top:none;border-radius:0 0 6px 6px">
          ${message ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">${message}</p><hr style="border:none;border-top:1px solid rgba(61,57,53,0.1);margin:0 0 16px">` : ''}
          <p style="margin:0;font-size:13px;color:#736F4C">Report attached as PDF. Generated from live Feecast data.</p>
        </div>
      </div>`,
      attachments: [{ filename, content: pdfBuffer }]
    })
    console.log('Resend result:', JSON.stringify(result))
    if (result.error) return res.status(500).json({ error: result.error.message })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
