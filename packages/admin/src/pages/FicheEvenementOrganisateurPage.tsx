import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { db, getPendingPrestaIds } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { SyncDot } from '../components/ui/SyncDot'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { ConformiteStats } from '../components/ui/ConformiteStats'
import { EvenementForm } from '../components/EvenementForm'
import { TabMainCourante } from './event/TabMainCourante'
import type { Evenement, Stand, Prestation, RoleLocal } from '../types'
import { STATUT_LABELS, STATUT_COLORS, conformiteBg } from './event/helpers'
import { TabDashboard } from './event/TabDashboard'
import { TabStands } from './event/TabStands'
import { TabPrestations } from './event/TabPrestations'
import { TabPrestataires } from './event/TabPrestataires'
import { TabUtilisateurs } from './event/UserAccesList'
import { StandPrestationsModal } from './event/StandPrestationsModal'
import { PrestationForm } from './event/PrestationForm'

function TabDetails({ ev, onEdit }: { ev: Evenement; onEdit: () => void }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Détails de l'événement</div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Modifier</button>
      </div>
      <div className="card-body" style={{ padding: 24 }}>
        <div className="grid-2">
          <div><div className="text-muted">Lieu</div><div style={{ marginTop: 2 }}>{ev.lieu ?? '—'}</div></div>
          <div><div className="text-muted">Statut</div><div style={{ marginTop: 2 }}><Badge statut={ev.statut} /></div></div>
          <div><div className="text-muted">Date de début</div><div style={{ marginTop: 2 }}>{fmtDate(ev.date_debut)}</div></div>
          <div><div className="text-muted">Date de fin</div><div style={{ marginTop: 2 }}>{fmtDate(ev.date_fin)}</div></div>
        </div>
      </div>
    </div>
  )
}

type OrgTab = 'dashboard' | 'details' | 'stands' | 'prestations' | 'prestataires' | 'utilisateurs' | 'main_courante'

function VueOrganisateur({ ev, onReload }: { ev: Evenement; onReload: () => void }) {
  const [tab, setTab] = useState<OrgTab>('dashboard')
  const [editing, setEditing] = useState(false)

  const TAB_LABELS: Record<OrgTab, string> = {
    dashboard: 'Tableau de bord', details: 'Détails', stands: 'Stands',
    prestations: 'Prestations', prestataires: 'Prestataires',
    utilisateurs: 'Utilisateurs', main_courante: 'Main courante',
  }

  return (
    <>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {(Object.keys(TAB_LABELS) as OrgTab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ display: tab === 'dashboard' ? undefined : 'none' }}><TabDashboard ev={ev} /></div>
      <div style={{ display: tab === 'details' ? undefined : 'none' }}><TabDetails ev={ev} onEdit={() => setEditing(true)} /></div>
      <div style={{ display: tab === 'stands' ? undefined : 'none' }}><TabStands ev={ev} /></div>
      <div style={{ display: tab === 'prestations' ? undefined : 'none' }}><TabPrestations ev={ev} onGoToStands={() => setTab('stands')} /></div>
      <div style={{ display: tab === 'prestataires' ? undefined : 'none' }}><TabPrestataires ev={ev} /></div>
      <div style={{ display: tab === 'utilisateurs' ? undefined : 'none' }}><TabUtilisateurs ev={ev} /></div>
      <div style={{ display: tab === 'main_courante' ? undefined : 'none' }}><TabMainCourante ev={ev} canDelete /></div>

      {editing && <EvenementForm ev={ev} showParametrage={false} onSaved={() => { setEditing(false); onReload() }} />}
    </>
  )
}

type PrestaTab = 'dashboard' | 'stands' | 'prestations'

function VuePrestataire({ ev, userId }: { ev: Evenement; userId: string }) {
  const [stands, setStands] = useState<(Stand & { prestations: Prestation[] })[]>([])
  const [viewingPrestations, setViewingPrestations] = useState<(Stand & { prestations: Prestation[] }) | null>(null)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [tab, setTab] = useState<PrestaTab>('dashboard')
  const [exportFnStands, setExportFnStands] = useState<(() => void) | null>(null)
  const [exportFnPresta, setExportFnPresta] = useState<(() => void) | null>(null)
  const [allPendingSyncIds, setAllPendingSyncIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: acces } = await sb.from('user_evenements')
        .select('prestataire_id').eq('evenement_id', ev.id).eq('user_id', userId).single()
      if (!acces?.prestataire_id) return
      const { data: prests } = await sb.from('prestations')
        .select('*, stands(*)').eq('prestataire_id', acces.prestataire_id).eq('deleted', false)
      if (!prests) return
      const byStand = new Map<string, Stand & { prestations: Prestation[] }>()
      for (const p of prests) {
        if (!p.stands || (p.stands as Stand).evenement_id !== ev.id) continue
        const s = p.stands as Stand
        if (!byStand.has(s.id)) byStand.set(s.id, { ...s, prestations: [] })
        byStand.get(s.id)!.prestations.push(p)
      }
      const eventStands = Array.from(byStand.values()).sort((a, b) => a.numero.localeCompare(b.numero))
      setStands(eventStands)
      const eventPrestIds = eventStands.flatMap(s => s.prestations.map(p => p.id))
      setAllPendingSyncIds(await getPendingPrestaIds(eventPrestIds))
    }
    load()
  }, [ev.id, userId])

  const allPrestations = stands.flatMap(s => s.prestations)
  const nbStands = stands.length
  const nbNonVerif = allPrestations.filter(p => !p.statut_conformite || p.statut_conformite === 'a_verifier').length
  const nbConforme = allPrestations.filter(p => p.statut_conformite === 'conforme').length
  const nbNonConforme = allPrestations.filter(p => p.statut_conformite === 'non_conforme').length
  const nbAbsent = allPrestations.filter(p => p.statut_conformite === 'absent').length

  function onPrestationSaved(updated: Prestation) {
    setStands(prev => prev.map(s => ({ ...s, prestations: s.prestations.map(p => p.id === updated.id ? updated : p) })))
    setViewingPrestations(prev => {
      if (!prev || prev.id !== updated.stand_id) return prev
      return { ...prev, prestations: prev.prestations.map(p => p.id === updated.id ? updated : p) }
    })
  }

  return (
    <>
      <div className="tabs">
        {([['dashboard', 'Tableau de bord'], ['stands', 'Mes stands'], ['prestations', 'Mes prestations']] as [PrestaTab, string][]).map(([t, label]) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <ConformiteStats
          nbStands={nbStands} nbNonVerif={nbNonVerif} nbConforme={nbConforme}
          nbNonConforme={nbNonConforme} nbAbsent={nbAbsent}
          emptyMessage="Aucune prestation affectée à votre société sur cet événement."
        />
      )}

      {tab === 'stands' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes stands</div>
            <ExportButton onClick={exportFnStands} />
          </div>
          <div className="card-body">
            <DataTable
              data={stands}
              exportFilename={`mes-stands-${ev.nom}`}
              onExportReady={fn => setExportFnStands(() => fn)}
              onRowClick={s => setViewingPrestations(s)}
              emptyState={<div className="empty-state">Aucune prestation affectée à votre société sur cet événement.</div>}
              columns={[
                { key: 'numero', label: 'N° stand', sortable: true, filterable: true, render: s => <span style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>{s.numero}</span> },
                { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true },
                { key: 'hall', label: 'Hall', sortable: true, filterable: true },
                { key: 'surface', label: 'Surface (m²)', sortable: true },
                { key: 'prestations', label: 'Prestations', sortable: true, getValue: s => String(s.prestations.length), render: s => <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.prestations.length} prestation{s.prestations.length > 1 ? 's' : ''} ↗</span> },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'prestations' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes prestations</div>
            <ExportButton onClick={exportFnPresta} />
          </div>
          <div className="card-body">
            <DataTable
              data={allPrestations}
              exportFilename={`mes-prestations-${ev.nom}`}
              onExportReady={fn => setExportFnPresta(() => fn)}
              onRowClick={p => setEditingPrestation(p)}
              rowStyle={p => conformiteBg(p.statut_conformite)}
              emptyState={<div className="empty-state">Aucune prestation affectée à votre société sur cet événement.</div>}
              columns={[
                { key: 'stand', label: 'Stand', sortable: true, filterable: true, getValue: p => (p.stands as Stand | undefined)?.numero ?? '', render: p => <strong>{(p.stands as Stand | undefined)?.numero ?? '—'}</strong> },
                { key: 'libelle', label: 'Libellé', sortable: true, filterable: true, render: p => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SyncDot pending={allPendingSyncIds.has(p.id)} />
                    <span style={{ fontWeight: 600 }}>{p.libelle}</span>
                  </span>
                )},
                { key: 'categorie', label: 'Catégorie', sortable: true, filterable: true },
                { key: 'quantite_attendue', label: 'Qté', sortable: true },
                { key: 'emplacement_prevu', label: 'Emplacement', filterable: true },
                { key: 'statut_conformite', label: 'Conformité', sortable: true, filterable: true,
                  options: [
                    { value: 'conforme', label: 'Conforme' }, { value: 'non_conforme', label: 'Non conforme' },
                    { value: 'absent', label: 'Absent' }, { value: 'a_verifier', label: 'À vérifier' },
                  ],
                  render: p => p.statut_conformite
                    ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                    : <span className="text-muted">—</span>,
                },
              ]}
            />
          </div>
        </div>
      )}

      {viewingPrestations && !editingPrestation && (
        <StandPrestationsModal
          stand={viewingPrestations} onClose={() => setViewingPrestations(null)}
          onEditPrestation={p => setEditingPrestation(p)} showStandTab={false}
        />
      )}
      {editingPrestation && (
        <PrestationForm
          prest={editingPrestation} evenementId={ev.id}
          onSaved={async () => {
            const { data } = await sb.from('prestations').select('*, stands(*), users(nom, prenom)').eq('id', editingPrestation.id).single()
            if (data) onPrestationSaved(data)
            setEditingPrestation(null)
          }}
          onGoToStands={() => setEditingPrestation(null)}
          readOnly
        />
      )}
    </>
  )
}

type ControleurTab = 'dashboard' | 'stands' | 'prestations' | 'main_courante'

function VueControleur({ ev, userId }: { ev: Evenement; userId: string }) {
  const [tab, setTab] = useState<ControleurTab>('dashboard')
  const [stands, setStands] = useState<(Stand & { prestations: Prestation[] })[]>([])
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [exportFnStands, setExportFnStands] = useState<(() => void) | null>(null)
  const [exportFnPresta, setExportFnPresta] = useState<(() => void) | null>(null)

  useEffect(() => {
    async function load() {
      const { data: acces } = await sb.from('user_evenements')
        .select('id').eq('evenement_id', ev.id).eq('user_id', userId).single()
      if (!acces) return
      const { data: cs } = await sb.from('controleur_stands').select('stand_id').eq('user_evenement_id', acces.id)
      const standIds = (cs ?? []).map((r: { stand_id: string }) => r.stand_id)
      if (!standIds.length) { setStands([]); return }
      const { data: standsData } = await sb.from('stands').select('*').in('id', standIds).order('numero')
      const { data: prests } = await sb.from('prestations')
        .select('*, stands(numero, nom_exposant), users(nom, prenom)')
        .in('stand_id', standIds).eq('deleted', false)
      const byStand = new Map<string, Stand & { prestations: Prestation[] }>()
      for (const s of standsData ?? []) byStand.set(s.id, { ...s, prestations: [] })
      for (const p of prests ?? []) {
        if (byStand.has(p.stand_id)) byStand.get(p.stand_id)!.prestations.push(p)
      }
      setStands(Array.from(byStand.values()))
    }
    load()
  }, [ev.id, userId])

  const allPrestations = stands.flatMap(s => s.prestations)
  const nbStands = stands.length
  const nbNonVerif = allPrestations.filter(p => !p.statut_conformite || p.statut_conformite === 'a_verifier').length
  const nbConforme = allPrestations.filter(p => p.statut_conformite === 'conforme').length
  const nbNonConforme = allPrestations.filter(p => p.statut_conformite === 'non_conforme').length
  const nbAbsent = allPrestations.filter(p => p.statut_conformite === 'absent').length

  function onPrestationSaved(updated: Prestation) {
    setStands(prev => prev.map(s => ({ ...s, prestations: s.prestations.map(p => p.id === updated.id ? updated : p) })))
  }

  const TAB_LABELS: Record<ControleurTab, string> = {
    dashboard: 'Tableau de bord', stands: 'Mes stands',
    prestations: 'Mes prestations', main_courante: 'Main courante',
  }

  return (
    <>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {(Object.keys(TAB_LABELS) as ControleurTab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <ConformiteStats
          nbStands={nbStands} nbNonVerif={nbNonVerif} nbConforme={nbConforme}
          nbNonConforme={nbNonConforme} nbAbsent={nbAbsent}
          emptyMessage="Aucun stand ne vous est affecté sur cet événement."
          marginTop={4}
        />
      )}

      {tab === 'stands' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes stands</div>
            <ExportButton onClick={exportFnStands} />
          </div>
          <div className="card-body">
            <DataTable
              data={stands}
              exportFilename={`mes-stands-${ev.nom}`}
              onExportReady={fn => setExportFnStands(() => fn)}
              onRowClick={() => {}}
              emptyState={<div className="empty-state">Aucun stand affecté.</div>}
              columns={[
                { key: 'numero', label: 'N° stand', sortable: true, filterable: true, render: s => <span style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>{s.numero}</span> },
                { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true },
                { key: 'hall', label: 'Hall', sortable: true, filterable: true },
                { key: 'surface', label: 'Surface (m²)', sortable: true },
                { key: 'prestations', label: 'Prestations', sortable: true, getValue: s => String(s.prestations.length), render: s => <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.prestations.length} prestation{s.prestations.length > 1 ? 's' : ''}</span> },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'prestations' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes prestations</div>
            <ExportButton onClick={exportFnPresta} />
          </div>
          <div className="card-body">
            <DataTable
              data={allPrestations}
              exportFilename={`mes-prestations-${ev.nom}`}
              onExportReady={fn => setExportFnPresta(() => fn)}
              onRowClick={p => setEditingPrestation(p)}
              rowStyle={p => conformiteBg(p.statut_conformite)}
              emptyState={<div className="empty-state">Aucune prestation sur vos stands.</div>}
              columns={[
                { key: 'stand', label: 'Stand', sortable: true, filterable: true, getValue: p => (p.stands as Stand | undefined)?.numero ?? '', render: p => <strong>{(p.stands as Stand | undefined)?.numero ?? '—'}</strong> },
                { key: 'libelle', label: 'Libellé', sortable: true, filterable: true, render: p => <span style={{ fontWeight: 600 }}>{p.libelle}</span> },
                { key: 'categorie', label: 'Catégorie', sortable: true, filterable: true },
                { key: 'quantite_attendue', label: 'Qté', sortable: true },
                { key: 'statut_conformite', label: 'Conformité', sortable: true, filterable: true,
                  options: [
                    { value: 'conforme', label: 'Conforme' }, { value: 'non_conforme', label: 'Non conforme' },
                    { value: 'absent', label: 'Absent' }, { value: 'a_verifier', label: 'À vérifier' },
                  ],
                  render: p => p.statut_conformite
                    ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                    : <span className="text-muted">—</span>,
                },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'main_courante' && <TabMainCourante ev={ev} />}

      {editingPrestation && (
        <PrestationForm
          prest={editingPrestation} evenementId={ev.id}
          onSaved={async () => {
            const { data } = await sb.from('prestations').select('*, stands(numero, nom_exposant), users(nom, prenom)').eq('id', editingPrestation.id).single()
            if (data) onPrestationSaved(data)
            setEditingPrestation(null)
          }}
          onGoToStands={() => setEditingPrestation(null)}
          controleurMode
        />
      )}
    </>
  )
}

export function FicheEvenementOrganisateurPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ev, setEv] = useState<Evenement | null>(null)
  const [role, setRole] = useState<RoleLocal | null>(null)

  async function load() {
    if (!user || !id) return
    try {
      const [{ data: evData, error: evErr }, { data: accesData }] = await Promise.all([
        sb.from('evenements').select('*').eq('id', id).single(),
        sb.from('user_evenements').select('role_local').eq('evenement_id', id).eq('user_id', user.id).single(),
      ])
      if (evErr) throw evErr
      setEv(evData ?? null)
      setRole((accesData?.role_local as RoleLocal) ?? null)
    } catch {
      const local = await db.evenements.get(id)
      if (local) {
        setEv(local as unknown as Evenement)
        setRole((local.role_local as RoleLocal) ?? 'organisateur')
      }
    }
  }

  useEffect(() => { load() }, [id, user])

  if (!ev || !role || !user) return <div className="empty-state">Chargement…</div>

  return (
    <>
      <div className="page-header">
        <button className="back-link" onClick={() => navigate('/')}>← Mes événements</button>
        <div style={{ marginTop: 12 }}>
          <div className="page-title">{ev.nom}</div>
          <div className="page-subtitle">{ev.lieu ?? '—'} · {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)} · <Badge statut={ev.statut} /></div>
        </div>
      </div>

      {role === 'organisateur'
        ? <VueOrganisateur ev={ev} onReload={load} />
        : role === 'controleur'
        ? <VueControleur ev={ev} userId={user.id} />
        : <VuePrestataire ev={ev} userId={user.id} />
      }
    </>
  )
}
