import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import type { Prestataire, PrestataireContact, User } from '../types'

function PrestataireForm({ p, onSaved }: { p: Prestataire | null; onSaved: () => void }) {
  const [nom, setNom] = useState(p?.raison_sociale ?? '')
  const [email, setEmail] = useState(p?.email_contact ?? '')
  const [tel, setTel] = useState(p?.telephone ?? '')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!nom) { setError('La raison sociale est obligatoire.'); return false }
    const payload = { raison_sociale: nom, email_contact: email || null, telephone: tel || null }
    const { error } = p
      ? await sb.from('prestataires').update(payload).eq('id', p.id)
      : await sb.from('prestataires').insert(payload)
    if (error) { setError(error.message); return false }
    onSaved()
    return true
  }

  return (
    <Modal title={p ? 'Modifier le prestataire' : 'Nouveau prestataire'} confirmLabel={p ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group"><label>Raison sociale</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Carpentier Décoration SARL" /></div>
      <div className="form-group"><label>Email de contact</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@societe.fr" /></div>
      <div className="form-group"><label>Téléphone</label><input value={tel} onChange={e => setTel(e.target.value)} placeholder="06 00 00 00 00" /></div>
    </Modal>
  )
}

function ContactsModal({ prestataire, onClose }: { prestataire: Prestataire; onClose: () => void }) {
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [contacts, setContacts] = useState<PrestataireContact[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [{ data: users }, { data: ctcts }] = await Promise.all([
      sb.from('users').select('*').order('nom'),
      sb.from('prestataire_contacts').select('*, users(id, nom, prenom, email)').eq('prestataire_id', prestataire.id),
    ])
    setAllUsers(users ?? [])
    setContacts(ctcts ?? [])
    const existingIds = new Set((ctcts ?? []).map((c: PrestataireContact) => c.user_id))
    const first = (users ?? []).find(u => !existingIds.has(u.id))
    setSelectedUser(first?.id ?? '')
  }

  useEffect(() => { load() }, [])

  const contactIds = new Set(contacts.map(c => c.user_id))
  const available = allUsers.filter(u => !contactIds.has(u.id))

  async function add(): Promise<boolean> {
    if (!selectedUser) return true
    const { error } = await sb.from('prestataire_contacts').insert({ user_id: selectedUser, prestataire_id: prestataire.id })
    if (error) { setError(error.message); return false }
    await load()
    return false // stay open
  }

  async function remove(contactId: string) {
    if (!confirm('Retirer cet intervenant ?')) return
    await sb.from('prestataire_contacts').delete().eq('id', contactId)
    load()
  }

  return (
    <Modal title={`Intervenants — ${prestataire.raison_sociale}`} confirmLabel={available.length ? 'Ajouter' : 'Fermer'} onClose={onClose} onConfirm={add}>
      <Alert message={error} />
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Ces personnes constituent l'annuaire de la société. Elles pourront ensuite être assignées sur un événement.
      </p>
      {contacts.length > 0 ? (
        <table style={{ marginBottom: 20 }}>
          <thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td>{c.users?.prenom} {c.users?.nom}</td>
                <td>{c.users?.email}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-muted" style={{ marginBottom: 20 }}>Aucun intervenant rattaché</div>
      )}
      {available.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Ajouter un intervenant</div>
          <div className="form-group">
            <label>Utilisateur</label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              {available.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.email})</option>)}
            </select>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function PrestatairesPage() {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [modal, setModal] = useState<Prestataire | null | 'new'>(null)
  const [contactsFor, setContactsFor] = useState<Prestataire | null>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  async function load() {
    const { data } = await sb.from('prestataires').select('*').order('raison_sociale')
    setPrestataires(data ?? [])
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Prestataires</div>
        <div className="page-subtitle">Sociétés intervenantes</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{prestataires.length} prestataire{prestataires.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Nouveau prestataire</button>
          </div>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <DataTable
            data={prestataires}
            exportFilename="prestataires"
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={p => setModal(p)}
            emptyState={
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <div>Aucun prestataire enregistré</div>
                <div className="mt-4"><button className="btn btn-primary" onClick={() => setModal('new')}>Ajouter un prestataire</button></div>
              </div>
            }
            columns={[
              { key: 'raison_sociale', label: 'Raison sociale', sortable: true, filterable: true, render: p => <span style={{ fontWeight: 600 }}>{p.raison_sociale}</span> },
              { key: 'email_contact', label: 'Email contact', sortable: true, filterable: true },
              { key: 'telephone', label: 'Téléphone', filterable: true },
              { key: 'actions', label: '', render: p => (
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setContactsFor(p) }}>Intervenants</button>
              )},
            ]}
          />
        </div>
      </div>

      {modal !== null && (
        <PrestataireForm p={modal === 'new' ? null : modal} onSaved={() => { setModal(null); load() }} />
      )}
      {contactsFor && (
        <ContactsModal prestataire={contactsFor} onClose={() => setContactsFor(null)} />
      )}
    </>
  )
}
