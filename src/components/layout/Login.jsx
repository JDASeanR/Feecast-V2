import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const handleLogin = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="font-display text-5xl font-bold text-dark tracking-tight">
            Fee<span className="text-terracotta">cast</span>
          </div>
          <div className="text-xs text-olive mt-1 tracking-widest uppercase">
            Jeffrey DeMure + Associates
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-sm border border-sand-3 p-6 space-y-4">
          <div>
            <label className="block text-2xs font-semibold text-olive uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@jdaarch.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-2xs font-semibold text-olive uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-xs text-flag bg-red-50 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center py-2 text-sm"
          >
            {loading
              ? <><i className="ti ti-loader-2 spin" /> Signing in…</>
              : 'Sign in'
            }
          </button>
        </form>

        <div className="text-center mt-4 text-2xs text-dark-3">
          Feecast · Confidential
        </div>
      </div>
    </div>
  )
}
