import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { useTheme } from '../hooks/useTheme'
import { NotifDropdown } from './NotifDropdown'
import { SettingsModal } from './SettingsModal'
import { UserMenu } from './UserMenu'
import { LogoExpogate } from './LogoExpogate'

interface Props {
  onHamburger?: () => void
}

export function AppHeader({ onHamburger }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)
  const { theme, setTheme } = useTheme()
  const userName = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()

  return (
    <>
      <header className="mobile-topbar" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
        {onHamburger
          ? <button className="hamburger" onClick={onHamburger}>☰</button>
          : <div style={{ flexShrink: 0, width: 110 }}><LogoExpogate height={28} /></div>
        }
        <div className="topbar-user" style={{ marginLeft: 'auto', flexShrink: 0, gap: 6 }}>
          <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={userName} />
          <UserMenu userName={userName} onSettings={() => setSettingsOpen(true)} />
        </div>
      </header>
      {settingsOpen && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
