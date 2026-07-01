import { useEffect, useRef, useState } from 'react'
import { sb } from '../lib/supabase'

export interface Message {
  id: string
  title: string
  body: string
  lu: boolean
  push_vu_at: string | null
  created_at: string
}

export function useMessages(userId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const unread = messages.filter(m => !m.lu).length

  async function load() {
    if (!userIdRef.current) return
    const { data } = await sb.from('messages').select('*').eq('user_id', userIdRef.current).order('created_at', { ascending: false }).limit(20)
    setMessages(data ?? [])
  }

  useEffect(() => {
    if (!userId) return
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [userId])

  // Handle push notification click relayed from service worker
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return

    async function onSwMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_CLICKED') return
      const messageId = event.data.messageId as string
      if (!messageId) return
      await sb.from('messages').update({ push_vu_at: new Date().toISOString() }).eq('id', messageId).is('push_vu_at', null)
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, push_vu_at: new Date().toISOString() } : m))
    }

    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [userId])

  // Handle push_clicked param when SW opened a new window
  useEffect(() => {
    if (!userId) return
    const params = new URLSearchParams(window.location.search)
    const messageId = params.get('push_clicked')
    if (!messageId) return
    sb.from('messages').update({ push_vu_at: new Date().toISOString() }).eq('id', messageId).is('push_vu_at', null).then(() => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, push_vu_at: new Date().toISOString() } : m))
    })
    // Clean up URL param without reloading
    const url = new URL(window.location.href)
    url.searchParams.delete('push_clicked')
    window.history.replaceState({}, '', url)
  }, [userId])

  async function markAllRead() {
    if (!userId) return
    await sb.from('messages').update({ lu: true }).eq('user_id', userId).eq('lu', false)
    setMessages(prev => prev.map(m => ({ ...m, lu: true })))
  }

  return { messages, unread, markAllRead, reload: load }
}
