'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getHistory, type HistoryItem } from '@/lib/clientHistory'

export function RecentScans() {
  const [items, setItems] = useState<HistoryItem[]>([])
  useEffect(() => { setItems(getHistory()) }, [])
  if (items.length === 0) return null
  return (
    <section className="mt-12 w-full max-w-2xl">
      <h2 className="text-sm text-muted-foreground mb-2">최근 검사 (이 브라우저)</h2>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.publicId} className="flex justify-between text-sm">
            <Link href={`/r/${i.publicId}`} className="truncate hover:underline">{i.targetUrl}</Link>
            <span className="text-muted-foreground tabular-nums">
              {i.totalScore != null ? `${i.totalScore}점` : '대기'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
