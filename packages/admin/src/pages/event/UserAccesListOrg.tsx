import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { InvitationModal } from '../../components/ui/InvitationModal'
import { DataTable } from '../../components/ui/DataTable'
import { ExportButton } from '../../components/ui/ExportButton'
import { useToast } from '../../components/ui/Toast'
import type { Evenement, UserEvenement, RoleLocal } from '../../types'
import { AddUserToEventModal } from './AddUserToEventModalOrg'
import { EditAccesModal } from './EditAccesModal'

export function UserAccesList({ ev, roleFilter }: { ev: Evenement; roleFilter: RoleLocal }) {
  const [acces, setAcces] = useState<UserEvenement[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UserEvenement | null>(null)
  const [inviting, setInviting] = useState<{ email: string; userId: string } | null>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const { notify, toastEl } = useToast()

  async function load() {
    const { data } = await sb.from('user_evenements')
      .select('*, users(nom, prenom, email), prestataires(raison_sociale)')
      .eq('evenement_id', ev.id)
      .eq('role_local', roleFilter)
    setAcces(data ?? [])
  }

  useEffect(() => { load() }, [roleFilter])

  async function revoke(id: string) {
    if (!confirm('Révoquer cet accès ?')) return
    const { error } = await sb.from('user_evenements').delete().eq('id', id)
    if (error) { notify(error.message, 'error'); return }
    await load()
  }

  const isPresta = roleFilter === 'prestataire'
  const title = isPresta ? 'Utilisateurs prestataires' : 'Utilisateurs'

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Ajouter</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={acces}
            exportFilename={`utilisateurs-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={a => setEditing(a)}
            emptyState={<div className="empty-state">{isPresta ? 'Aucun utilisateur prestataire.' : 'Aucun utilisateur.'}</div>}
            columns={[
              { key: 'utilisateur', label: 'Utilisateur', sortable: true, filterable: true, getValue: a => `${a.users?.prenom} ${a.users?.nom}`, render: a => <span style={{ fontWeight: 600 }}>{a.users?.prenom} {a.users?.nom}</span> },
              { key: 'email', label: 'Email', sortable: true, filterable: true, getValue: a => a.users?.email ?? '' },
              ...(isPresta ? [{ key: 'prestataire', label: 'Société', sortable: true, filterable: true, getValue: (a: UserEvenement) => a.prestataires?.raison_sociale ?? '' }] : []),
              { key: 'actions', label: '', render: (a: UserEvenement) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setInviting({ email: a.users?.email ?? '', userId: a.user_id }) }}>Invitation</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); revoke(a.id) }}>Révoquer</button>
                </div>
              )},
            ]}
          />
        </div>
      </div>
      {showModal && <AddUserToEventModal evenementId={ev.id} forcedRole={roleFilter} onClose={() => { setShowModal(false); load() }} />}
      {editing && <EditAccesModal acces={editing} onClose={() => { setEditing(null); load() }} />}
      {inviting && <InvitationModal email={inviting.email} userId={inviting.userId} notify={notify} onClose={() => setInviting(null)} />}
      {toastEl}
    </>
  )
}

export function TabUtilisateurs({ ev }: { ev: Evenement }) {
  return <UserAccesList ev={ev} roleFilter="organisateur" />
}
