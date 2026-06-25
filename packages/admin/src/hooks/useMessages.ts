import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

export interface Message {
  id: string
  title: string
  body: string
  lu: boolean
  created_at: string
}

export function useMessages(userId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])

  const unread = messages.filter(m => !m.lu).length

  async function load() {
    if (!userId) return
    const { data } = await sb.from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setMessages(data ?? [])
  }

  useEffect(() => {
    if (!userId) return
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [userId])

  async function markAllRead() {
    if (!userId) return
    await sb.from('messages').update({ lu: true }).eq('user_id', userId).eq('lu', false)
    setMessages(prev => prev.map(m => ({ ...m, lu: true })))
  }

  return { messages, unread, markAllRead }
}
