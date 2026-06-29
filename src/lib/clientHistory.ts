'use client'
const KEY = 'crawl-lens:history'
const MAX = 20

export type HistoryItem = {
  publicId: string
  targetUrl: string
  totalScore?: number
  createdAt: string
}

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function addHistory(item: HistoryItem) {
  if (typeof window === 'undefined') return
  const cur = getHistory().filter((i) => i.publicId !== item.publicId)
  const next = [item, ...cur].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
