// ── Formatting ──────────────────────────────────────────────────────────────

export const fmt = n =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString()

export const fmtK = n => {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1000) return '$' + (abs / 1000).toFixed(0) + 'k'
  return fmt(n)
}

export const fmtPct = (n, decimals = 0) =>
  n == null ? '—' : n.toFixed(decimals) + '%'

// ── Date / month keys ────────────────────────────────────────────────────────

export const TODAY = new Date()
export const CY    = TODAY.getFullYear()
export const CM    = TODAY.getMonth() + 1
export const CUR_MK = `${CY}-${String(CM).padStart(2, '0')}`

export const mkLabel = mk => {
  const [y, m] = mk.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Generate N rolling months starting from current month
export const getRollingMonths = (n = 18) => {
  const months = []
  for (let i = 0; i < n; i++) {
    const d = new Date(CY, CM - 1 + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    months.push({ key, label: mkLabel(key) })
  }
  return months
}

// ── Phase calculations ───────────────────────────────────────────────────────

export const phYTD = ph => {
  let ytd = 0
  for (let m = 1; m < CM; m++) {
    const mk = `${CY}-${String(m).padStart(2, '0')}`
    ytd += ph.monthly?.[mk] || 0
  }
  return ytd
}

export const phFeeTotal = ph =>
  ph.scope === 'CA' ? (ph.fee || 0) * (ph.caMonths || 12) : (ph.fee || 0)

export const phRem = ph => {
  const fee = phFeeTotal(ph)
  return Math.max(0, fee - (ph.billed || 0) - phYTD(ph))
}

export const phAlloc = ph =>
  Object.entries(ph.monthly || {})
    .filter(([mk]) => mk >= CUR_MK)
    .reduce((s, [, v]) => s + (v || 0), 0)

// 'under' = has remaining fee but future allocations don't cover it
// 'over'  = allocated more than remaining
// null    = fully allocated or billed out
export const phVal = ph => {
  const rem   = phRem(ph)
  if (rem <= 0) return null
  const alloc = phAlloc(ph)
  if (alloc < rem) return 'under'
  if (alloc > rem) return 'over'
  return null
}

// ── Project calculations ─────────────────────────────────────────────────────

export const pFee = p =>
  (p.phases || []).reduce((s, ph) => s + phFeeTotal(ph), 0)

export const pBil = p =>
  (p.phases || []).reduce((s, ph) => s + (ph.billed || 0), 0)

export const pYTD = p =>
  (p.phases || []).reduce((s, ph) => s + phYTD(ph), 0)

export const pRem = p =>
  (p.phases || []).reduce((s, ph) => s + phRem(ph), 0)

// ── Persistent UI preferences ───────────────────────────────────────────────

import { useState, useCallback } from 'react'

export function useLocalPref(key, defaultValue) {
  const storageKey = 'fc_' + key
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch { return defaultValue }
  })
  const set = useCallback(v => {
    const next = typeof v === 'function' ? v(value) : v
    setValue(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }, [storageKey, value])
  return [value, set]
}

// ── Monthly goal with per-month overrides ────────────────────────────────────

export const getMonthlyGoal = (mk, settings) => {
  const overrides = settings?.billing?.monthlyGoalOverrides || {}
  if (overrides[mk]) return overrides[mk]
  return settings?.billing?.monthlyGoal || 395000
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export const clsx = (...args) =>
  args.filter(Boolean).join(' ')
