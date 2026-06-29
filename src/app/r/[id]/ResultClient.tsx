'use client'
import { useEffect, useState } from 'react'
import { ProgressView } from '@/components/result/ProgressView'
import { FailureView } from '@/components/result/FailureView'
import { ScoreHero } from '@/components/result/ScoreHero'
import { CheckList } from '@/components/result/CheckList'
import { Actions } from '@/components/result/Actions'
import { addHistory } from '@/lib/clientHistory'

type Scan = {
  publicId: string
  targetUrl: string
  normalizedUrl: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  errorCode?: string | null
  errorMessage?: string | null
  totalScore?: number | null
  categoryScores?: Record<string, number | null> | null
  checks?: Array<{
    id: string; category: string; status: 'pass' | 'warn' | 'fail' | 'skip'
    title: string; message: string; detail?: unknown; fix?: string; docs?: string
  }> | null
  createdAt: string
  completedAt?: string | null
}

export function ResultClient({ initial }: { initial: Scan }) {
  const [scan, setScan] = useState<Scan>(initial)
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    const { publicId, status, totalScore, targetUrl, createdAt } = scan
    if (status === 'DONE' || status === 'FAILED') {
      if (status === 'DONE' && totalScore != null) {
        addHistory({
          publicId,
          targetUrl,
          totalScore,
          createdAt,
        })
      }
      return
    }
    let cancelled = false
    let interval = 1_000
    let tries = 0
    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch(`/api/scan/${publicId}/status`)
        if (res.ok) {
          const j = await res.json()
          setProgress(j.progress ?? 0)
          if (j.status === 'DONE' || j.status === 'FAILED') {
            const full = await fetch(`/api/r/${publicId}`).then((r) => r.json())
            setScan(full)
            return
          }
        }
      } catch { /* ignore */ }
      tries++
      if (tries > 30 && interval === 1_000) interval = 2_000
      if (tries > 60 && interval === 2_000) interval = 5_000
      setTimeout(tick, interval)
    }
    tick()
    return () => { cancelled = true }
  }, [scan])

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <Actions publicId={scan.publicId} status={scan.status} />
        {(scan.status === 'PENDING' || scan.status === 'RUNNING') && (
          <ProgressView targetUrl={scan.targetUrl} progress={progress} />
        )}
        {scan.status === 'FAILED' && (
          <FailureView targetUrl={scan.targetUrl} errorCode={scan.errorCode ?? ''} errorMessage={scan.errorMessage ?? ''} />
        )}
        {scan.status === 'DONE' && (
          <>
            <ScoreHero
              targetUrl={scan.targetUrl}
              completedAt={scan.completedAt ?? scan.createdAt}
              total={scan.totalScore ?? 0}
              categories={scan.categoryScores ?? {}}
            />
            <CheckList checks={scan.checks ?? []} />
          </>
        )}
      </div>
    </main>
  )
}
