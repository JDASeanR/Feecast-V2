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
      setAppState({
        projects:      proj?.[0]?.data || DEFAULT_STATE.projects,
        invoices:      inv?.[0]?.data  || DEFAULT_STATE.invoices,
        opportunities: stData.opportunities || DEFAULT_STATE.opportunities,
        settings:      stData.settings      || DEFAULT_STATE.settings,
        nextId:        stData.nextId         || DEFAULT_STATE.nextId,
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
    try {
      const statePayload = {
        opportunities: newState.opportunities,
        settings:      newState.settings,
        nextId:        newState.nextId,
      }
      const [r1, r2, r3] = await Promise.all([
        supabase.from('projects').upsert({ key: 'projects', data: newState.projects }, { onConflict: 'key' }),
        supabase.from('invoices').upsert({ key: 'invoices', data: newState.invoices }, { onConflict: 'key' }),
        supabase.from('app_state').upsert({ key: 'state',   data: statePayload },      { onConflict: 'key' }),
      ])
      const err = r1.error || r2.error || r3.error
      if (err) {
        console.error('Supabase upsert error:', err)
        throw new Error(err.message || 'Upsert error')
      }
      lastSavedAt.current = Date.now()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }, [])

  // ── Presence polling ──────────────────────────────────────────────────────
  const pollPresence = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const currentEmail = user?.email || ''
      const { data } = await supabase
        .from('app_state')
        .select('key,data')
        .like('key', 'presence:%')
      const users = (data || [])
        .filter(r => r.key !== `presence:${currentEmail}`)
        .map(r => r.key.replace('presence:', ''))
      setPresence(users)
    } catch (err) { }
  }, [])

  useEffect(() => {
    pollTimer.current = setInterval(pollPresence, POLL_INTERVAL)
    return () => clearInterval(pollTimer.current)
  }, [pollPresence])

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
    reload: load,
    saveStatus,
    presence,
    updateAvail,
    dismissUpdate: () => { setUpdateAvail(false); load() },
  }
}
