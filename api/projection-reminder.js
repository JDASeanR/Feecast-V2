// Feecast — Projection Reminder
// Sends individual emails to PMs with under-allocated phases.
// Also sends a single summary email to admin recipients.
// On-demand: POST /api/projection-reminder  { manual: true }
// Cron: configured in vercel.json (fires daily, function handles cadence internally)

const SUPABASE_URL = 'https://qivwmqoqojqefyiuizjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdndtcW9xb2pxZWZ5aXVpemp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTE2NDYsImV4cGlyZXNfaW4iOjIwOTY3ODc2NDZ9.qiSmLPh6trCcXNJppDUyl9CWylegraSc18SFnHFjmuU';
const RESEND_KEY   = process.env.RESEND_API_KEY || 're_UBetiwBn_AzNPhcvDqrY1wzrfjvrTNMFz';
const FROM_EMAIL   = 'Feecast <digest@feecast.app>';
const APP_URL      = 'https://feecast.app';

const fmt  = n => n == null ? '—' : '$' + Math.round(n).toLocaleString();
const fmtK = n => Math.abs(n||0) >= 1e6
  ? '$' + (Math.abs(n)/1e6).toFixed(2) + 'M'
  : Math.abs(n||0) >= 1000
  ? '$' + (Math.abs(n||0)/1000).toFixed(0) + 'k'
  : fmt(n);

async function supa(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return r.json();
}

async function fetchState() {
  const [proj, st] = await Promise.all([
    supa('projects?select=data&limit=1'),
    supa('app_state?select=data&key=eq.state&limit=1'),
  ]);
  return {
    projects: proj[0]?.data || [],
    settings: st[0]?.data?.settings || {},
  };
}

function phRem(ph, curMk, cy) {
  const fee = ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : (ph.fee || 0);
  let ytd = 0;
  for (let m = 1; m < parseInt(curMk.slice(5)); m++) {
    const mk = `${cy}-${String(m).padStart(2,'0')}`;
    ytd += ph.monthly?.[mk] || 0;
  }
  return Math.max(0, fee - (ph.billed || 0) - ytd);
}

function phAlloc(ph, curMk) {
  return Object.entries(ph.monthly || {})
    .filter(([mk]) => mk >= curMk)
    .reduce((s, [, v]) => s + (v || 0), 0);
}

function findUnderAllocated(projects, curMk, cy) {
  const byPM = {};
  projects.forEach(p => {
    if (p.archived || p.done) return;
    p.phases.forEach(ph => {
      if (ph.done) return;
      const rem = phRem(ph, curMk, cy);
      if (rem <= 0) return;
      const alloc = phAlloc(ph, curMk);
      const gap = rem - alloc;
      if (gap <= 0) return;
      const pm = p.pm || 'Unknown';
      if (!byPM[pm]) byPM[pm] = [];
      byPM[pm].push({
        project: p.project, client: p.client, projNo: p.projNo,
        phase: ph.name, scope: ph.scope,
        rem, alloc, gap,
        pct: rem > 0 ? Math.round(alloc / rem * 100) : 0,
      });
    });
  });
  return byPM;
}

function phaseTableRows(phases) {
  return phases
    .sort((a, b) => b.gap - a.gap)
    .map(ph => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6">
        <div style="font-weight:600;color:#3d3935">${ph.project}</div>
        <div style="font-size:11px;color:#888;margin-top:1px">${ph.client}${ph.projNo ? ' · #' + ph.projNo : ''}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6;color:#736f4c;font-size:12px">${ph.phase}${ph.scope ? ' <span style="font-size:10px;background:#f0ede6;padding:1px 5px;border-radius:3px">' + ph.scope + '</span>' : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6;text-align:right;font-size:12px">${fmt(ph.rem)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6;text-align:right;font-size:12px;color:#736f4c">${fmt(ph.alloc)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6;text-align:right;font-weight:700;color:#c0392b;font-size:12px">${fmt(ph.gap)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede6;text-align:center">
        <div style="display:flex;align-items:center;gap:5px;justify-content:center">
          <div style="width:40px;height:5px;background:#eceae3;border-radius:2px">
            <div style="width:${Math.min(100,ph.pct)}%;height:100%;background:${ph.pct>=90?'#2d7a3a':ph.pct>=60?'#b45309':'#c0392b'};border-radius:2px"></div>
          </div>
          <span style="font-size:11px;color:#666">${ph.pct}%</span>
        </div>
      </td>
    </tr>`).join('');
}

function tableHeader() {
  return `<thead>
    <tr style="background:#f5f5f1">
      <th style="padding:7px 12px;text-align:left;color:#888;font-weight:600;font-size:11px">Project</th>
      <th style="padding:7px 12px;text-align:left;color:#888;font-weight:600;font-size:11px">Phase</th>
      <th style="padding:7px 12px;text-align:right;color:#888;font-weight:600;font-size:11px">Remaining</th>
      <th style="padding:7px 12px;text-align:right;color:#888;font-weight:600;font-size:11px">Allocated</th>
      <th style="padding:7px 12px;text-align:right;color:#888;font-weight:600;font-size:11px">Gap</th>
      <th style="padding:7px 12px;text-align:center;color:#888;font-weight:600;font-size:11px">% Alloc</th>
    </tr>
  </thead>`;
}

function emailShell(subtitle, bodyHtml, todayStr) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f1;font-family:Calibri,Arial,sans-serif">
<div style="max-width:640px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:#3d3935;padding:24px 32px">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">Fee<span style="color:#bd6439">cast</span></div>
    <div style="color:#b0a898;font-size:13px;margin-top:4px">${subtitle} · ${todayStr}</div>
    <div style="color:#736f4c;font-size:11px;margin-top:2px">Jeffrey DeMure + Associates</div>
  </div>
  ${bodyHtml}
  <div style="padding:16px 32px;background:#f5f5f1">
    <div style="font-size:11px;color:#888;text-align:center">
      <a href="${APP_URL}" style="color:#bd6439;text-decoration:none;font-weight:600">Open Feecast</a>
      &nbsp;·&nbsp; Jeffrey DeMure + Associates Architects Planners, Inc. · Roseville, CA
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildPMEmail(pmInit, pmFullName, phases, todayStr) {
  const totalRem   = phases.reduce((s, ph) => s + ph.rem, 0);
  const totalAlloc = phases.reduce((s, ph) => s + ph.alloc, 0);
  const totalGap   = phases.reduce((s, ph) => s + ph.gap, 0);
  const pct        = totalRem > 0 ? Math.round(totalAlloc / totalRem * 100) : 0;
  const pctColor   = pct >= 90 ? '#2d7a3a' : pct >= 60 ? '#b45309' : '#c0392b';

  const body = `
  <div style="padding:24px 32px;border-bottom:1px solid #e8e4db">
    <div style="font-size:15px;font-weight:700;color:#3d3935;margin-bottom:6px">Hi ${pmFullName || pmInit},</div>
    <p style="margin:0;font-size:13px;color:#555;line-height:1.6">
      You have <strong>${phases.length} phase${phases.length !== 1 ? 's' : ''}</strong> with projections that aren't fully allocated.
      Please log in to Feecast and update your projections so the team can plan accordingly.
    </p>
  </div>
  <div style="padding:20px 32px;background:#faf9f6;border-bottom:1px solid #e8e4db">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Remaining Fee</div>
        <div style="font-size:18px;font-weight:700;color:#3d3935">${fmtK(totalRem)}</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Allocated</div>
        <div style="font-size:18px;font-weight:700;color:${pctColor}">${fmtK(totalAlloc)} <span style="font-size:12px">(${pct}%)</span></div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px;border-top:3px solid #c0392b">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Gap to Fill</div>
        <div style="font-size:18px;font-weight:700;color:#c0392b">${fmtK(totalGap)}</div>
      </div>
    </div>
  </div>
  <div style="padding:20px 32px;border-bottom:1px solid #e8e4db">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      ${tableHeader()}
      <tbody>${phaseTableRows(phases)}</tbody>
      <tfoot>
        <tr style="background:#f5f5f1">
          <td colspan="2" style="padding:8px 12px;font-weight:700;font-size:12px">Total</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(totalRem)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;color:#736f4c">${fmt(totalAlloc)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;color:#c0392b">${fmt(totalGap)}</td>
          <td style="padding:8px 12px;text-align:center;font-weight:700;color:${pctColor}">${pct}%</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div style="padding:20px 32px;text-align:center;border-bottom:1px solid #e8e4db">
    <a href="${APP_URL}" style="display:inline-block;background:#bd6439;color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:13px;letter-spacing:.03em">
      Update Projections in Feecast →
    </a>
  </div>`;

  return emailShell('Projection Reminder', body, todayStr);
}

function buildSummaryEmail(byPM, pmRecords, todayStr) {
  const allPhases = Object.values(byPM).flat();
  const grandRem   = allPhases.reduce((s, ph) => s + ph.rem, 0);
  const grandAlloc = allPhases.reduce((s, ph) => s + ph.alloc, 0);
  const grandGap   = allPhases.reduce((s, ph) => s + ph.gap, 0);
  const grandPct   = grandRem > 0 ? Math.round(grandAlloc / grandRem * 100) : 0;
  const grandPctColor = grandPct >= 90 ? '#2d7a3a' : grandPct >= 60 ? '#b45309' : '#c0392b';

  const pmSections = Object.entries(byPM)
    .sort(([,a],[,b]) => b.reduce((s,p)=>s+p.gap,0) - a.reduce((s,p)=>s+p.gap,0))
    .map(([pmInit, phases]) => {
      const pmRecord = pmRecords.find(p => p.name === pmInit);
      const pmFullName = pmRecord?.fullName || pmInit;
      const pmEmail = pmRecord?.email || '—';
      const pmRem   = phases.reduce((s, ph) => s + ph.rem, 0);
      const pmAlloc = phases.reduce((s, ph) => s + ph.alloc, 0);
      const pmGap   = phases.reduce((s, ph) => s + ph.gap, 0);
      const pmPct   = pmRem > 0 ? Math.round(pmAlloc / pmRem * 100) : 0;
      const pmPctColor = pmPct >= 90 ? '#2d7a3a' : pmPct >= 60 ? '#b45309' : '#c0392b';

      return `
      <tr style="background:#3d3935">
        <td colspan="6" style="padding:7px 12px;color:#f5f5f1;font-weight:700;font-size:12px;font-family:Georgia,serif;letter-spacing:.03em">
          ${pmInit} — ${pmFullName}
          <span style="font-weight:400;color:#b0a898;font-size:11px;margin-left:8px">${pmEmail}</span>
          <span style="float:right;color:${pmPctColor};font-size:11px">${fmt(pmGap)} gap · ${pmPct}% allocated</span>
        </td>
      </tr>
      ${phaseTableRows(phases)}
      <tr style="background:#f5f5f1">
        <td colspan="2" style="padding:6px 12px;font-weight:700;font-size:11px;color:#736f4c">${pmInit} Total</td>
        <td style="padding:6px 12px;text-align:right;font-weight:700;font-size:11px">${fmt(pmRem)}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:700;font-size:11px;color:#736f4c">${fmt(pmAlloc)}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:700;font-size:11px;color:#c0392b">${fmt(pmGap)}</td>
        <td style="padding:6px 12px;text-align:center;font-weight:700;font-size:11px;color:${pmPctColor}">${pmPct}%</td>
      </tr>`;
    }).join('');

  const body = `
  <div style="padding:20px 32px;background:#faf9f6;border-bottom:1px solid #e8e4db">
    <div style="font-size:13px;font-weight:700;color:#3d3935;margin-bottom:10px">
      ${Object.keys(byPM).length} PM${Object.keys(byPM).length !== 1 ? 's' : ''} with under-allocated projections
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Total Remaining</div>
        <div style="font-size:18px;font-weight:700;color:#3d3935">${fmtK(grandRem)}</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Allocated</div>
        <div style="font-size:18px;font-weight:700;color:${grandPctColor}">${fmtK(grandAlloc)} <span style="font-size:12px">(${grandPct}%)</span></div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4db;border-radius:6px;padding:12px;border-top:3px solid #c0392b">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Total Gap</div>
        <div style="font-size:18px;font-weight:700;color:#c0392b">${fmtK(grandGap)}</div>
      </div>
    </div>
  </div>
  <div style="padding:20px 32px;border-bottom:1px solid #e8e4db">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      ${tableHeader()}
      <tbody>${pmSections}</tbody>
      <tfoot>
        <tr style="background:#3d3935;color:#f5f5f1">
          <td colspan="2" style="padding:8px 12px;font-weight:700;font-size:12px">Grand Total</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(grandRem)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(grandAlloc)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;color:#f8c4a0">${fmt(grandGap)}</td>
          <td style="padding:8px 12px;text-align:center;font-weight:700;color:${grandPctColor}">${grandPct}%</td>
        </tr>
      </tfoot>
    </table>
  </div>`;

  return emailShell('Projection Summary', body, todayStr);
}

async function sendEmail(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return { ok: r.ok, data: await r.json() };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projects, settings } = await fetchState();
    const projReminder = settings?.firm?.digest?.projReminder || {};
    const pms          = settings?.pms || [];

    const body     = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const isManual = body.manual === true;

    if (!isManual && !projReminder.enabled) {
      return res.status(200).json({ skipped: true, reason: 'Projection reminders not enabled' });
    }

    // Cadence check
    if (!isManual) {
      const today      = new Date();
      const dayOfWeek  = today.getDay(); // 0=Sun,1=Mon...6=Sat
      const targetDay  = projReminder.day || 1; // default Monday
      const cadence    = projReminder.cadence || 'weekly';

      if (cadence !== 'daily') {
        if (dayOfWeek !== targetDay) {
          return res.status(200).json({ skipped: true, reason: `Not the configured send day (${targetDay})` });
        }
        if (cadence === 'biweekly') {
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          const weekNo = Math.ceil(((today - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
          if (weekNo % 2 !== 1) {
            return res.status(200).json({ skipped: true, reason: 'Not a biweekly send week' });
          }
        }
      }
    }

    const today  = new Date();
    const cy     = today.getFullYear();
    const cm     = today.getMonth() + 1;
    const curMk  = `${cy}-${String(cm).padStart(2,'0')}`;
    const todayStr = today.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const byPM = findUnderAllocated(projects, curMk, cy);

    if (!Object.keys(byPM).length) {
      return res.status(200).json({ success: true, sent: 0, totalPhases: 0, message: 'No under-allocated projects found' });
    }

    if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

    let sent = 0, totalPhases = 0;
    const errors = [];

    // 1. Individual PM emails
    for (const [pmInit, phases] of Object.entries(byPM)) {
      const pmRecord   = pms.find(p => p.name === pmInit);
      const pmEmail    = pmRecord?.email;
      const pmFullName = pmRecord?.fullName || pmInit;

      if (!pmEmail) { errors.push(`No email for PM: ${pmInit}`); continue; }

      const html = buildPMEmail(pmInit, pmFullName, phases, todayStr);
      const { ok, data } = await sendEmail(
        [pmEmail],
        `Feecast: ${phases.length} project${phases.length !== 1 ? 's' : ''} need projection updates`,
        html
      );

      if (ok) { sent++; totalPhases += phases.length; }
      else { errors.push(`Failed to send to ${pmInit} (${pmEmail}): ${data?.message || 'Unknown error'}`); }
    }

    // 2. Admin summary email
    const summaryRecipients = projReminder.summaryRecipients || [];
    if (summaryRecipients.length) {
      const html = buildSummaryEmail(byPM, pms, todayStr);
      const { ok, data } = await sendEmail(
        summaryRecipients,
        `Feecast Projection Summary — ${Object.keys(byPM).length} PM${Object.keys(byPM).length !== 1 ? 's' : ''} need updates`,
        html
      );
      if (!ok) errors.push(`Failed to send summary: ${data?.message || 'Unknown error'}`);
    }

    return res.status(200).json({ success: true, sent, totalPhases, skippedPMs: errors });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
