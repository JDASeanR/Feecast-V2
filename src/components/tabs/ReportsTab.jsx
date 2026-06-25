import { useState, useEffect, useCallback, useRef } from 'react'
import { pdf as renderPDF } from '@react-pdf/renderer'
import FinancialReportPDF from './FinancialReportPDF.jsx'
import ProjectStatusPDF from './ProjectStatusPDF.jsx'
import ARAgingPDF from './ARAgingPDF.jsx'
import OpportunitiesPDF from './OpportunitiesPDF.jsx'
import MonthlyBillingPDF from './MonthlyBillingPDF.jsx'
import { fmt, clsx, useLocalPref } from '../../lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const CUR_MK = `${CY}-${String(CM).padStart(2,'0')}`

const JDA_LOGO = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABe2lDQ1BJQ0MgUHJvZmlsZQAAeJx1kbtLA0EQhz9jguIrghYWFodEKyNRQbQRjIgKQUKM4KtJLi8hicfdBQm2gq2gINr4KvQv0FawFgRFEcRaLBVtNJxzSSAiZpbZ+fa3O8PuLDjCaTVjOH2QyZp6aNKvzC8sKnWvuGihDSfDEdXQxoLBAFXt854aO9567VrVz/1rjbG4oUJNvfCoqumm8JRwYM3UbN4RbldTkZjwmXCvLhcUvrP1aIlfbE6W+NtmPRwaB0ersJL8xdFfrKb0jLC8HE8mnVPL97Ff0hTPzs1K7BLvxCDEJH4UpplgnCH6GZF5CC8D9MmKKvm+Yv4Mq5KryqyRR2eFJClMekXNSfW4xITocRlp8nb///bVSAwOlKo3+cH1bFnv3VC3DYUty/o6sqzCMdQ+wWW2kr96CMMfom9VNM8BuDfg/KqiRXfhYhM6HrWIHilKteKORALeTqF5AdpuoGGp1LPyPicPEF6Xr7qGvX3okfPu5R9YJGffG41P8AAAC2RJREFUeNrdmmmMXWd5x3/ve5a7zu4542XidUxsJ3ZIoiROHFEKCZCk7ReqKhItbWnVFvgQVIFASJXKl6oqJUVUatUkH1i6QUto1YYUSnAVshonhMQ4ceNl7LFnvXNn7p27nO193n44x+OZeGyPQxyHvtKrc++993n/5znPOQ8qLmsp3hnLLpfoiN/f+5muvHv/QmASBc5Kl5gkwhrqDhBemq6vortQ2X9+/yPPfNFN8eiRoufeFEYWxzlfy9ZacmuGcQrlqy5+HEUU g5qNoHUQwAVACNqRIqExCSY7twhYIVHI1k9+juL6zUSNGtpxl1rx7XMbre+7+5MTX/qEm0xWg3MAlFVKKQ3o7LgMAIIcP8eJb/wFtZ88iVPqwoq8zfILysux57N/q7XnaWtFnQOwSg3YJMbEISr2rw6A7Lh0uRcXPwqlHJRyQL3dGUmROof6OQAspjDL2x8EK99P8wu+9M+pgF8gAO9QFO6bCSaUOj+I7dUB6F6uAawYbBKfn0aVRmmN0k6act9EmlXawYq5khawOPki XreffwIKOQ+7Ld5qBOS5L5BYKQCvQ JGMB4ZRYBXqfRO4MQTGU3GCb6oKe1hWgCBJVMp3BYMCMW Rf6OsXeHd3U33tqbfZtXtJhgBpRV2RxKhARGqtZEWBVSAWvhxmrOi9LAy8k5WPVs6l8nQeWmYRNatYOYKtQ+3S2dHWOhPNSpkBTRcE5RLr0WZvyRKhHuHNbGN+KjwzX1j3x+2akDAeObVl0YVZalolQm5FJadMAB9zMscJd2AoAFMgDhSZJA5ZMAWw2qjFAYjJ5FKi3H2FeX7fZJx0ioAFMI+b3vHIJCFWVQ4wXREBOC1JFgEXBMsRpbQChZU3cNEhH6OeH73qmRqjz5qlq5HA64iWQHIJoVKLw5bMZdOkTBpJSN OVQJFKhNBgpk1YnlX0pCbYR0QABQBMR8oJ3z8jR+u7cSrSKGhwJR hZHHsAp1VO8P5Hn0oHGBqj8BBZ2oMR2eGcC8d/l2AZPQ9KDe1uZPGRisgCSZdGCKG3gMW4XFRiBAggqPLHlJQ7PfhbmkS3lX/JBgOJNdJI5JFogE0jYIcIqBGCM1lNBRkUcVh0wKjEfIy yBaTIK iVQ8kVAICSoYA4KFCnAVkwsC6MoJDAiSiECBxL3KUMIJQaqIjnY62sCNmBRwlCaSZuJFCE5yA0F9BbSGJWDYWQFqFJCBREYQnDZCKqRMZYQOJ5Zi5RVUb5rB5GYjl55+sFKFVMTk9YEdGz8A0+xqVGj0B3bAAAAAElFTkSuQmCC`

// ── Month helpers ─────────────────────────────────────────────────────────────
function buildMonthList() {
  const months = []
  for (let i = -6; i < 24; i++) {
    const d = new Date(CY, CM-1+i, 1)
    const y = d.getFullYear(), m = d.getMonth()+1
    const key = `${y}-${String(m).padStart(2,'0')}`
    months.push({ key, label: d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}) })
  }
  return months
}
const MONTH_LIST = buildMonthList()

// ── Phase/project calc helpers ────────────────────────────────────────────────
const phCAEst = ph => ph.scope==='CA'?(ph.fee||0)*(ph.caMonths||12):0
const phFeeFC = ph => ph.scope==='CA'?phCAEst(ph):(ph.fee||0)
function phYTD(ph){let s=0;for(let m=1;m<CM;m++){const mk=`${CY}-${String(m).padStart(2,'0')}`;s+=ph.monthly?.[mk]||0;}return s;}
const phRem   = ph => Math.max(0,phFeeFC(ph)-(ph.billed||0)-phYTD(ph))
const phAlloc = ph => Object.entries(ph.monthly||{}).filter(([mk])=>mk>=CUR_MK).reduce((s,[,v])=>s+v,0)
const pFee    = p  => (p.phases||[]).reduce((s,ph)=>s+phFeeFC(ph),0)
const pBil    = p  => (p.phases||[]).reduce((s,ph)=>s+(ph.billed||0),0)
const pYTD    = p  => (p.phases||[]).reduce((s,ph)=>s+phYTD(ph),0)
const pRem    = p  => pFee(p)-pBil(p)-pYTD(p)

function mTotalAll(mk, projects) {
  return projects.reduce((s,p)=>s+p.phases.reduce((ps,ph)=>ps+(ph.monthly?.[mk]||0),0),0)
}

// AR helpers
function invAgeDays(inv){const ino=String(inv.invoiceNo||'');if(ino.length>=6){const yr=+ino.slice(0,4),mo=+ino.slice(4,6);if(yr>2000&&mo>=1&&mo<=12){const d=new Date(yr,mo-1,1);d.setDate(d.getDate()+30);return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));}}return 0;}
const autoBucket=days=>days<=30?'0-30':days<=60?'30-60':days<=90?'60-90':days<=120?'90-120':'120+'
const effBucket=inv=>inv.bucketOverride||autoBucket(invAgeDays(inv))
const AR_BUCKETS=['0-30','30-60','60-90','90-120','120+']
const AR_LABELS={'0-30':'Current (0–30 days)','30-60':'30–60 Days','60-90':'60–90 Days','90-120':'90–120 Days','120+':'120+ Days (Critical)'}
const AR_COLORS={'0-30':'#3a7a4a','30-60':'#736F4C','60-90':'#BD6439','90-120':'#c0392b','120+':'#8B0000'}

function invMonthLabel(inv){const ino=String(inv.invoiceNo||'');if(ino.length>=6){const yr=ino.slice(0,4),mo=+ino.slice(4,6);if(+yr>2000&&mo>=1&&mo<=12)return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]+' '+yr;}return inv.invoiceDate||'—';}

// ── Report header HTML ────────────────────────────────────────────────────────
function reportHeader(title, subtitle, template, logo) {
  const dt = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  if (template==='minimal') return `
    <div style="border-bottom:2px solid #BD6439;padding-bottom:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-family:'League Gothic','Nunito Sans',sans-serif;font-size:22px;letter-spacing:.04em;color:#3D3935">${title}</div>
        ${subtitle?`<div style="font-size:11px;color:#736F4C;margin-top:2px">${subtitle}</div>`:''}
      </div>
      <div style="font-size:11px;color:#a09c85">${dt}</div>
    </div>`
  return `
    <div style="background:#3D3935;border-radius:6px;padding:18px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div style="flex:1">
          <div style="font-size:10px;color:rgba(245,245,241,0.4);letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">JEFFREY DeMURE + ASSOCIATES · ARCHITECTS · PLANNERS</div>
          <div style="width:28px;height:3px;background:#BD6439;border-radius:2px;margin-bottom:8px"></div>
          <div style="font-family:'League Gothic','Nunito Sans',sans-serif;font-size:28px;letter-spacing:.04em;color:#F5F5F1">${title}</div>
          ${subtitle?`<div style="font-size:12px;color:rgba(245,245,241,0.55);margin-top:4px">${subtitle}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;margin-left:16px">
          ${logo?`<img src="${logo}" style="height:52px;max-width:130px;object-fit:contain;border-radius:4px;opacity:.85">`:''}
          <div style="font-size:10px;color:rgba(245,245,241,0.4);text-align:right">${dt} · CONFIDENTIAL</div>
        </div>
      </div>
    </div>`
}

const reportFooter = () => `
  <div style="margin-top:24px;padding-top:10px;border-top:0.5px solid #dedad0;display:flex;justify-content:space-between;font-size:10px;color:#a09c85">
    <span>JD+A Project Tracker · Confidential</span>
    <span>Generated ${new Date().toLocaleString()}</span>
  </div>`

const kpiCard = (label, val, color) => `
  <div style="background:#F5F5F1;border-radius:6px;padding:10px 12px;border-top:3px solid ${color}">
    <div style="font-size:10px;color:#736F4C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${label}</div>
    <div style="font-size:18px;font-weight:700;color:${color};font-family:'League Gothic','Nunito Sans',sans-serif">${val}</div>
  </div>`

const PAGE_WRAP = html => `
  <div style="box-sizing:border-box;width:100%;background:#fff;padding:32px 36px;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.12);font-family:'Nunito Sans',sans-serif;font-size:12px;color:#3D3935;overflow-x:auto">
    ${html}
  </div>`

// ── Report builders ───────────────────────────────────────────────────────────
function buildFinancialReport(appState, pm, client, fromMk, toMk, template) {
  const { projects, settings } = appState
  const monthlyGoal = settings.billing?.monthlyGoal || 395000
  const active = projects.filter(p=>!p.archived&&(pm==='ALL'||p.pm===pm)&&(client==='ALL'||p.client===client))
  const tF=active.reduce((s,p)=>s+pFee(p),0)
  const tB=active.reduce((s,p)=>s+pBil(p),0)
  const tYTD=active.reduce((s,p)=>s+pYTD(p),0)
  const tR=tF-tB-tYTD
  const tWIP=tF>0?Math.round((tB+tYTD)/tF*100):0

  const rangeMks=MONTH_LIST.filter(m=>m.key>=fromMk&&m.key<=toMk).map(m=>m.key)
  const rangeTotal=rangeMks.reduce((s,mk)=>s+mTotalAll(mk,projects),0)
  const rangeGoal=rangeMks.length*monthlyGoal

  const pmGroups={}
  active.forEach(p=>{
    if(!pmGroups[p.pm])pmGroups[p.pm]={pm:p.pm,fee:0,billed:0,ytd:0,projects:0}
    pmGroups[p.pm].fee+=pFee(p);pmGroups[p.pm].billed+=pBil(p);pmGroups[p.pm].ytd+=pYTD(p);pmGroups[p.pm].projects++
  })
  const subtitle=`${pm==='ALL'?'All PMs':'PM: '+pm} · ${client==='ALL'?'All Clients':client} · ${MONTH_LIST.find(m=>m.key===fromMk)?.label||fromMk} – ${MONTH_LIST.find(m=>m.key===toMk)?.label||toMk}`

  return PAGE_WRAP(`
    ${reportHeader('Firm Financial Summary',subtitle,template,appState.settings?.firm?.logo)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${kpiCard('Total Contracted Fee',fmt(tF),'#3D3935')}
      ${kpiCard('Prior Billed',fmt(tB),'#736F4C')}
      ${kpiCard('YTD '+CY,fmt(tYTD),'#BD6439')}
      ${kpiCard('Remaining Backlog',fmt(tR),'#736F4C')}
    </div>
    <div style="margin-bottom:20px">
      <div style="font-family:'League Gothic','Nunito Sans',sans-serif;font-size:14px;letter-spacing:.04em;color:#3D3935;margin-bottom:8px;padding-bottom:4px;border-bottom:0.5px solid #dedad0">PERIOD BILLINGS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${kpiCard('Billed in Period',fmt(rangeTotal),'#BD6439')}
        ${kpiCard('Goal for Period',fmt(rangeGoal),'#3D3935')}
        ${kpiCard('vs. Goal',(rangeTotal>=rangeGoal?'+':'')+fmt(rangeTotal-rangeGoal),rangeTotal>=rangeGoal?'#3a7a4a':'#b83a2a')}
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div style="font-family:'League Gothic','Nunito Sans',sans-serif;font-size:14px;letter-spacing:.04em;color:#3D3935;margin-bottom:8px;padding-bottom:4px;border-bottom:0.5px solid #dedad0">BACKLOG BY PROJECT MANAGER</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#F5F5F1">
          ${['PM','Projects','Total Fee','Prior Billed','YTD','Remaining','WIP%'].map(h=>`<th style="text-align:${h==='PM'||h==='Projects'?'left':'right'};padding:6px 8px;font-weight:700;color:#736F4C;font-size:10px;text-transform:uppercase;letter-spacing:.04em">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${Object.values(pmGroups).sort((a,b)=>b.fee-a.fee).map((g,i)=>{
            const rem=g.fee-g.billed-g.ytd,wip=g.fee>0?Math.round((g.billed+g.ytd)/g.fee*100):0
            return`<tr style="border-bottom:0.5px solid #eceae3;background:${i%2?'#fff':'#fafaf8'}">
              <td style="padding:6px 8px;font-weight:600;color:#3D3935">${g.pm}</td>
              <td style="padding:6px 8px;text-align:right;color:#736F4C">${g.projects}</td>
              <td style="padding:6px 8px;text-align:right">${fmt(g.fee)}</td>
              <td style="padding:6px 8px;text-align:right;color:#736F4C">${fmt(g.billed)}</td>
              <td style="padding:6px 8px;text-align:right;color:#BD6439">${fmt(g.ytd)}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:600">${fmt(rem)}</td>
              <td style="padding:6px 8px;text-align:right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:5px">
                  <div style="width:40px;height:4px;background:#eceae3;border-radius:2px"><div style="width:${Math.min(100,wip)}%;height:100%;background:#BD6439;border-radius:2px"></div></div>
                  ${wip}%
                </div>
              </td>
            </tr>`}).join('')}
          <tr style="border-top:2px solid #3D3935;background:#F5F5F1;font-weight:700">
            <td style="padding:7px 8px">TOTAL</td>
            <td style="padding:7px 8px;text-align:right">${active.length}</td>
            <td style="padding:7px 8px;text-align:right">${fmt(tF)}</td>
            <td style="padding:7px 8px;text-align:right">${fmt(tB)}</td>
            <td style="padding:7px 8px;text-align:right;color:#BD6439">${fmt(tYTD)}</td>
            <td style="padding:7px 8px;text-align:right">${fmt(tR)}</td>
            <td style="padding:7px 8px;text-align:right">${tWIP}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${reportFooter()}`)
}

function buildProjectReport(appState, pm, client, fromMk, toMk, template) {
  const { projects, settings } = appState
  const hideDone = appState.rHideDone||false
  const sortBy   = appState.rSort||'pm'

  let filtered = projects.filter(p=>!p.archived&&(pm==='ALL'||p.pm===pm)&&(client==='ALL'||p.client===client))
  if(hideDone) filtered=filtered.filter(p=>!p.done)
  const subtitle=`${pm==='ALL'?'All PMs':'PM: '+pm} · ${client==='ALL'?'All Clients':client} · Sorted by ${sortBy==='pm'?'PM':'Client'}`

  const groups={};const groupOrder=[]
  filtered.sort((a,b)=>sortBy==='pm'?(a.pm+a.project).localeCompare(b.pm+b.project):(a.client+a.project).localeCompare(b.client+b.project))
    .forEach(p=>{const k=sortBy==='pm'?(p.pm||'—'):(p._client||p.client||'—');if(!groups[k]){groups[k]=[];groupOrder.push(k);}groups[k].push(p);})

  let grandFee=0,grandBilled=0,grandYtd=0,grandRem=0

  const groupBlocks = groupOrder.map(k=>{
    const gps=groups[k]
    const gFee=gps.reduce((s,p)=>s+pFee(p),0),gBil=gps.reduce((s,p)=>s+pBil(p),0)
    const gYtd=gps.reduce((s,p)=>s+pYTD(p),0),gRem=gps.reduce((s,p)=>s+pRem(p),0)
    const gWip=gFee>0?Math.round((gBil+gYtd)/gFee*100):0
    grandFee+=gFee;grandBilled+=gBil;grandYtd+=gYtd;grandRem+=gRem

    const projRows=gps.map(p=>{
      const fee=pFee(p),billed=pBil(p),ytd=pYTD(p),rem=pRem(p)
      const wip=fee>0?Math.round((billed+ytd)/fee*100):0
      let phases=p.phases;if(hideDone)phases=phases.filter(ph=>!ph.done)
      const phRows=phases.map(ph=>{
        const phFee=phFeeFC(ph),phBilled=ph.billed||0,phYtd=phYTD(ph),phRem2=Math.max(0,phFee-phBilled-phYtd)
        const phWip=phFee>0?Math.round((phBilled+phYtd)/phFee*100):0
        return`<tr style="border-bottom:0.5px solid #f0ede6">
          <td style="padding:3px 8px 3px 24px;color:#736F4C;font-size:10px">${ph.name||'—'}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px;color:#736F4C">${ph.scope||'—'}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px">${fmt(phFee)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px;color:#736F4C">${fmt(phBilled)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px;color:#BD6439">${fmt(phYtd)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px;font-weight:${ph.done?'400':'600'}">${fmt(phRem2)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:10px">${ph.done?'<span style="color:#3a7a4a;font-size:9px">✓ Done</span>':phWip+'%'}</td>
        </tr>`}).join('')
      return`<tr style="background:#F5F5F1;border-top:1px solid #dedad0">
        <td colspan="7" style="padding:6px 8px">
          <div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-weight:700;color:#3D3935">${p.project}</span>
            <span style="font-size:10px;color:#736F4C">${p.client}</span>
            <span style="font-size:10px;color:#a09c85">${p.pm}</span>
            ${p.projNo?`<span style="font-size:10px;color:#a09c85">#${p.projNo}</span>`:''}
            ${p.done?'<span style="font-size:9px;color:#3a7a4a">✓ Done</span>':''}
          </div>
          <div style="margin-top:2px;height:3px;background:#eceae3;border-radius:1px;width:200px">
            <div style="width:${Math.min(100,wip)}%;height:100%;background:${wip>=100?'#3a7a4a':'#BD6439'};border-radius:1px"></div>
          </div>
        </td>
      </tr>
      ${phRows}
      <tr style="background:#fafaf8;border-bottom:1px solid #dedad0">
        <td style="padding:4px 8px;font-size:10px;font-weight:700;color:#736F4C">Project Total</td>
        <td></td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700">${fmt(fee)}</td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;color:#736F4C">${fmt(billed)}</td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;color:#BD6439">${fmt(ytd)}</td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700">${fmt(rem)}</td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700">${wip}%</td>
      </tr>`
    }).join('')

    return`<tr style="background:#3D3935">
      <td colspan="7" style="padding:7px 8px;font-weight:700;font-size:11px;color:#F5F5F1;font-family:'League Gothic','Nunito Sans',sans-serif;letter-spacing:.03em">${sortBy==='pm'?'PM':'CLIENT'}: ${k.toUpperCase()} — ${gps.length} project${gps.length!==1?'s':''}</td>
    </tr>
    ${projRows}
    <tr style="background:#e9e5da;border-bottom:2px solid #3D3935">
      <td style="padding:5px 8px;font-size:10px;font-weight:700;color:#3D3935">${sortBy==='pm'?'PM':'Client'} Total — ${k}</td>
      <td></td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;font-weight:700">${fmt(gFee)}</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;color:#736F4C;font-weight:700">${fmt(gBil)}</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;color:#BD6439;font-weight:700">${fmt(gYtd)}</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;font-weight:700">${fmt(gRem)}</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;font-weight:700">${gWip}%</td>
    </tr>`
  }).join('')

  const grandWip=grandFee>0?Math.round((grandBilled+grandYtd)/grandFee*100):0

  return PAGE_WRAP(`
    ${reportHeader('Project Status Report',subtitle,template,appState.settings?.firm?.logo)}
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#3D3935;color:#F5F5F1">
        ${['Project / Phase','Scope','Fee','Prior Billed','YTD','Remaining','WIP'].map((h,i)=>`<th style="text-align:${i<2?'left':'right'};padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${groupBlocks||`<tr><td colspan="7" style="padding:20px;text-align:center;color:#a09c85">No projects match filters</td></tr>`}</tbody>
      ${groupOrder.length>1?`<tfoot><tr style="background:#3D3935;color:#F5F5F1">
        <td colspan="2" style="padding:8px;font-weight:700;font-size:12px">GRAND TOTAL — ${filtered.length} project${filtered.length!==1?'s':''}</td>
        <td style="padding:8px;text-align:right;font-weight:700">${fmt(grandFee)}</td>
        <td style="padding:8px;text-align:right;font-weight:700">${fmt(grandBilled)}</td>
        <td style="padding:8px;text-align:right;font-weight:700;color:#f8c4a0">${fmt(grandYtd)}</td>
        <td style="padding:8px;text-align:right;font-weight:700">${fmt(grandRem)}</td>
        <td style="padding:8px;text-align:right;font-weight:700">${grandWip}%</td>
      </tr></tfoot>`:''}
    </table>
    ${reportFooter()}`)
}

function buildARReport(appState, pm, client, fromMk, toMk, template) {
  const { invoices } = appState
  const openInv = invoices.filter(i=>!i.paid&&(client==='ALL'||i.client===client))
  const grouped={};AR_BUCKETS.forEach(b=>{grouped[b]=[];})
  openInv.forEach(i=>{const b=effBucket(i);if(grouped[b])grouped[b].push(i);})
  const total=openInv.reduce((s,i)=>s+(i.amount||0),0)
  const subtitle=`${pm==='ALL'?'All PMs':'PM: '+pm} · Outstanding as of ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`

  const bucketRows=AR_BUCKETS.map(b=>{
    const items=grouped[b];if(!items?.length)return''
    const bTotal=items.reduce((s,i)=>s+(i.amount||0),0)
    return`<tr style="background:${AR_COLORS[b]}15">
      <td colspan="6" style="padding:6px 8px;font-weight:700;font-size:11px;color:${AR_COLORS[b]};font-family:'League Gothic','Nunito Sans',sans-serif;letter-spacing:.03em">
        ${AR_LABELS[b].toUpperCase()} — ${items.length} invoice${items.length!==1?'s':''} · ${fmt(bTotal)}
      </td>
    </tr>
    ${items.sort((a,b)=>(b.amount||0)-(a.amount||0)).map(i=>`<tr style="border-bottom:0.5px solid #f0ede6">
      <td style="padding:5px 8px;font-size:10px">${i.invoiceNo||'—'}</td>
      <td style="padding:5px 8px;font-size:10px;color:#736F4C">${invMonthLabel(i)}</td>
      <td style="padding:5px 8px;font-size:10px;font-weight:600">${i.client}</td>
      <td style="padding:5px 8px;font-size:10px;color:#736F4C">${i.project||'—'}</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;font-weight:700">${fmt(i.amount)}</td>
      <td style="padding:5px 8px;font-size:10px;color:#736F4C">${i.status||'—'}</td>
    </tr>`).join('')}`}).join('')

  const kpis=[
    {label:'Total Outstanding',val:fmt(total),color:'#3D3935'},
    {label:'Past Due (30+)',val:fmt(total-(grouped['0-30']||[]).reduce((s,i)=>s+(i.amount||0),0)),color:'#c0392b'},
    {label:'Current (0–30)',val:fmt((grouped['0-30']||[]).reduce((s,i)=>s+(i.amount||0),0)),color:'#3a7a4a'},
    {label:'Invoices',val:openInv.length,color:'#736F4C'},
  ]

  return PAGE_WRAP(`
    ${reportHeader('A/R Aging Report',subtitle,template,appState.settings?.firm?.logo)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${kpis.map(k=>kpiCard(k.label,k.val,k.color)).join('')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#3D3935;color:#F5F5F1">
        ${['Invoice #','Invoice Month','Client','Project','Amount','Notes'].map(h=>`<th style="text-align:${h==='Amount'?'right':'left'};padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${bucketRows||`<tr><td colspan="6" style="padding:20px;text-align:center;color:#a09c85">No outstanding invoices</td></tr>`}</tbody>
      <tfoot><tr style="background:#3D3935;color:#F5F5F1">
        <td colspan="4" style="padding:7px 8px;font-weight:700;font-size:11px">TOTAL OUTSTANDING</td>
        <td style="padding:7px 8px;text-align:right;font-weight:700;font-size:13px">${fmt(total)}</td>
        <td></td>
      </tr></tfoot>
    </table>
    ${reportFooter()}`)
}

function buildOpportunitiesReport(appState, pm, client, fromMk, toMk, template) {
  const { opportunities, settings } = appState
  const typeList = settings.projectTypes||[]
  const opps=opportunities.filter(o=>!o.archived&&o.status!=='04 Won'&&o.status!=='05 Lost'&&(pm==='ALL'||o.pm===pm)&&(client==='ALL'||o.client===client))
  const subtitle=`${pm==='ALL'?'All PMs':'PM: '+pm} · Active Opportunities as of ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`

  const typeOrder=typeList.map(t=>t.code)
  const typeLabel=code=>typeList.find(t=>t.code===code)?.label||code
  const typeGroups={};const typeGroupOrder=[]
  opps.forEach(o=>{const t=o.type||'SFD';if(!typeGroups[t]){typeGroups[t]=[];typeGroupOrder.push(t);}typeGroups[t].push(o);})
  typeGroupOrder.sort((a,b)=>typeOrder.indexOf(a)-typeOrder.indexOf(b))

  const totalFee=opps.reduce((s,o)=>s+(o.fee||0),0)
  const totalWtd=opps.reduce((s,o)=>s+Math.round((o.fee||0)*(o.confidence||50)/100),0)

  const typeRows=typeGroupOrder.map(t=>{
    const items=typeGroups[t].sort((a,b)=>(b.confidence||50)-(a.confidence||50))
    const typeFee=items.reduce((s,o)=>s+(o.fee||0),0)
    const typeWtd=items.reduce((s,o)=>s+Math.round((o.fee||0)*(o.confidence||50)/100),0)
    const oppRows=items.map(o=>{
      const wtd=Math.round((o.fee||0)*(o.confidence||50)/100)
      return`<tr style="border-bottom:0.5px solid #f0ede6">
        <td style="padding:4px 8px 4px 20px;font-size:10px;font-weight:600">${o.name||'—'}</td>
        <td style="padding:4px 8px;font-size:10px;color:#736F4C">${o.client||'—'}</td>
        <td style="padding:4px 8px;font-size:10px;color:#736F4C">${o.pm||'—'}</td>
        <td style="padding:4px 8px;font-size:10px;color:#736F4C">${o.status||'—'}</td>
        <td style="padding:4px 8px;text-align:right;font-size:10px">${fmt(o.fee||0)}</td>
        <td style="padding:4px 8px;text-align:center;font-size:10px">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center">
            <div style="width:30px;height:4px;background:#eceae3;border-radius:2px">
              <div style="width:${o.confidence||50}%;height:100%;background:#BD6439;border-radius:2px"></div>
            </div>
            ${o.confidence||50}%
          </div>
        </td>
        <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:600;color:#BD6439">${fmt(wtd)}</td>
      </tr>`}).join('')
    return`<tr style="background:#73684c18">
      <td colspan="4" style="padding:6px 8px;font-weight:700;font-size:11px;color:#736F4C;font-family:'League Gothic','Nunito Sans',sans-serif;letter-spacing:.03em">${typeLabel(t).toUpperCase()} — ${items.length} opportunit${items.length!==1?'ies':'y'}</td>
      <td style="padding:6px 8px;text-align:right;font-size:11px;font-weight:700">${fmt(typeFee)}</td>
      <td></td>
      <td style="padding:6px 8px;text-align:right;font-size:11px;font-weight:700;color:#BD6439">${fmt(typeWtd)}</td>
    </tr>${oppRows}`}).join('')

  return PAGE_WRAP(`
    ${reportHeader('Opportunities Report',subtitle,template,appState.settings?.firm?.logo)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${kpiCard('Active Opportunities',opps.length,'#3D3935')}
      ${kpiCard('Total Est. Fee',fmt(totalFee),'#3D3935')}
      ${kpiCard('Weighted Value',fmt(totalWtd),'#BD6439')}
      ${kpiCard('Avg Confidence',opps.length?Math.round(opps.reduce((s,o)=>s+(o.confidence||50),0)/opps.length)+'%':'—','#736F4C')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#3D3935;color:#F5F5F1">
        ${['Opportunity','Client','PM','Status','Est. Fee','Confidence','Weighted'].map((h,i)=>`<th style="text-align:${i>=4?'right':i===5?'center':'left'};padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${typeRows||`<tr><td colspan="7" style="padding:20px;text-align:center;color:#a09c85">No active opportunities</td></tr>`}</tbody>
      <tfoot><tr style="background:#3D3935;color:#F5F5F1">
        <td colspan="4" style="padding:7px 8px;font-weight:700;font-size:11px">TOTAL</td>
        <td style="padding:7px 8px;text-align:right;font-weight:700">${fmt(totalFee)}</td>
        <td></td>
        <td style="padding:7px 8px;text-align:right;font-weight:700;color:#f8c4a0">${fmt(totalWtd)}</td>
      </tr></tfoot>
    </table>
    ${reportFooter()}`)
}

function buildMonthlyBillingReport(appState, pm, client, mk, template) {
  const { projects, settings } = appState
  const monthlyGoal = settings.billing?.monthlyGoalOverrides?.[mk] || settings.billing?.monthlyGoal || 395000
  const [yr, mo] = mk.split('-').map(Number)
  const monthLabel = ['January','February','March','April','May','June','July','August','September','October','November','December'][mo-1] + ' ' + yr
  const subtitle = `${pm==='ALL'?'All PMs':'PM: '+pm} · ${client==='ALL'?'All Clients':client}`

  const active = projects.filter(p => !p.archived && (pm==='ALL'||p.pm===pm) && (client==='ALL'||p.client===client))

  // Build PM → Client → [projects] hierarchy
  const pmGroups = {}, pmOrder = []
  active.forEach(p => {
    const phases = p.phases.filter(ph => (ph.monthly?.[mk]||0) > 0)
    if (!phases.length) return
    const pmKey = p.pm || '—'
    const clientKey = p._client || p.client || '—'
    if (!pmGroups[pmKey]) { pmGroups[pmKey] = {}; pmOrder.push(pmKey) }
    if (!pmGroups[pmKey][clientKey]) pmGroups[pmKey][clientKey] = []
    pmGroups[pmKey][clientKey].push({ ...p, filteredPhases: phases })
  })

  const grandTotal = pmOrder.reduce((s,k)=>s+Object.values(pmGroups[k]).flat().reduce((s2,p)=>s2+p.filteredPhases.reduce((s3,ph)=>s3+(ph.monthly?.[mk]||0),0),0),0)

  const pmBlocks = pmOrder.map(pmKey => {
    const clientMap = pmGroups[pmKey]
    const clientOrder = Object.keys(clientMap)
    const pmTotal = clientOrder.reduce((s,ck)=>s+clientMap[ck].reduce((s2,p)=>s2+p.filteredPhases.reduce((s3,ph)=>s3+(ph.monthly?.[mk]||0),0),0),0)

    const clientBlocks = clientOrder.map(clientKey => {
      const pList = clientMap[clientKey]
      const clientTotal = pList.reduce((s,p)=>s+p.filteredPhases.reduce((s2,ph)=>s2+(ph.monthly?.[mk]||0),0),0)

      const projRows = pList.map(p => {
        const projTotal = p.filteredPhases.reduce((s,ph)=>s+(ph.monthly?.[mk]||0),0)
        const phRows = p.filteredPhases.map((ph,i) => {
          const phFee = ph.scope==='CA'?(ph.fee||0)*(ph.caMonths||12):(ph.fee||0)
          const phRem = Math.max(0, phFee - (ph.billed||0))
          const moAmt = ph.monthly?.[mk]||0
          const allocPct = phFee>0?Math.round(moAmt/phFee*100):0
          return `<tr style="border-bottom:1px solid #ECEAE3;background:${i%2?'#F5F5F1':'#ffffff'}">
            <td style="padding:5px 8px 5px 24px;font-size:11px;color:#736F4C">${ph.name||'—'}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:center;color:#736F4C">${ph.scope||'—'}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;color:#736F4C">${fmt(phFee)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;color:#736F4C">${fmt(phRem)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700;color:#BD6439">${fmt(moAmt)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:5px">
                <div style="width:36px;height:4px;background:#eceae3;border-radius:2px"><div style="width:${Math.min(100,allocPct)}%;height:100%;background:${allocPct>100?'#c0392b':'#BD6439'};border-radius:2px"></div></div>
                ${allocPct}%
              </div>
            </td>
          </tr>`}).join('')
        return `<tr style="background:#ECEAE3;border-top:1px solid #dedad0">
            <td colspan="6" style="padding:6px 8px 6px 16px">
              <span style="font-weight:700;color:#3D3935">${p.project}</span>
              ${p.projNo?`<span style="font-size:10px;color:#a09c85;margin-left:6px">#${p.projNo}</span>`:''}
              <span style="font-size:10px;color:#a09c85;margin-left:6px">${p.pm}</span>
            </td>
          </tr>
          ${phRows}
          <tr style="background:#e9e5da;border-bottom:1px solid #dedad0">
            <td style="padding:4px 8px;font-size:10px;font-weight:700;color:#736F4C">Project Total</td>
            <td colspan="3"></td>
            <td style="padding:4px 8px;text-align:right;font-size:11px;font-weight:700;color:#BD6439">${fmt(projTotal)}</td>
            <td></td>
          </tr>`}).join('')

      return `<tr style="background:#736F4C">
          <td colspan="6" style="padding:6px 8px;font-weight:700;font-size:11px;color:#F5F5F1;letter-spacing:.04em;text-transform:uppercase">
            ${clientKey}
            <span style="font-weight:400;font-size:10px;color:rgba(245,245,241,0.6);margin-left:8px">${pList.length} project${pList.length!==1?'s':''}</span>
          </td>
        </tr>
        ${projRows}
        <tr style="background:#ECEAE3;border-bottom:2px solid #736F4C">
          <td style="padding:4px 8px;font-size:10px;font-weight:700;color:#736F4C">Client Total — ${clientKey}</td>
          <td colspan="3"></td>
          <td style="padding:4px 8px;text-align:right;font-size:11px;font-weight:700;color:#BD6439">${fmt(clientTotal)}</td>
          <td></td>
        </tr>`}).join('')

    return `<tr style="background:#3D3935">
        <td colspan="6" style="padding:8px;font-weight:700;font-size:13px;color:#F5F5F1;font-family:'League Gothic','Nunito Sans',sans-serif;letter-spacing:.04em">
          PM: ${pmKey.toUpperCase()} <span style="color:#BD6439;margin-left:12px">${fmt(pmTotal)}</span>
        </td>
      </tr>
      ${clientBlocks}
      <tr><td colspan="6" style="height:10px;background:#fff"></td></tr>`}).join('')

  const vsGoal = grandTotal - monthlyGoal
  const logo = appState.settings?.firm?.logo
  const dt = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  const graphiteHeader = `
    <div style="background:#3D3935;border-radius:6px;padding:18px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div style="flex:1">
          <div style="font-size:10px;color:rgba(245,245,241,0.4);letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">JEFFREY DeMURE + ASSOCIATES · ARCHITECTS · PLANNERS</div>
          <div style="width:28px;height:3px;background:#BD6439;border-radius:2px;margin-bottom:8px"></div>
          <div style="font-family:'League Gothic','Nunito Sans',sans-serif;font-size:28px;letter-spacing:.04em;color:#F5F5F1">Monthly Billing Report</div>
          <div style="font-size:12px;color:rgba(245,245,241,0.55);margin-top:4px">${monthLabel} · ${subtitle}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;margin-left:16px">
          ${logo?`<img src="${logo}" style="height:52px;max-width:130px;object-fit:contain;border-radius:4px;opacity:.85">`:''}
          <div style="font-size:10px;color:rgba(245,245,241,0.4);text-align:right">${dt} · CONFIDENTIAL</div>
        </div>
      </div>
    </div>`
  return PAGE_WRAP(`
    ${graphiteHeader}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${kpiCard('Total Allocated',fmt(grandTotal),'#BD6439')}
      ${kpiCard('Monthly Goal',fmt(monthlyGoal),'#3D3935')}
      ${kpiCard('vs. Goal',(vsGoal>=0?'+':'')+fmt(vsGoal),vsGoal>=0?'#3a7a4a':'#c0392b')}
      ${kpiCard('% of Goal',Math.round(grandTotal/monthlyGoal*100)+'%',grandTotal>=monthlyGoal?'#3a7a4a':'#c0392b')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#3D3935;color:#F5F5F1">
        ${['Project / Phase','Scope','Phase Fee','Remaining',monthLabel.split(' ')[0]+' Alloc','% Alloc'].map((h,i)=>`<th style="text-align:${i>=2?'right':i===1?'center':'left'};padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${pmBlocks||`<tr><td colspan="6" style="padding:20px;text-align:center;color:#a09c85">No allocations for ${monthLabel}</td></tr>`}</tbody>
      <tfoot><tr style="background:#3D3935;color:#F5F5F1">
        <td colspan="4" style="padding:8px;font-weight:700;font-size:12px">TOTAL</td>
        <td style="padding:8px;text-align:right;font-weight:700;font-size:14px;color:#f8c4a0">${fmt(grandTotal)}</td>
        <td></td>
      </tr></tfoot>
    </table>
    ${reportFooter()}`)
}

// ── ReportsTab component ──────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id:'financial', icon:'ti-chart-bar',         label:'Firm Financial Summary' },
  { id:'monthly',   icon:'ti-calendar-dollar',   label:'Monthly Billing Report' },
  { id:'project',   icon:'ti-folder',            label:'Project Status Report' },
  { id:'ar',        icon:'ti-receipt',           label:'A/R Aging Report' },
  { id:'pipeline',  icon:'ti-rocket',            label:'Opportunities Report' },
]

export default function ReportsTab({ appState }) {
  const { projects, settings } = appState
  const pmList     = (settings.pms||[]).map(p=>p.name)
  const clients    = [...new Set(projects.filter(p=>!p.archived).map(p=>p.client).filter(Boolean))].sort()
  const monthlyGoal = settings.billing?.monthlyGoal || 395000

  const defaultFrom = `${CY}-01`
  const defaultTo   = CUR_MK

  const [rType,     setRType]     = useLocalPref('rpt.type', 'financial')
  const [rPM,       setRPM]       = useLocalPref('rpt.pm', 'ALL')
  const [rClient,   setRClient]   = useLocalPref('rpt.client', 'ALL')
  const [rFrom,     setRFrom]     = useLocalPref('rpt.from', defaultFrom)
  const [rTo,       setRTo]       = useLocalPref('rpt.to', defaultTo)
  const [rSort,     setRSort]     = useLocalPref('rpt.sort', 'pm')
  const [rHideDone, setRHideDone] = useLocalPref('rpt.hideDone', false)
  const [rTemplate, setRTemplate] = useLocalPref('rpt.template', 'letterhead')
  const [preview,   setPreview]   = useState(null)

  const generate = useCallback(() => {
    const stateWithSort = { ...appState, rSort, rHideDone }
    let html = ''
    if (rType==='financial') html=buildFinancialReport(stateWithSort,rPM,rClient,rFrom,rTo,rTemplate)
    if (rType==='monthly')   html=buildMonthlyBillingReport(stateWithSort,rPM,rClient,rTo,rTemplate)
    if (rType==='project')   html=buildProjectReport(stateWithSort,rPM,rClient,rFrom,rTo,rTemplate)
    if (rType==='ar')        html=buildARReport(stateWithSort,rPM,rClient,rFrom,rTo,rTemplate)
    if (rType==='pipeline')  html=buildOpportunitiesReport(stateWithSort,rPM,rClient,rFrom,rTo,rTemplate)
    setPreview(html)
  }, [appState,rType,rPM,rClient,rFrom,rTo,rSort,rHideDone,rTemplate])

  // Auto-generate on mount and filter changes
  useEffect(() => { generate() }, [generate])

  const [exporting, setExporting] = useState(false)
  const previewRef = useRef(null)

  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector('script[src="' + src + '"]')) return res()
    const s = document.createElement('script')
    s.src = src; s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })

  const getReportName = () => {
    const names = { financial:'Firm-Financial-Summary', monthly:'Monthly-Billing-Report', project:'Project-Status-Report', ar:'AR-Aging-Report', pipeline:'Opportunities-Report' }
    return names[rType] || 'Report'
  }

  const buildPDF = async () => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    const { jsPDF } = window.jspdf
    const node = previewRef.current?.querySelector('.report-page') || previewRef.current
    if (!node) throw new Error('No report content')

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()   // 210mm
    const pageH = pdf.internal.pageSize.getHeight()  // 297mm
    const margin = 10 // mm

    // Capture full canvas at scale 2
    const canvas = await window.html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const printW  = pageW - margin * 2
    const printH  = pageH - margin * 2
    // How many canvas px fit in one printed page height
    const pxPerPage = (canvas.width / printW) * printH
    const totalPages = Math.ceil(canvas.height / pxPerPage)

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()
      // srcY: which row of canvas pixels starts this page
      const srcY    = i * pxPerPage
      const srcH    = Math.min(pxPerPage, canvas.height - srcY)
      // Create a slice canvas for this page
      const slice   = document.createElement('canvas')
      slice.width   = canvas.width
      slice.height  = srcH
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      const sliceH  = (srcH / canvas.width) * printW
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, printW, sliceH)
    }
    return pdf
  }

  const handleExportReactPDF = async () => {
    setExporting(true)
    try {
      const stateWithSort = { ...appState, rSort, rHideDone }
      const logoSrc = appState.settings?.firm?.logo
      let doc
      if (rType === 'financial') {
        doc = <FinancialReportPDF appState={appState} pm={rPM} client={rClient} fromMk={rFrom} toMk={rTo} logo={logoSrc} />
      } else if (rType === 'project') {
        doc = <ProjectStatusPDF appState={stateWithSort} pm={rPM} client={rClient} fromMk={rFrom} toMk={rTo} logo={logoSrc} />
      } else if (rType === 'ar') {
        doc = <ARAgingPDF appState={stateWithSort} pm={rPM} client={rClient} logo={logoSrc} />
      } else if (rType === 'pipeline') {
        doc = <OpportunitiesPDF appState={stateWithSort} pm={rPM} client={rClient} logo={logoSrc} />
      } else if (rType === 'monthly') {
        doc = <MonthlyBillingPDF appState={appState} pm={rPM} client={rClient} mk={rTo} logo={logoSrc} />
      }
      const blob = await renderPDF(doc).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = getReportName() + '-' + new Date().toISOString().slice(0,10) + '.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF error:', err)
      alert('PDF generation failed: ' + err.message)
    } finally { setExporting(false) }
  }

  const handleExportPDF = async () => {
    if (!preview) return
    setExporting(true)
    try {
      const pdf = await buildPDF()
      pdf.save(getReportName() + '-' + new Date().toISOString().slice(0, 10) + '.pdf')
    } catch (err) {
      console.error(err)
      alert('PDF export failed. Try again.')
    } finally { setExporting(false) }
  }


  const handlePrint = () => {
    const win = window.open('','_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=League+Gothic&family=Nunito+Sans:wght@400;600;700&display=swap">
      <style>body{margin:0;padding:20px;background:#e8e5dc;font-family:'Nunito Sans',sans-serif}@media print{body{background:#fff;padding:0}.report-page{box-shadow:none!important}}</style>
    </head><body>${preview}</body></html>`)
    win.document.close()
    setTimeout(()=>win.print(),500)
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 88px)' }}>

      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-sand-2 border-r border-sand-3 overflow-y-auto p-3 flex flex-col gap-4">

        {/* Report type */}
        <div>
          <div className="text-2xs text-dark-3 uppercase tracking-widest mb-2 font-display">Report Type</div>
          <div className="flex flex-col gap-1">
            {REPORT_TYPES.map(r=>(
              <button key={r.id}
                onClick={()=>setRType(r.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors',
                  rType===r.id?'bg-terracotta text-white font-semibold':'hover:bg-sand text-dark-2'
                )}
              >
                <i className={clsx('ti',r.icon)} />
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div>
          <div className="text-2xs text-dark-3 uppercase tracking-widest mb-2 font-display">Filters</div>
          <div className="flex flex-col gap-2">
            <div>
              <label className="field-label">PM</label>
              <select value={rPM} onChange={e=>setRPM(e.target.value)} className="select text-xs w-full">
                <option value="ALL">All PMs</option>
                {pmList.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Client</label>
              <select value={rClient} onChange={e=>setRClient(e.target.value)} className="select text-xs w-full">
                <option value="ALL">All Clients</option>
                {clients.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {rType==='project' && (
              <>
                <div>
                  <label className="field-label">Sort By</label>
                  <select value={rSort} onChange={e=>setRSort(e.target.value)} className="select text-xs w-full">
                    <option value="pm">PM</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={rHideDone} onChange={e=>setRHideDone(e.target.checked)} />
                  Hide done projects/phases
                </label>
              </>
            )}
            <div>
              <label className="field-label">Date From</label>
              <select value={rFrom} onChange={e=>setRFrom(e.target.value)} className="select text-xs w-full">
                {MONTH_LIST.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Date To</label>
              <select value={rTo} onChange={e=>setRTo(e.target.value)} className="select text-xs w-full">
                {MONTH_LIST.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Template */}
        <div>
          <div className="text-2xs text-dark-3 uppercase tracking-widest mb-2 font-display">Template</div>
          <div className="flex gap-2">
            {['letterhead','minimal'].map(t=>(
              <button key={t} onClick={()=>setRTemplate(t)}
                className={clsx('flex-1 btn text-xs capitalize',rTemplate===t&&'btn-active')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          <button onClick={generate} className="btn btn-primary text-xs w-full justify-center font-display tracking-wide">
            <i className="ti ti-refresh" /> Refresh
          </button>
          <button onClick={handleExportReactPDF} disabled={exporting} className="btn text-xs w-full justify-center" style={{opacity:exporting?0.6:1}}>
            <i className={"ti " + (exporting ? "ti-loader" : "ti-download")} /> {exporting ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Preview pane */}
      <div ref={previewRef} className="flex-1 overflow-auto bg-[#e8e5dc] p-6 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          {preview
            ? <div dangerouslySetInnerHTML={{ __html: preview }} />
            : <div className="bg-white rounded-lg p-12 text-center text-dark-3">
                <i className="ti ti-file-description text-5xl opacity-30 block mb-3" />
                <div className="font-semibold text-sm">Select a report type</div>
              </div>
          }
        </div>
      </div>

    </div>
  )
}
