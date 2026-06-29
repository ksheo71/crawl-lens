'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addHistory } from '@/lib/clientHistory'

export function UrlForm() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    let target = url.trim()
    if (!target) return
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`
    setBusy(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '검사를 시작할 수 없었어요.')
        setBusy(false)
        return
      }
      const { publicId } = await res.json()
      addHistory({ publicId, targetUrl: target, createdAt: new Date().toISOString() })
      router.push(`/r/${publicId}`)
    } catch {
      setError('네트워크 오류')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full max-w-2xl">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/post"
          className="flex-1 text-lg h-12"
          disabled={busy}
        />
        <Button type="submit" disabled={busy} className="h-12 px-6">
          {busy ? '시작 중…' : '검사 시작'}
        </Button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  )
}
