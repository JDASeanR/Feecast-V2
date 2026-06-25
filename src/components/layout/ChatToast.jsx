import { useEffect, useRef } from 'react'

function hashColor(email) {
  const COLORS = ['#BD6439','#736F4C','#2563EB','#16A34A','#8E44AD','#c0392b']
  let h = 0
  for (let i = 0; i < (email||'').length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function initials(email) {
  return email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || '?'
}

// toast: { id, user_email, text, isMention }
export default function ChatToast({ toasts, onDismiss, onOpenChat }) {
  return (
    <div style={{
      position: 'fixed', top: 72, right: 16, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onOpenChat={onOpenChat} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onDismiss, onOpenChat }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(t.id), t.isMention ? 8000 : 5000)
    return () => clearTimeout(timerRef.current)
  }, [t.id, t.isMention, onDismiss])

  const color = hashColor(t.user_email)
  const sender = t.user_email.split('@')[0]
  const preview = t.text.length > 80 ? t.text.slice(0, 80) + '…' : t.text

  return (
    <div
      onClick={() => { onOpenChat(); onDismiss(t.id) }}
      style={{
        pointerEvents: 'all', cursor: 'pointer',
        background: t.isMention ? '#3D3935' : '#fff',
        border: t.isMention ? '2px solid #BD6439' : '1px solid rgba(61,57,53,0.15)',
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(61,57,53,0.2)',
        width: 300, display: 'flex', gap: 10, alignItems: 'flex-start',
        animation: 'slideInToast 0.2s ease',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontFamily: '"League Gothic",sans-serif', color: '#fff',
        border: t.isMention ? '2px solid #BD6439' : 'none',
      }}>
        {initials(t.user_email)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {t.isMention && (
            <span style={{ fontSize: 10, background: '#BD6439', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
              @mentioned you
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: t.isMention ? '#F5F5F1' : '#3D3935' }}>{sender}</span>
          <span style={{ fontSize: 10, color: t.isMention ? 'rgba(245,245,241,0.45)' : '#a09c85', marginLeft: 'auto' }}>
            <i className="ti ti-message-circle" style={{ fontSize: 11 }} /> Team Chat
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.isMention ? 'rgba(245,245,241,0.75)' : '#736F4C', lineHeight: 1.4, wordBreak: 'break-word' }}>
          {preview}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(t.id) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.isMention ? 'rgba(245,245,241,0.4)' : '#a09c85', fontSize: 13, padding: 0, flexShrink: 0 }}
      >
        <i className="ti ti-x" />
      </button>
    </div>
  )
}
