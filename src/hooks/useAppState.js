import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const POLL_INTERVAL = 10000 // 10 seconds

const DEFAULT_STATE = {
  projects:      [],
  invoices:      [],
  opportunities: [],
  settings: {
    pms:          [],
    clients:      [],
    scopeTypes:   [],
    projectTypes: [],
    statusTypes:  [],
    billing:      { annualGoal: 4740000 },
    firm:         { name: 'Jeffrey DeMure + Associates', digest: {} },
    hourly:       {},
  },
  nextId: 1,
}

export function useAppState() {
  const [appState, setAppState]   = useState(null)   // null = loading
  const [saveStatus, setSaveStatus] = useState(null)  // 'saving' | 'saved' | 'error'
  const [presence, setPresence]   = useState([])
  const [updateAvail, setUpdateAvail] = useState(false)
  const lastSavedAt = useRef(null)
  const pollTimer   = useRef(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [{ data: proj }, { data: inv }, { data: st }] = await Promise.all([
        supabase.from('projects').select('data').limit(1),
        supabase.from('invoices').select('data').limit(1),
        supabase.from('app_state').select('data').eq('key', 'state').limit(1),
      ])
      const stData = st?.[0]?.data || {}
      let projects = proj?.[0]?.data || DEFAULT_STATE.projects
      let nextId   = stData.nextId   || DEFAULT_STATE.nextId

      // Migrate: assign IDs to any project or phase missing them
      const needsMigration = projects.some(p => p.id == null || p.phases?.some(ph => ph.id == null))
      if (needsMigration) {
        projects = projects.map(p => {
          let pid = p.id ?? nextId++
          const phases = (p.phases || []).map(ph => ({
            ...ph,
            id: ph.id ?? nextId++,
          }))
          return { ...p, id: pid, phases }
        })
      }

      // Migrate: stamp only the correct recently-added projects, clear any wrong stamps
      const recentNames = ['Lippi Ranch', 'ParkeBridge', '26044 E']
      const match = p => recentNames.findIndex(n => (p.project || '').toLowerCase().includes(n.toLowerCase()))
      const hasWrongStamps = projects.some(p => p.createdAt && match(p) < 0)
      const missingStamps  = projects.some(p => !p.createdAt && match(p) >= 0)
      if (hasWrongStamps || missingStamps) {
        const now = Date.now()
        projects = projects.map(p => {
          const rank = match(p)
          if (rank >= 0) {
            return { ...p, createdAt: p.createdAt || new Date(now - rank * 36 * 3600000).toISOString() }
          }
          const { createdAt, ...rest } = p
          return rest
        })
      }

      setAppState({
        projects,
        invoices:      inv?.[0]?.data  || DEFAULT_STATE.invoices,
        opportunities: stData.opportunities || DEFAULT_STATE.opportunities,
        settings:      stData.settings      || DEFAULT_STATE.settings,
        nextId,
      })
      lastSavedAt.current = Date.now()
    } catch (err) {
      console.error('Load failed:', err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async (newState) => {
    setSaveStatus('saving')
    const ts = new Date().toISOString()

    async function upsertRow(table, data) {
      try {
        const { data: ex } = await supabase.from(table).select('id').limit(1).single()
        if (ex) {
          await supabase.from(table).update({ data, updated_at: ts }).eq('id', ex.id)
        } else {
          await supabase.from(table).insert({ data, updated_at: ts })
        }
      } catch(e) {
        try { await supabase.from(table).insert({ data, updated_at: ts }) }
        catch(e2) { throw new Error(`${table} save failed: ${e2.message}`) }
      }
    }

    async function upsertState(key, data) {
      const { error } = await supabase.from('app_state')
        .upsert({ key, data, updated_at: ts }, { onConflict: 'key' })
      if (error) {
        await supabase.from('app_state').delete().eq('key', key)
        await supabase.from('app_state').insert({ key, data, updated_at: ts })
      }
    }

    try {
      const statePayload = {
        opportunities: newState.opportunities,
        settings:      newState.settings,
        nextId:        newState.nextId,
      }
      await Promise.all([
        upsertRow('projects', newState.projects),
        upsertRow('invoices', newState.invoices),
        upsertState('state', statePayload),
      ])
      lastSavedAt.current = Date.now()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }, [])

  // ── Presence heartbeat + polling ───────────────────────────────────────────
  const STALE_MS = 30000

  const heartbeat = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      const key = `presence:${user.email}`
      await supabase.from('app_state').upsert(
        { key, data: { ts: Date.now() }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    } catch {}
  }, [])

  const pollPresence = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const currentEmail = user?.email || ''
      const { data } = await supabase
        .from('app_state')
        .select('key,data')
        .like('key', 'presence:%')
      const now = Date.now()
      const users = (data || [])
        .filter(r => r.key !== `presence:${currentEmail}`)
        .filter(r => r.data?.ts && (now - r.data.ts) < STALE_MS)
        .map(r => r.key.replace('presence:', ''))
      setPresence(users)
    } catch (err) { }
  }, [])

  useEffect(() => {
    heartbeat()
    pollPresence()
    pollTimer.current = setInterval(() => { heartbeat(); pollPresence() }, POLL_INTERVAL)
    return () => {
      clearInterval(pollTimer.current)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) supabase.from('app_state').delete().eq('key', `presence:${user.email}`)
      })
    }
  }, [heartbeat, pollPresence])

  // ── Mutate helper ─────────────────────────────────────────────────────────
  const mutate = useCallback((updater) => {
    setAppState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      save(next)
      return next
    })
  }, [save])

  return {
    appState,
    mutate,
    save,
    reload: load,
    saveStatus,
    presence,
    updateAvail,
    dismissUpdate: () => { setUpdateAvail(false); load() },
  }
}
