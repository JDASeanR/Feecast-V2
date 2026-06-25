import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const BADGE_COLORS = ['#BD6439','#736F4C','#2563EB','#16A34A','#8E44AD','#c0392b']

function hashColor(email) {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffffffff
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ChatDrawer({ session, open, onClose, onUnread }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const myEmail = session?.user?.email || ''

  // Load recent messages
  useEffect(() => {
    setLoading(true)
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) setMessages(data)
        setLoading(false)
      })
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, payload => {
        setMessages(prev => {
          const exists = prev.find(m => m.id === payload.new.id)
          if (exists) return prev
          return [...prev, payload.new]
        })
        if (!open && payload.new.user_email !== myEmail) {
          onUnread(n => n + 1)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open, myEmail, onUnread])

  // Scroll to bottom when messages change or drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      inputRef.current?.focus()
    }
  }, [open, messages.length])

  const send = useCallback(async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setText('')
    const { error } = await supabase.from('messages').insert({ user_email: myEmail, text: t })
    if (error) {
      setText(t) // restore on failure
      console.error('Chat send error:', error)
    }
    setSending(false)
  }, [text, sending, myEmail])

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Group consecutive messages from same sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1]
    const sameAuthor = prev?.user_email === msg.user_email
    const closeInTime = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000
    acc.push({ ...msg, showHeader: !sameAuthor || !closeInTime })
    return acc
  }, [])

  return (
    <>
      {/* Backdrop */}
      {open && <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9990 }} />}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9991,
        width: 360, background: '#F5F5F1',
        boxShadow: open ? '-4px 0 32px rgba(61,57,53,0.2)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ background:'#3D3935', padding:'12px 16px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="ti ti-message-circle" style={{ fontSize:18, color:'#BD6439' }} />
            <div>
              <div style={{ fontFamily:'"League Gothic",sans-serif', fontSize:16, letterSpacing:'0.04em', color:'#F5F5F1' }}>TEAM CHAT</div>
              <div style={{ fontSize:10, color:'rgba(245,245,241,0.45)', marginTop:1 }}>JD+A Feecast</div>
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
              <i className="ti ti-loader-2 spin" /> Loading messages…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign:'center', color:'#a09c85', fontSize:12, marginTop:32 }}>
              <i className="ti ti-message-circle" style={{ fontSize:28, display:'block', marginBottom:8, opacity:0.3 }} />
              No messages yet. Say hello!
            </div>
          )}
          {grouped.map(msg => {
            const isMe = msg.user_email === myEmail
            const color = hashColor(msg.user_email)
            return (
              <div key={msg.id} style={{ marginTop: msg.showHeader ? 10 : 2 }}>
                {msg.showHeader && (
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{
                      width:26, height:26, borderRadius:'50%', background:color,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontFamily:'"League Gothic",sans-serif', color:'#fff', flexShrink:0,
                    }}>
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
                    padding:'7px 11px', fontSize:13, lineHeight:1.5,
                    maxWidth:'80%', wordBreak:'break-word',
                    boxShadow:'0 1px 3px rgba(61,57,53,0.08)',
                    border: isMe ? 'none' : '1px solid rgba(61,57,53,0.08)',
                  }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(61,57,53,0.1)', flexShrink:0, background:'#fff' }}>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message the team…"
              rows={1}
              style={{
                flex:1, resize:'none', border:'1px solid rgba(61,57,53,0.15)',
                borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:'inherit',
                lineHeight:1.5, outline:'none', background:'#F5F5F1',
                maxHeight:100, overflow:'auto',
              }}
              onFocus={e => e.target.style.borderColor='#BD6439'}
              onBlur={e => e.target.style.borderColor='rgba(61,57,53,0.15)'}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                width:36, height:36, borderRadius:8, border:'none', cursor:text.trim()?'pointer':'default',
                background: text.trim() ? '#BD6439' : '#ECEAE3',
                color: text.trim() ? '#fff' : '#a09c85',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, transition:'all 0.15s',
              }}
            >
              <i className="ti ti-send" style={{ fontSize:15 }} />
            </button>
          </div>
          <div style={{ fontSize:10, color:'#a09c85', marginTop:5 }}>Enter to send · Shift+Enter for new line</div>
        </div>

      </div>
    </>
  )
}
