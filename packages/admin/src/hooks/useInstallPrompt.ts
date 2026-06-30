import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const [standalone] = useState(isStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  // wasInstalled: true si l'app a déjà été installée sur cet appareil (mémorisé en localStorage)
  const [wasInstalled, setWasInstalled] = useState(() => localStorage.getItem('pwa_installed') === '1')

  useEffect(() => {
    if (standalone) return
    const onBefore = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent) }
    const onInstalled = () => {
      localStorage.setItem('pwa_installed', '1')
      setWasInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onBefore)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [standalone])

  const ua = navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)

  // Cas 1 : standalone → rien (standalone = true)
  // Cas 2 : installée mais accès via navigateur
  const inBrowserAfterInstall = wasInstalled && !standalone
  // Cas 3 : pas encore installée — prompt natif dispo, ou mobile sans prompt natif
  const canPrompt = !standalone && !wasInstalled && (!!deferredPrompt || isIos || isAndroid)

  async function triggerInstall(): Promise<boolean> {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  return { standalone, canPrompt, isIos, isAndroid, hasNativePrompt: !!deferredPrompt, triggerInstall, inBrowserAfterInstall }
}
