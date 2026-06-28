import { useState } from 'react'
import type { Theme } from '../hooks/useTheme'

interface Props {
  theme: Theme
  onThemeChange: (t: Theme) => void
  onClose: () => void
  notifPermission: NotificationPermission
  notifSupported: boolean
  onRequestNotif: () => Promise<void>
}

export function SettingsModal({ theme, onThemeChange, onClose, notifPermission, notifSupported, onRequestNotif }: Props) {
  const [subscribing, setSubscribing] = useState(false)

  async function enableNotifications() {
    setSubscribing(true)
    await onRequestNotif()
    setSubscribing(false)
  }

  const notifLabel = !notifSupported ? '⚠️ Non supportées sur cet appareil' : notifPermission === 'granted' ? '✅ Activées' : notifPermission === 'denied' ? '🚫 Bloquées par le navigateur' : '⏳ Non activées'
  const canRequest = notifSupported && notifPermission === 'default'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>⚙️ Paramètres</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Apparence</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => onThemeChange('light')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`, background: theme === 'light' ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: theme === 'light' ? 600 : 400, color: theme === 'light' ? 'var(--accent-dark)' : 'var(--text-muted)' }}
              >
                ☀️ Clair
              </button>
              <button
                onClick={() => onThemeChange('dark')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`, background: theme === 'dark' ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: theme === 'dark' ? 600 : 400, color: theme === 'dark' ? 'var(--accent-dark)' : 'var(--text-muted)' }}
              >
                🌙 Sombre
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Notifications push</div>
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg)', fontSize: 14, marginBottom: 12 }}>
              {notifLabel}
            </div>
            {canRequest && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={enableNotifications} disabled={subscribing}>
                {subscribing ? 'Activation…' : 'Activer les notifications'}
              </button>
            )}
            {notifPermission === 'denied' && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                Les notifications sont bloquées. Autorisez-les dans les paramètres de votre navigateur puis rechargez la page.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
