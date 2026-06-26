import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const BADGE_COLORS = ['#BD6439','#736F4C','#2563EB','#16A34A','#8E44AD','#c0392b']

// Shared AudioContext — created once on first user gesture so Safari allows it
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}
// Unlock on any click/keydown so Safari resumes the context
if (typeof window !== 'undefined') {
  const unlock = () => {
    try { getAudioCtx().resume() } catch {}
  }
  window.addEventListener('click', unlock, { once: false, passive: true })
  window.addEventListener('keydown', unlock, { once: false, passive: true })
}

function playChime(isMention = false) {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') { ctx.resume() }
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    const notes = isMention ? [880, 1100] : [660]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch {}
}

function hashColor(email) {
  let h = 0
  for (let i = 0; i < (email||'').length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffffffff
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length]
}

function initials(email) {
  return email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || '?'
}

function fmtTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Render message text with @mentions highlighted
function MessageText({ text, myEmail }) {
  const parts = text.split(/(@\w+)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const handle = part.slice(1).toLowerCase()
          const isMe = myEmail?.split('@')[0]?.toLowerCase() === handle
          return (
            <span key={i} style={{
              background: isMe ? 'rgba(189,100,57,0.25)' : 'rgba(255,255,255,0.2)',
              color: isMe ? '#BD6439' : 'inherit',
              borderRadius: 3, padding: '0 3px', fontWeight: 600,
            }}>{part}</span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// @ mention autocomplete
function MentionMenu({ suggestions, onSelect, style }) {
  if (!suggestions.length) return null
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      background: '#3D3935', borderRadius: 6, overflow: 'hidden',
      boxShadow: '0 -4px 16px rgba(61,57,53,0.2)', marginBottom: 4, ...style,
    }}>
      {suggestions.map(s => (
        <button key={s} onClick={() => onSelect(s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '7px 12px', background: 'none',
            border: 'none', cursor: 'pointer', color: '#F5F5F1', fontSize: 12,
            fontFamily: 'inherit', textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: hashColor(s + '@'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: '#fff', fontWeight: 700, flexShrink: 0,
          }}>
            {s.slice(0, 2).toUpperCase()}
          </div>
          @{s}
        </button>
      ))}
    </div>
  )
}

export default function ChatDrawer({ session, open, onClose, onUnread, onToast, pms = [] }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mentionQuery, setMentionQuery] = useState(null) // null | string
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const myEmail = session?.user?.email || ''

  // All known handles for @ mentions (PMs + current user)
  const allHandles = [
    ...pms.map(p => (p.email || '').split('@')[0]).filter(Boolean),
    myEmail.split('@')[0],
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  // Load messages
  useEffect(() => {
    setLoading(true)
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { console.error('Chat load error:', error); setError('Could not load messages.') }
        else setMessages(data || [])
        setLoading(false)
      })
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('chat_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => {
          // Skip optimistic duplicates (matched by temp id or same content+user within 3s)
          if (prev.find(m => m.id === payload.new.id)) return prev
          const isOptimistic = prev.find(m =>
            m._optimistic &&
            m.user_email === payload.new.user_email &&
            m.text === payload.new.text
          )
          if (isOptimistic) {
            return prev.map(m => m._optimistic && m.text === payload.new.text && m.user_email === payload.new.user_email
              ? payload.new : m)
          }
          return [...prev, payload.new]
        })
        if (payload.new.user_email !== myEmail) {
          const isMention = payload.new.text.includes('@' + myEmail.split('@')[0])
          playChime(isMention)
          if (!open) {
            onToast?.(payload.new)
          } else {
            // Drawer is open — only ping unread if it's a mention
            if (isMention) onToast?.(payload.new)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open, myEmail, onUnread])

  // Scroll to bottom
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      if (messages.length > 0) inputRef.current?.focus()
    }
  }, [open, messages.length])

  const send = useCallback(async () => {
    const t = text.trim()
    if (!t || sending) return
    setError(null)
    setSending(true)
    setText('')
    setMentionQuery(null)

    // Optimistic insert
    const optimistic = { id: 'opt_' + Date.now(), user_email: myEmail, text: t, created_at: new Date().toISOString(), _optimistic: true }
    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({ user_email: myEmail, text: t })
    if (error) {
      console.error('Chat send error:', error)
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(t)
      setError('Failed to send. Check your connection.')
    }
    setSending(false)
  }, [text, sending, myEmail])

  const handleKey = e => {
    if (mentionQuery !== null) {
      if (e.key === 'Escape') { setMentionQuery(null); return }
      const filtered = allHandles.filter(h => h.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); insertMention(filtered[0]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) { e.preventDefault(); send() }
  }

  const handleInput = e => {
    const val = e.target.value
    setText(val)
    // Detect @ mention
    const match = val.slice(0, e.target.selectionStart).match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
    // Auto-grow
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  const insertMention = handle => {
    const pos = inputRef.current?.selectionStart || text.length
    const before = text.slice(0, pos).replace(/@\w*$/, '')
    const after = text.slice(pos)
    const newText = before + '@' + handle + ' ' + after
    setText(newText)
    setMentionQuery(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = (before + '@' + handle + ' ').length
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const mentionSuggestions = mentionQuery !== null
    ? allHandles.filter(h => h.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : []

  // Group messages
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1]
    const sameAuthor = prev?.user_email === msg.user_email
    const closeInTime = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000
    acc.push({ ...msg, showHeader: !sameAuthor || !closeInTime })
    return acc
  }, [])

  return (
    <>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, zIndex:9991,
        width:360, background:'#F5F5F1',
        boxShadow: open ? '-4px 0 32px rgba(61,57,53,0.2)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.25s ease',
        display:'flex', flexDirection:'column',
      }}>

        {/* Header */}
        <div style={{ background:'#3D3935', padding:'12px 16px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="ti ti-message-circle" style={{ fontSize:18, color:'#BD6439' }} />
            <div>
              <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:16, letterSpacing:'0.04em', color:'#F5F5F1' }}>TEAM CHAT</div>
              <div style={{ fontSize:10, color:'rgba(245,245,241,0.45)', marginTop:1 }}>JD+A Feecast · type @ to mention</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(245,245,241,0.5)', fontSize:16 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:2 }}>
          {loading && (
            <div style={{ textAlign:'center', color:'#a09c85', fontSize:12, marginTop:24 }}>
              <i className="ti ti-loader-2 spin" /> Loading…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign:'center', color:'#a09c85', fontSize:12, marginTop:40 }}>
              <i className="ti ti-message-circle" style={{ fontSize:32, display:'block', marginBottom:8, opacity:0.3 }} />
              No messages yet — say hello!
            </div>
          )}
          {grouped.map(msg => {
            const isMe = msg.user_email === myEmail
            const color = hashColor(msg.user_email)
            const isMentioned = msg.text.includes('@' + myEmail.split('@')[0])
            return (
              <div key={msg.id} style={{ marginTop: msg.showHeader ? 12 : 2, opacity: msg._optimistic ? 0.6 : 1 }}>
                {msg.showHeader && (
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontFamily:'"League Gothic",sans-serif', color:'#fff', flexShrink:0 }}>
                      {initials(msg.user_email)}
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#3D3935' }}>
                        {isMe ? 'You' : msg.user_email.split('@')[0]}
                      </span>
                      <span style={{ fontSize:10, color:'#a09c85' }}>{fmtTime(msg.created_at)}</span>
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', paddingLeft: isMe ? 0 : 33, paddingRight: isMe ? 33 : 0 }}>
                  <div style={{
                    background: isMe ? '#3D3935' : '#fff',
                    color: isMe ? '#F5F5F1' : '#3D3935',
                    borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    padding:'8px 12px', fontSize:13, lineHeight:1.5,
                    maxWidth:'82%', wordBreak:'break-word',
                    boxShadow: isMentioned ? '0 0 0 2px #BD6439' : '0 1px 3px rgba(61,57,53,0.08)',
                    border: isMe ? 'none' : '1px solid rgba(61,57,53,0.08)',
                  }}>
                    <MessageText text={msg.text} myEmail={myEmail} />
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin:'0 12px 8px', padding:'7px 10px', background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.2)', borderRadius:5, fontSize:11, color:'#c0392b', display:'flex', alignItems:'center', gap:6 }}>
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'10px 14px 12px', borderTop:'1px solid rgba(61,57,53,0.1)', flexShrink:0, background:'#fff', position:'relative' }}>
          <MentionMenu suggestions={mentionSuggestions} onSelect={insertMention} />
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKey}
              placeholder="Message the team…"
              rows={1}
              style={{
                flex:1, resize:'none', border:'1px solid rgba(61,57,53,0.15)',
                borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:'inherit',
                lineHeight:1.5, outline:'none', background:'#F5F5F1', maxHeight:100, overflow:'auto',
              }}
              onFocus={e => e.target.style.borderColor = '#BD6439'}
              onBlur={e => e.target.style.borderColor = 'rgba(61,57,53,0.15)'}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{
                width:36, height:36, borderRadius:8, border:'none',
                cursor: text.trim() ? 'pointer' : 'default',
                background: text.trim() ? '#BD6439' : '#ECEAE3',
                color: text.trim() ? '#fff' : '#a09c85',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, transition:'all 0.15s',
              }}>
              <i className="ti ti-send" style={{ fontSize:15 }} />
            </button>
          </div>
          <div style={{ fontSize:10, color:'#a09c85', marginTop:5 }}>Enter to send · Shift+Enter for new line · @ to mention</div>
        </div>

      </div>
    </>
  )
}
