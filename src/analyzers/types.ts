import type { CheerioAPI } from 'cheerio'

export type Category = 'meta' | 'content' | 'technical' | 'performance'
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type CheckResult = {
  id: string
  category: Category
  status: CheckStatus
  title: string
  message: string
  detail?: Record<string, unknown>
  fix?: string
  docs?: string
  weight: number
}

export type AnalyzeContext = {
  targetUrl: string
  normalizedUrl: string
  finalUrl: string
  html: string
  $: CheerioAPI
  responseHeaders: Headers
  responseStatus: number
}

export interface Analyzer {
  name: Category
  run(ctx: AnalyzeContext): Promise<CheckResult[]>
}
