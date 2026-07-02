import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { normalizeNom, normalizePrenom, normalizeEmail, isValidEmail } from '../../lib/normalize'
import type { Prestataire, User, RoleLocal } from '../../types'

type AddStep = 'email' | 'found' | 'new'

export function AddUserToEventModal({ evenementId, forcedRole, forcedPrestaId, onClose }: { evenementId: string; forcedRole: RoleLocal; forcedPrestaId?: string; onClose: () => void }) {
  const [step, setStep] = useState<AddStep>('email')
  const [email, setEmail] = useState('')
  const [existingUser, setExistingUser] = useState<User | null>(null)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
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
      if (data) { setExistingUser(data); setStep('found') }
      else { setStep('new') }
      return false
    }

    let userId: string
    if (step === 'found' && existingUser) {
      userId = existingUser.id
    } else {
      if (!prenom || !nom) { setError('Prénom et nom sont obligatoires.'); return false }
      const { data, error: createError } = await sbAdmin.auth.admin.createUser({
        email: normalizeEmail(email), email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: { prenom, nom },
      })
      if (createError) { setError(createError.message); return false }
      await sbAdmin.from('users').update({ prenom, nom, is_admin: false }).eq('id', data.user.id)
      userId = data.user.id
    }

    const { error: accesError } = await sb.from('user_evenements').upsert(
      { user_id: userId, evenement_id: evenementId, role_local: forcedRole, prestataire_id: forcedRole === 'prestataire' ? prestaId : null },
      { onConflict: 'user_id,evenement_id' }
    )
    if (accesError) { setError(accesError.message); return false }
    onClose(); return true
  }

  const confirmLabel = step === 'email' ? 'Vérifier' : step === 'found' ? 'Ajouter' : 'Créer et ajouter'
  const title = forcedRole === 'prestataire' ? 'Ajouter un utilisateur prestataire' : 'Ajouter un utilisateur'

  const PrestaField = () => forcedRole === 'prestataire' && !forcedPrestaId ? (
    <div className="form-group">
      <label>Société prestataire</label>
      <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
        {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
      </select>
    </div>
  ) : null

  return (
    <Modal title={title} confirmLabel={confirmLabel} onClose={onClose} onConfirm={confirm}>
      <Alert message={error} />
      {step === 'email' && (
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmail(normalizeEmail(email))} autoFocus />
        </div>
      )}
      {step === 'found' && existingUser && (
        <>
          <div className="form-group">
            <label>Compte existant</label>
            <div style={{ padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: 6, fontWeight: 600 }}>
              {existingUser.prenom} {existingUser.nom} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({existingUser.email})</span>
            </div>
          </div>
          <PrestaField />
        </>
      )}
      {step === 'new' && (
        <>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} disabled />
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Prénom</label><input value={prenom} onChange={e => setPrenom(e.target.value)} onBlur={() => setPrenom(normalizePrenom(prenom))} autoFocus /></div>
            <div className="form-group"><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} onBlur={() => setNom(normalizeNom(nom))} /></div>
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Un email d'invitation sera envoyé pour que l'utilisateur définisse son mot de passe.
          </div>
          <PrestaField />
        </>
      )}
    </Modal>
  )
}
