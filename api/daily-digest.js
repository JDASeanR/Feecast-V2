// Feecast — Daily Digest
// Cron: 9am Pacific Mon-Fri (configured in vercel.json)
// On-demand: POST /api/daily-digest  { recipients: [...] }

const SUPABASE_URL = 'https://qivwmqoqojqefyiuizjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdndtcW9xb2pxZWZ5aXVpemp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTE2NDYsImV4cCI6MjA5Njc4NzY0Nn0.qiSmLPh6trCcXNJppDUyl9CWylegraSc18SFnHFjmuU';
const RESEND_KEY   = process.env.RESEND_API_KEY || 're_UBetiwBn_AzNPhcvDqrY1wzrfjvrTNMFz';
const FROM_EMAIL   = 'Feecast <digest@feecast.app>';
const APP_URL      = 'https://jda-tracker.vercel.app';

const fmt  = n => n == null ? '—' : '$' + Math.round(n).toLocaleString();
const fmtK = n => Math.abs(n||0) >= 1e6
  ? '$' + (Math.abs(n)/1e6).toFixed(2) + 'M'
  : Math.abs(n||0) >= 1000
  ? '$' + (Math.abs(n||0)/1000).toFixed(0) + 'k'
  : fmt(n);

async function supa(path) {
  const key = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!r.ok) {
    const err = await r.text();
    console.error(`Supabase fetch error [${path}]:`, r.status, err);
    return [];
  }
  return r.json();
}

async function fetchState() {
  const [proj, inv, st] = await Promise.all([
    supa('projects?select=data&limit=1'),
    supa('invoices?select=data&limit=1'),
    supa('app_state?select=data&key=eq.state&limit=1'),
  ]);
  return {
    projects:      proj[0]?.data || [],
    invoices:      inv[0]?.data  || [],
    settings:      st[0]?.data?.settings || {},
    opportunities: st[0]?.data?.opportunities || [],
  };
}

function calcDigest({ projects, invoices, settings, opportunities }) {
  const today  = new Date();
  const cy     = today.getFullYear();
  const cm     = today.getMonth() + 1;
  const curMk  = `${cy}-${String(cm).padStart(2,'0')}`;

  // YTD billing (completed months only)
  let ytd = 0;
  for (let m = 1; m < cm; m++) {
    const mk = `${cy}-${String(m).padStart(2,'0')}`;
    projects.forEach(p => p.phases?.forEach(ph => { ytd += ph.monthly?.[mk] || 0; }));
  }

  // Current month projected
  let curMonth = 0;
  projects.forEach(p => p.phases?.forEach(ph => { curMonth += ph.monthly?.[curMk] || 0; }));

  const monthlyGoal = settings.billing?.monthlyGoal || Math.round((settings.billing?.annualGoal || 4740000) / 12);
  const ytdGoal     = monthlyGoal * (cm - 1);

  // Total fees and backlog
  let totalFees = 0, totalBilled = 0;
  projects.forEach(p => p.phases?.forEach(ph => {
    const fee = ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : (ph.fee || 0);
    totalFees  += fee;
    totalBilled += ph.billed || 0;
    for (let m = 1; m < cm; m++) {
      const mk = `${cy}-${String(m).padStart(2,'0')}`;
      totalBilled += ph.monthly?.[mk] || 0;
    }
  }));
  const backlog = Math.max(0, totalFees - totalBilled);

  // A/R
  const openInv  = invoices.filter(i => !i.paid);
  const followUps = openInv.filter(i => i.flag);
  const arTotal  = openInv.reduce((s, i) => s + (i.amount || 0), 0);
  const pastDue  = openInv
    .filter(i => (i.bucketOverride || '') !== '0-30')
    .reduce((s, i) => s + (i.amount || 0), 0);

  // Pipeline & flagged
  const activeOpps     = opportunities.filter(o => o.status !== '04 Won' && o.status !== '05 Lost');
  const pipeline       = activeOpps.reduce((s, o) => s + (o.fee || 0) * (o.confidence || 50) / 100, 0);
  const flaggedProjects = projects.filter(p => p.flag && !p.done && !p.archived);

  return {
    ytd, ytdGoal, curMonth, monthlyGoal,
    totalFees, backlog, arTotal, pastDue,
    followUps, flaggedProjects, pipeline,
    cy, cm,
  };
}

function buildEmail(d, sections = {}) {
  const billing  = sections.billing  !== false;
  const ar       = sections.ar       !== false;
  const pipeline = sections.pipeline !== false;
  const flagged  = sections.flagged  !== false;

  const todayStr  = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const ytdPct    = d.ytdGoal > 0 ? Math.round(d.ytd / d.ytdGoal * 100) : 0;
  const ytdColor  = ytdPct >= 90 ? '#2d7a3a' : ytdPct >= 70 ? '#b45309' : '#c0392b';
  const arColor   = d.pastDue > 50000 ? '#c0392b' : '#2d7a3a';

  const followUpRows = d.followUps.slice(0, 10).map(i => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6">${i.client}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6;color:#888">${i.invoiceNo || '—'}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6;text-align:right;font-weight:600">${fmt(i.amount)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6">
        <span style="background:${i.bucketOverride==='120+'?'#fde8e8':i.bucketOverride==='90-120'?'#fef3e2':'#f0ede6'};padding:2px 6px;border-radius:4px;font-size:11px">
          ${i.bucketOverride || '0-30'}
        </span>
      </td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6;color:#666;font-size:12px">${i.status || '—'}</td>
    </tr>`).join('');

  const flaggedRows = d.flaggedProjects.slice(0, 8).map(p => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6">${p.project}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6;color:#888">${p.pm}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f0ede6;color:#888">${p.projNo || '—'}</td>
    </tr>`).join('');

  const billingBlock = billing ? `
  <div style="padding:20px 32px;background:#faf9f6;border-bottom:1px solid #e8e4db">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:14px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">YTD Billed</div>
        <div style="font-size:20px;font-weight:700;color:${ytdColor}">${fmtK(d.ytd)}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">${ytdPct}% of ${fmtK(d.ytdGoal)} goal</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:14px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">This Month</div>
        <div style="font-size:20px;font-weight:700;color:#3d3935">${fmtK(d.curMonth)}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">of ${fmtK(d.monthlyGoal)} goal</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:14px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Backlog</div>
        <div style="font-size:20px;font-weight:700;color:#3d3935">${fmtK(d.backlog)}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">of ${fmtK(d.totalFees)} contracted</div>
      </div>
    </div>
  </div>` : '';

  const arBlock = ar ? `
  <div style="padding:20px 32px;border-bottom:1px solid #e8e4db">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:#3d3935">Accounts Receivable</div>
      <div style="font-size:12px;color:#888">
        Total: <strong style="color:#3d3935">${fmtK(d.arTotal)}</strong>
        &nbsp;·&nbsp;
        Past due: <strong style="color:${arColor}">${fmtK(d.pastDue)}</strong>
      </div>
    </div>
    ${d.followUps.length > 0 ? `
    <div style="font-size:12px;color:#bd6439;font-weight:600;margin-bottom:8px">
      ⚑ ${d.followUps.length} follow-up${d.followUps.length > 1 ? 's' : ''} flagged
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f5f5f1">
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Client</th>
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Invoice</th>
        <th style="padding:6px 12px;text-align:right;color:#888;font-weight:600">Amount</th>
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Age</th>
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Status</th>
      </tr></thead>
      <tbody>${followUpRows}</tbody>
    </table>` : `<div style="font-size:12px;color:#888">No follow-ups flagged.</div>`}
  </div>` : '';

  const pipelineBlock = pipeline ? `
  <div style="padding:20px 32px;border-bottom:1px solid #e8e4db">
    <div style="font-size:13px;font-weight:600;color:#3d3935;margin-bottom:4px">Pipeline</div>
    <div style="font-size:12px;color:#888">
      Weighted value: <strong style="color:#3d3935">${fmtK(d.pipeline)}</strong>
    </div>
  </div>` : '';

  const flaggedBlock = flagged && d.flaggedProjects.length > 0 ? `
  <div style="padding:20px 32px;border-bottom:1px solid #e8e4db">
    <div style="font-size:13px;font-weight:600;color:#3d3935;margin-bottom:12px">
      ⚑ Flagged Projects (${d.flaggedProjects.length})
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f5f5f1">
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Project</th>
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">PM</th>
        <th style="padding:6px 12px;text-align:left;color:#888;font-weight:600">Proj #</th>
      </tr></thead>
      <tbody>${flaggedRows}</tbody>
    </table>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f1;font-family:Calibri,Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

  <div style="background:#3d3935;padding:24px 32px">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">
      Fee<span style="color:#bd6439">cast</span>
    </div>
    <div style="color:#b0a898;font-size:13px;margin-top:4px">Daily Digest · ${todayStr}</div>
    <div style="color:#736f4c;font-size:11px;margin-top:2px">Jeffrey DeMure + Associates</div>
  </div>

  ${billingBlock}
  ${arBlock}
  ${pipelineBlock}
  ${flaggedBlock}

  <div style="padding:20px 32px;background:#f5f5f1">
    <div style="font-size:11px;color:#888;text-align:center">
      <a href="${APP_URL}" style="color:#bd6439;text-decoration:none;font-weight:600">Open Feecast</a>
      &nbsp;·&nbsp; Jeffrey DeMure + Associates Architects Planners, Inc.
      &nbsp;·&nbsp; Roseville, CA
    </div>
  </div>

</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse recipients from request body
    let bodyRecipients = [];
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      bodyRecipients = Array.isArray(body.recipients) ? body.recipients : [];
    } catch(e) {}

    const state = await fetchState();
    const digest = state.settings?.firm?.digest || {};
    const sections = digest.sections || { billing:true, ar:true, flagged:true, pipeline:true };

    // Recipient priority: request body → saved settings → fallback
    const recipients = bodyRecipients.length > 0
      ? bodyRecipients
      : digest.recipients?.length > 0
      ? digest.recipients
      : ['srichardson@jdaarch.com'];

    const d    = calcDigest(state);
    const html = buildEmail(d, sections);

    if (!RESEND_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not set' });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: `Feecast Digest - ${new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}`,
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Resend error:', JSON.stringify(emailData));
      return res.status(500).json({
        error: emailData?.message || emailData?.error || JSON.stringify(emailData) || 'Resend error',
        detail: emailData,
        debug: { from: FROM_EMAIL, to: recipients, resendStatus: emailRes.status },
      });
    }

    return res.status(200).json({ success: true, id: emailData.id, recipients });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
