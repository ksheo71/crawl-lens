import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '@/lib/env'

export async function processPdf(publicId: string): Promise<string> {
  await mkdir(env.PDF_CACHE_DIR, { recursive: true })
  const out = join(env.PDF_CACHE_DIR, `${publicId}.pdf`)

  // puppeteer-core와 @sparticuz/chromium은 동적으로 임포트해
  // 타입 분석 시점의 의존성 오류를 방지한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer = (await import('puppeteer-core')).default as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium = (await import('@sparticuz/chromium')).default as any

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    ? process.env.PUPPETEER_EXECUTABLE_PATH
    : await chromium.executablePath()

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.goto(`${env.PUBLIC_BASE_URL}/r/${publicId}?print=1`, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    })
    await writeFile(out, pdf)
    return out
  } finally {
    await browser.close()
  }
}
