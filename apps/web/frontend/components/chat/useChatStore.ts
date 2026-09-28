'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
  isError?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

const STORAGE_KEY = 'aiscern_chats_v3'

export function useChatStore() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string>('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed)
          setActiveChatId(parsed[0].id)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
    }
  }, [chats])

  const createChat = useCallback(() => {
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newChat: Chat = { id, title: 'New Chat', messages: [], updatedAt: Date.now() }
    setChats((prev) => [newChat, ...prev])
    setActiveChatId(id)
    return id
  }, [])

  const addMessage = useCallback((chatId: string, message: ChatMessage) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() } : c
      )
    )
  }, [])

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)))
  }, [])

  const deleteChat = useCallback((chatId: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== chatId)
      if (activeChatId === chatId && next.length > 0) setActiveChatId(next[0].id)
      if (next.length === 0) setActiveChatId('')
      return next
    })
  }, [activeChatId])

  const deleteAllChats = useCallback(() => {
    setChats([])
    setActiveChatId('')
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setActiveChat = useCallback((id: string) => setActiveChatId(id), [])

  return {
    chats,
    activeChatId,
    createChat,
    addMessage,
    updateChatTitle,
    deleteChat,
    deleteAllChats,
    setActiveChat,
  }
}
