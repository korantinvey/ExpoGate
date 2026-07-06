import { useEffect, useState } from 'react'
import { Mail, Bell, Smartphone } from 'lucide-react'
import { sb, sbAdmin } from '../lib/supabase'
import { fmtDateHeure } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { useToast } from '../components/ui/Toast'
import { InvitationModal } from '../components/ui/InvitationModal'
import type { User } from '../types'
import { normalizeNom, normalizePrenom, normalizeEmail, isValidEmail } from '../lib/normalize'

function UserForm({ user, onSaved }: { user: User | null; onSaved: () => void }) {
  const [prenom, setPrenom] = useState(user?.prenom ?? '')
  const [nom, setNom] = useState(user?.nom ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false)
  const [pwd, setPwd] = useState('')
  const [forceChange, setForceChange] = useState(true)
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!prenom || !nom || !email) { setError('Tous les champs sont obligatoires.'); return false }
    if (!isValidEmail(email)) { setError('Format d\'email invalide.'); return false }
    if (pwd && pwd.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return false }
    if (user) {
      const newEmail = normalizeEmail(email)
      const authUpdate: Record<string, unknown> = {}
      if (newEmail !== user.email) authUpdate.email = newEmail
      if (pwd) {
        authUpdate.password = pwd
        authUpdate.user_metadata = { force_password_change: forceChange }
      }
      if (Object.keys(authUpdate).length) {
        const { error: authError } = await sbAdmin.auth.admin.updateUserById(user.id, authUpdate)
        if (authError) { setError(authError.message); return false }
      }
      const { error } = await sb.from('users').update({ prenom: normalizePrenom(prenom), nom: normalizeNom(nom), email: newEmail, is_admin: isAdmin }).eq('id', user.id)
      if (error) { setError(error.message); return false }
    } else {
      const { data, error: createError } = await sbAdmin.auth.admin.createUser({
        email: normalizeEmail(email), email_confirm: true,
        password: pwd || crypto.randomUUID(),
        user_metadata: { prenom, nom, force_password_change: pwd ? forceChange : false },
      })
      if (createError) { setError(createError.message); return false }
      await sbAdmin.from('users').update({ prenom, nom, is_admin: isAdmin }).eq('id', data.user.id)
    }
    onSaved()
    return true
  }

  return (
    <Modal
      title={user ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
      confirmLabel={user ? 'Enregistrer' : 'Créer'}
      onClose={onSaved}
      onConfirm={save}
    >
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group"><label>Prénom</label><input value={prenom} onChange={e => setPrenom(e.target.value)} onBlur={() => setPrenom(normalizePrenom(prenom))} /></div>
        <div className="form-group"><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} onBlur={() => setNom(normalizeNom(nom))} /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmail(normalizeEmail(email))} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>{user ? 'Nouveau mot de passe' : 'Mot de passe'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>{user ? '(laisser vide pour ne pas changer)' : '(laisser vide pour envoyer un lien)'}</span></label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Minimum 8 caractères" />
        </div>
        {pwd && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={forceChange} onChange={e => setForceChange(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
              L'utilisateur devra changer son mot de passe à la prochaine connexion
            </label>
          </div>
        )}
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />
            Administrateur plateforme
          </label>
        </div>
      </div>
    </Modal>
  )
}

function PushModal({ user, onClose, notify }: { user: User; onClose: () => void; notify: (msg: string, type?: 'success' | 'error') => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string },
        body: JSON.stringify({ user_ids: [user.id], title: title.trim(), body: body.trim() }),
      })
      const data = await res.json()
      await sb.from('messages').insert({ user_id: user.id, title: title.trim(), body: body.trim() })
      if (data.sent > 0) notify('Notification envoyée', 'success')
      else notify('Message enregistré (aucun appareil push enregistré)', 'success')
      onClose()
    } catch {
      notify('Erreur lors de l\'envoi', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={`Notifier ${user.prenom} ${user.nom}`} confirmLabel={sending ? 'Envoi…' : 'Envoyer'} confirmDisabled={!title.trim() || !body.trim()} onClose={onClose} onConfirm={async () => { await send(); return true }}>
      <div className="form-group">
        <label>Titre <span style={{ color: '#e53e3e' }}>*</span></label>
        <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Nouveau document disponible" />
      </div>
      <div className="form-group">
        <label>Message <span style={{ color: '#e53e3e' }}>*</span></label>
        <textarea required value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Contenu de la notification…" />
      </div>
    </Modal>
  )
}

function parseUA(ua: string | null): { device: string; os: string; browser: string } {
  if (!ua) return { device: 'Appareil inconnu', os: '', browser: '' }

  // Device / OS
  let device = ''
  let os = ''
  const androidMatch = ua.match(/Android ([\d.]+);?\s*([^)]+)?/)
  const iosMatch = ua.match(/\(iPhone[^)]*OS ([\d_]+)/)
  const ipadMatch = ua.match(/\(iPad[^)]*OS ([\d_]+)/)

  if (androidMatch) {
    os = `Android ${androidMatch[1]}`
    const model = androidMatch[2]?.trim().replace(/Build.*/, '').trim()
    device = model && model !== 'wv' ? model : 'Android'
  } else if (iosMatch) {
    os = `iOS ${iosMatch[1].replace(/_/g, '.')}`
    device = 'iPhone'
  } else if (ipadMatch) {
    os = `iPadOS ${ipadMatch[1].replace(/_/g, '.')}`
    device = 'iPad'
  } else if (/Windows NT/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/)?.[1]
    const winVersion: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }
    os = `Windows ${winVersion[v ?? ''] ?? v ?? ''}`
    device = 'PC'
  } else if (/Macintosh/.test(ua)) {
    os = 'macOS'
    device = 'Mac'
  } else {
    device = 'Appareil'
  }

  // Browser
  let browser = ''
  if (/Edg\//.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/([\d]+)/)?.[1] ?? ''}`
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = `Opera`
  } else if (/Firefox\/([\d]+)/.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/([\d]+)/)?.[1] ?? ''}`
  } else if (/Chrome\/([\d]+)/.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/([\d]+)/)?.[1] ?? ''}`
  } else if (/Version\/([\d]+).*Safari/.test(ua)) {
    browser = `Safari ${ua.match(/Version\/([\d]+)/)?.[1] ?? ''}`
  }

  return { device, os, browser }
}

function DevicesModal({ user, onClose, notify }: { user: User; onClose: () => void; notify: (msg: string, type?: 'success' | 'error') => void }) {
  const [subs, setSubs] = useState<{ endpoint: string; created_at: string; user_agent: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sbAdmin.from('push_subscriptions').select('endpoint, created_at, user_agent').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setSubs(data ?? []); setLoading(false) })
  }, [user.id])

  async function revoke(endpoint: string) {
    const { error } = await sbAdmin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
    if (error) { notify(error.message, 'error'); return }
    notify('Abonnement supprimé', 'success')
    setSubs(prev => prev.filter(s => s.endpoint !== endpoint))
  }

  return (
    <Modal title={`Appareils — ${user.prenom} ${user.nom}`} confirmLabel="Fermer" onClose={onClose} onConfirm={() => { onClose(); return Promise.resolve(true) }}>
      {loading ? (
        <div className="text-muted">Chargement…</div>
      ) : subs.length === 0 ? (
        <div className="text-muted">Aucun appareil push enregistré pour cet utilisateur.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subs.map(s => {
            const { device, os, browser } = parseUA(s.user_agent)
            return (
              <div key={s.endpoint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{device}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[os, browser].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Enregistré le {fmtDateHeure(s.created_at)}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" style={{ flexShrink: 0 }} onClick={() => revoke(s.endpoint)}>Révoquer</button>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export function UtilisateursPage() {
  const [users, setUsers] = useState<User[]>([])
  const [modal, setModal] = useState<User | null | 'new'>(null)
  const [pushModal, setPushModal] = useState<User | null>(null)
  const [devicesModal, setDevicesModal] = useState<User | null>(null)
  const [inviting, setInviting] = useState<{ email: string; userId: string } | null>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const { notify } = useToast()

  async function load() {
    const [{ data: usersData }, { data: authData }] = await Promise.all([
      sb.from('users').select('*').order('nom'),
      sbAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ])
    const signInMap = new Map(authData?.users.map(u => [u.id, u.last_sign_in_at]) ?? [])
    setUsers((usersData ?? []).map(u => ({ ...u, last_sign_in_at: signInMap.get(u.id) ?? null })))
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Utilisateurs</div>
        <div className="page-subtitle">Comptes et profils</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{users.length} utilisateur{users.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Nouvel utilisateur</button>
          </div>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <DataTable
            data={users}
            exportFilename="utilisateurs"
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={u => setModal(u)}
            emptyState={<div className="empty-state"><div>Aucun utilisateur trouvé</div></div>}
            columns={[
              { key: 'nom', label: 'Nom', sortable: true, filterable: true, getValue: u => `${u.prenom} ${u.nom}`, render: u => <span style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</span> },
              { key: 'email', label: 'Email', sortable: true, filterable: true },
              { key: 'is_admin', label: 'Profil', sortable: true, filterable: true, options: [{ value: 'Admin', label: 'Admin' }, { value: 'Utilisateur', label: 'Utilisateur' }], getValue: u => u.is_admin ? 'Admin' : 'Utilisateur', render: u => u.is_admin ? <Badge statut="admin" /> : <Badge statut="organisateur" /> },
              { key: 'last_sign_in_at', label: 'Dernière connexion', sortable: true, hideOnMobile: true, getValue: u => u.last_sign_in_at ?? '', render: u => u.last_sign_in_at ? fmtDateHeure(u.last_sign_in_at) : <span className="text-muted">Jamais</span> },
              { key: 'actions', label: '', render: u => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" title="Envoyer une invitation" onClick={e => { e.stopPropagation(); setInviting({ email: u.email, userId: u.id }) }} style={{ padding: '5px 7px', lineHeight: 0 }}><Mail size={15} /></button>
                  <button className="btn btn-secondary btn-sm" title="Envoyer une notification" onClick={e => { e.stopPropagation(); setPushModal(u) }} style={{ padding: '5px 7px', lineHeight: 0 }}><Bell size={15} /></button>
                  <button className="btn btn-secondary btn-sm" title="Appareils enregistrés" onClick={e => { e.stopPropagation(); setDevicesModal(u) }} style={{ padding: '5px 7px', lineHeight: 0 }}><Smartphone size={15} /></button>
                </div>
              )},
            ]}
          />
        </div>
      </div>

      {modal !== null && (
        <UserForm user={modal === 'new' ? null : modal} onSaved={() => { setModal(null); load() }} />
      )}
      {pushModal && <PushModal user={pushModal} onClose={() => setPushModal(null)} notify={notify} />}
      {devicesModal && <DevicesModal user={devicesModal} onClose={() => setDevicesModal(null)} notify={notify} />}
      {inviting && <InvitationModal email={inviting.email} userId={inviting.userId} notify={notify} onClose={() => setInviting(null)} />}
    </>
  )
}
