import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { InvitationModal } from '../../components/ui/InvitationModal'
import { SyncDot } from '../../components/ui/SyncDot'
import { useToast } from '../../components/ui/Toast'
import { getPendingPrestaIds } from '../../lib/db'
import type { Prestataire, UserEvenement, Prestation } from '../../types'
import { STATUT_LABELS, STATUT_COLORS, conformiteBg } from './helpers'
import { AddUserToEventModal } from './AddUserToEventModal'
import { EditMembreModal } from './EditMembreModal'
import { PrestationForm } from './PrestationForm'

type Notify = (msg: string, type?: 'success' | 'error') => void

async function impersonate(email: string, notify: Notify) {
  if (!email) return
  const { data, error } = await sbAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: window.location.origin },
  })
  if (error || !data.properties?.action_link) {
    notify(`Erreur : ${error?.message ?? 'lien non généré'}`, 'error')
    return
  }
  await navigator.clipboard.writeText(data.properties.action_link)
  notify("Lien copié — ouvrez-le dans une fenêtre privée (le coller dans la barre d'adresse)", 'success')
}

export function PrestataireDetailModal({ prestataire, evenementId, onClose }: { prestataire: Prestataire; evenementId: string; onClose: () => void }) {
  const [nom, setNom] = useState(prestataire.raison_sociale)
  const [email, setEmail] = useState(prestataire.email_contact ?? '')
  const [tel, setTel] = useState(prestataire.telephone ?? '')
  const [membres, setMembres] = useState<UserEvenement[]>([])
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set())
  const [addModal, setAddModal] = useState(false)
  const [editingMembre, setEditingMembre] = useState<UserEvenement | null>(null)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [inviting, setInviting] = useState<{ email: string; userId: string } | null>(null)
  const [infoError, setInfoError] = useState('')
  const { notify, toastEl } = useToast()

  async function loadMembres() {
    const { data } = await sb.from('user_evenements')
      .select('*, users(nom, prenom, email)')
      .eq('evenement_id', evenementId)
      .eq('prestataire_id', prestataire.id)
    setMembres(data ?? [])
  }

  async function loadPrestations() {
    const { data: stands } = await sb.from('stands').select('id').eq('evenement_id', evenementId).eq('deleted', false)
    const standIds = (stands ?? []).map(s => s.id)
    if (!standIds.length) { setPrestations([]); setPendingSyncIds(new Set()); return }
    const { data } = await sb.from('prestations')
      .select('*, stands(numero, nom_exposant), users(nom, prenom)')
      .in('stand_id', standIds)
      .eq('deleted', false)
      .eq('prestataire_id', prestataire.id)
      .order('libelle')
    if (data) {
      setPrestations(data)
      setPendingSyncIds(await getPendingPrestaIds(data.map(p => p.id)))
    }
  }

  useEffect(() => { loadMembres(); loadPrestations() }, [])

  async function saveInfo(): Promise<boolean> {
    if (!nom) { setInfoError('La raison sociale est obligatoire.'); return false }
    const { error } = await sb.from('prestataires').update({ raison_sociale: nom, email_contact: email || null, telephone: tel || null }).eq('id', prestataire.id)
    if (error) { setInfoError(error.message); return false }
    onClose(); return true
  }

  async function revokeMembre(id: string) {
    if (!confirm('Retirer ce membre ?')) return
    const { error } = await sb.from('user_evenements').delete().eq('id', id)
    if (error) { notify(error.message, 'error'); return }
    loadMembres()
  }

  async function retirerDeLEvenement() {
    if (!confirm(`Retirer "${prestataire.raison_sociale}" de cet événement ?\n\nTous ses membres seront révoqués. Les prestations associées resteront mais sans accès utilisateur.`)) return
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb.from('user_evenements').delete().eq('evenement_id', evenementId).eq('prestataire_id', prestataire.id),
      sb.from('evenement_prestataires').delete().eq('evenement_id', evenementId).eq('prestataire_id', prestataire.id),
    ])
    if (e1 || e2) { notify((e1 ?? e2)!.message, 'error'); return }
    onClose()
  }

  return (
    <>
      <Modal title={prestataire.raison_sociale} confirmLabel="Enregistrer" onClose={onClose} onConfirm={saveInfo}
        footer={<button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={retirerDeLEvenement}>Retirer de l'événement</button>}
      >
        <Alert message={infoError} />
        <div className="form-group"><label>Raison sociale</label><input value={nom} onChange={e => setNom(e.target.value)} /></div>
        <div className="grid-2">
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="form-group"><label>Téléphone</label><input value={tel} onChange={e => setTel(e.target.value)} /></div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Prestations sur cet événement</div>
          {prestations.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Aucune prestation assignée.</div>
          ) : (() => {
            const total = prestations.length
            const avecAnomalie = prestations.filter(p => p.anomalie).length
            const tauxAnomalie = Math.round((avecAnomalie / total) * 100)
            const delaisMs = prestations
              .filter(p => p.date_anomalie && p.date_retour_a_verifier)
              .map(p => new Date(p.date_retour_a_verifier!).getTime() - new Date(p.date_anomalie!).getTime())
            const delaiMoyenMs = delaisMs.length > 0 ? delaisMs.reduce((a, b) => a + b, 0) / delaisMs.length : null
            function formatDuree(ms: number): string {
              const h = Math.floor(ms / 3600000)
              const m = Math.floor((ms % 3600000) / 60000)
              if (h >= 24) { const j = Math.floor(h / 24); const hr = h % 24; return hr > 0 ? `${j}j ${hr}h` : `${j}j` }
              return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
            }
            return (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Taux d'anomalie</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: avecAnomalie > 0 ? 'var(--danger)' : 'var(--success)' }}>{tauxAnomalie}%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{avecAnomalie} / {total} prestation{total > 1 ? 's' : ''}</div>
                  </div>
                  {delaiMoyenMs !== null && (
                    <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Délai moy. remise en conformité</div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{formatDuree(delaiMoyenMs)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>sur {delaisMs.length} prestation{delaisMs.length > 1 ? 's' : ''}</div>
                    </div>
                  )}
                </div>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Stand</th>
                    <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Libellé</th>
                    <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Conformité</th>
                    <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Anomalie</th>
                  </tr></thead>
                  <tbody>
                    {prestations.map(p => (
                      <tr key={p.id} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)', ...conformiteBg(p.statut_conformite) }} onClick={() => setEditingPrestation(p)}>
                        <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{p.stands?.numero}{p.stands?.nom_exposant ? ` — ${p.stands.nom_exposant}` : ''}</td>
                        <td style={{ padding: '8px 8px 8px 0' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <SyncDot pending={pendingSyncIds.has(p.id)} />
                            {p.libelle}
                          </span>
                        </td>
                        <td style={{ padding: '8px 8px 8px 0' }}>
                          {p.statut_conformite
                            ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: '8px 0' }}>
                          {p.anomalie
                            ? <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>Oui</span>
                            : <span className="text-muted" style={{ fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          })()}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Membres sur cet événement</div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>+ Ajouter</button>
          </div>
          {membres.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Aucun membre pour cet événement.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {membres.map(m => (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setEditingMembre(m)}>
                    <td style={{ fontWeight: 600 }}>{m.users?.prenom} {m.users?.nom}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.users?.email}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setInviting({ email: m.users?.email ?? '', userId: m.user_id }) }}>Invitation</button>
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); impersonate(m.users?.email ?? '', notify) }}>Voir en tant que</button>
                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); revokeMembre(m.id) }}>Retirer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
      {addModal && <AddUserToEventModal evenementId={evenementId} forcedRole="prestataire" forcedPrestaId={prestataire.id} onClose={() => { setAddModal(false); loadMembres() }} />}
      {editingMembre && <EditMembreModal membre={editingMembre} onClose={() => { setEditingMembre(null); loadMembres() }} />}
      {editingPrestation && <PrestationForm readOnly canDelete prest={editingPrestation} evenementId={evenementId} onSaved={() => { setEditingPrestation(null); loadPrestations() }} onGoToStands={() => setEditingPrestation(null)} />}
      {inviting && <InvitationModal email={inviting.email} userId={inviting.userId} notify={notify} onClose={() => setInviting(null)} />}
      {toastEl}
    </>
  )
}
