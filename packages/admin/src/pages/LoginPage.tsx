import { useState } from 'react'
import { sb } from '../lib/supabase'
import { Alert } from '../components/ui/Alert'
import { Spinner } from '../components/ui/Spinner'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await sb.auth.signInWithPassword({ email, password: pwd })
    if (error) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) { setError(error.message); setLoading(false); return }
    setResetSent(true)
    setLoading(false)
  }

  if (forgotMode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-title">Mot de passe oublié</div>
          <div className="auth-subtitle">Saisissez votre email pour recevoir un lien de réinitialisation.</div>
          {resetSent ? (
            <div style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', padding: '16px 0' }}>
              Email envoyé ! Vérifiez votre boîte mail.
            </div>
          ) : (
            <form onSubmit={sendReset}>
              <Alert message={error} />
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required autoFocus />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} type="submit">
                {loading ? <Spinner /> : 'Envoyer le lien'}
              </button>
            </form>
          )}
          <button onClick={() => { setForgotMode(false); setResetSent(false); setError('') }}
            style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, width: '100%' }}>
            ← Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-title">Expogate</div>
        <div className="auth-subtitle">Connectez-vous pour accéder à votre espace</div>
        <Alert message={error} />
        <form onSubmit={login}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} type="submit">
            {loading ? <Spinner /> : 'Se connecter'}
          </button>
        </form>
        <button onClick={() => { setForgotMode(true); setError('') }}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, width: '100%' }}>
          Mot de passe oublié ?
        </button>
      </div>
    </div>
  )
}
