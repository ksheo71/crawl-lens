import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'crawl-lens',
  description: '내 사이트가 검색에 잘 노출되는지 30초 안에 알아보세요.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
