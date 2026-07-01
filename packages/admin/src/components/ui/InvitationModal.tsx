import { useState } from 'react'
import { sb, sbAdmin } from '../../lib/supabase'
import { Modal } from './Modal'

type Notify = (msg: string, type?: 'success' | 'error') => void

interface Props {
  email: string
  userId: string
  onClose: () => void
  notify: Notify
}

export function InvitationModal({ email, userId, onClose, notify }: Props) {
  const [setInitialPassword, setSetInitialPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function confirm(): Promise<boolean> {
    setLoading(true)
    try {
      if (setInitialPassword) {
        const { error } = await sbAdmin.auth.admin.updateUserById(userId, {
          password: email,
          user_metadata: { force_password_change: true },
        })
        if (error) { notify(`Erreur : ${error.message}`, 'error'); return false }
        notify(`Mot de passe initialisé pour ${email} — connexion avec l'adresse email comme MDP`, 'success')
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) { notify(`Erreur : ${error.message}`, 'error'); return false }
        notify(`Email d'invitation envoyé à ${email}`, 'success')
      }
      return true
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Envoyer une invitation"
      confirmLabel={loading ? 'En cours…' : setInitialPassword ? 'Initialiser le MDP' : 'Envoyer l\'email'}
      onClose={onClose}
      onConfirm={confirm}
    >
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        Destinataire : <strong>{email}</strong>
      </p>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={setInitialPassword}
          onChange={e => setSetInitialPassword(e.target.checked)}
          style={{ marginTop: 2, flexShrink: 0, width: 'auto' }}
        />
        <span>
          Définir le mot de passe initial à l'adresse email
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            L'utilisateur devra modifier son mot de passe à la prochaine connexion. Aucun email envoyé.
          </span>
        </span>
      </label>

      {!setInitialPassword && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Un email contenant un lien de connexion sera envoyé à l'utilisateur.
        </p>
      )}
    </Modal>
  )
}
