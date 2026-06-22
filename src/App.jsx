import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAppState } from './hooks/useAppState'
import Login from './components/layout/Login.jsx'
import AppShell from './components/layout/AppShell.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Still checking auth
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <div className="text-olive text-sm">Loading…</div>
      </div>
    )
  }

  if (!session) return <Login />

  return <AuthedApp session={session} />
}

function AuthedApp({ session }) {
  const store = useAppState()

  if (!store.appState) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <div className="text-olive text-sm">
          <i className="ti ti-loader-2 spin mr-2" />
          Loading Feecast…
        </div>
      </div>
    )
  }

  return <AppShell session={session} store={store} />
}
