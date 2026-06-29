import { UrlForm } from '@/components/UrlForm'
import { RecentScans } from '@/components/RecentScans'
import { CategoryCards } from '@/components/CategoryCards'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">crawl-lens</h1>
        <p className="mt-3 text-muted-foreground">
          내 사이트가 검색에 잘 노출되는지 30초 안에 알아보세요.
        </p>
      </header>
      <UrlForm />
      <CategoryCards />
      <RecentScans />
    </main>
  )
}
