import { Resend } from 'resend'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, message, reportHtml, reportName } = req.body || {}
  if (!to || !reportHtml) return res.status(400).json({ error: 'Missing required fields' })

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const result = await resend.emails.send({
      from: 'Feecast <digest@feecast.app>',
      to: [to],
      subject: `${reportName} — JD+A Feecast`,
      html: `
        <div style="font-family:'Helvetica Neue',sans-serif;max-width:700px;margin:0 auto;color:#3D3935;background:#F5F5F1;padding:24px">
          <div style="background:#3D3935;padding:16px 24px;border-radius:6px 6px 0 0;margin-bottom:0">
            <div style="font-size:16px;font-weight:700;color:#F5F5F1;text-transform:uppercase;letter-spacing:0.04em">${reportName}</div>
            <div style="font-size:11px;color:rgba(245,245,241,0.5);margin-top:3px">JD+A Feecast &middot; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
          </div>
          ${message ? `<div style="background:#ECEAE3;padding:12px 24px;border-left:3px solid #BD6439;margin-bottom:16px;font-size:13px;line-height:1.6">${message}</div>` : ''}
          <div style="background:#ffffff;border:1px solid rgba(61,57,53,0.1);border-radius:0 0 6px 6px;padding:24px">
            ${reportHtml}
          </div>
          <div style="text-align:center;margin-top:16px;font-size:10px;color:#736F4C;letter-spacing:0.1em;text-transform:uppercase">
            JD+A Project Tracker &middot; Confidential &middot; Generated ${new Date().toLocaleString()}
          </div>
        </div>
      `
    })
    if (result.error) return res.status(500).json({ error: result.error.message })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
