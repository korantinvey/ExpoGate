import { useState } from 'react'
import { sb } from '../lib/supabase'

export function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pwd.length < 8) { setError('Minimum 8 caractères.'); return }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    const { error } = await sb.auth.updateUser({ password: pwd })
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(onDone, 2000)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-title">Définir votre mot de passe</div>
        <div className="auth-subtitle">Choisissez un mot de passe pour accéder à votre compte.</div>
        {success ? (
          <div style={{ color: 'var(--accent-dark)', fontWeight: 600, textAlign: 'center', padding: '16px 0' }}>
            Mot de passe enregistré ! Redirection…
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="alert">{error}</div>}
            <div className="form-group">
              <label>Nouveau mot de passe</label>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Minimum 8 caractères" autoFocus />
            </div>
            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Répétez le mot de passe" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
              Enregistrer le mot de passe
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
