import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { normalizeEmail, isValidEmail } from '../../lib/normalize'
import type { Prestataire, User, RoleLocal } from '../../types'

export function AddUserToEventModal({ evenementId, forcedRole, forcedPrestaId, onClose }: { evenementId: string; forcedRole: RoleLocal; forcedPrestaId?: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [foundUser, setFoundUser] = useState<User | null>(null)
  const [step, setStep] = useState<'email' | 'found' | 'notfound'>('email')
  const [prestaId, setPrestaId] = useState(forcedPrestaId ?? '')
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (forcedRole === 'prestataire' && !forcedPrestaId) {
      sb.from('prestataires').select('*').order('raison_sociale').then(({ data }) => {
        setPrestataires(data ?? [])
        if (data?.length) setPrestaId(data[0].id)
      })
    }
  }, [forcedRole, forcedPrestaId])

  async function confirm(): Promise<boolean> {
    setError('')
    if (step === 'email') {
      if (!email) { setError('Saisissez un email.'); return false }
      if (!isValidEmail(email)) { setError("Format d'email invalide."); return false }
      const { data } = await sb.from('users').select('*').eq('email', normalizeEmail(email)).maybeSingle()
      if (data) { setFoundUser(data); setStep('found') }
      else { setStep('notfound') }
      return false
    }
    if (step === 'notfound') return false
    if (!foundUser) return false

    const { error: accesError } = await sb.from('user_evenements').upsert(
      { user_id: foundUser.id, evenement_id: evenementId, role_local: forcedRole, prestataire_id: forcedRole === 'prestataire' ? prestaId : null },
      { onConflict: 'user_id,evenement_id' }
    )
    if (accesError) { setError(accesError.message); return false }
    onClose(); return true
  }

  const PrestaField = () => forcedRole === 'prestataire' && !forcedPrestaId ? (
    <div className="form-group">
      <label>Société prestataire</label>
      <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
        {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
      </select>
    </div>
  ) : null

  return (
    <Modal
      title={forcedRole === 'prestataire' ? 'Ajouter un utilisateur prestataire' : 'Ajouter un utilisateur'}
      confirmLabel={step === 'email' ? 'Vérifier' : step === 'found' ? 'Ajouter' : 'OK'}
      onClose={onClose}
      onConfirm={confirm}
    >
      <Alert message={error} />
      {step === 'email' && (
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmail(normalizeEmail(email))} autoFocus />
        </div>
      )}
      {step === 'found' && foundUser && (
        <>
          <div className="form-group">
            <label>Compte trouvé</label>
            <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontWeight: 600 }}>
              {foundUser.prenom} {foundUser.nom} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({foundUser.email})</span>
            </div>
          </div>
          <PrestaField />
        </>
      )}
      {step === 'notfound' && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Aucun compte trouvé pour <strong>{email}</strong>. La création de compte se fait depuis le back-office admin.
        </div>
      )}
    </Modal>
  )
}
