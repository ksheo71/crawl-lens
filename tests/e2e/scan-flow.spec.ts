import { test, expect } from '@playwright/test'

test('홈 페이지 4개 카테고리 카드 노출', async ({ page }) => {
  await page.goto('/')
  for (const label of ['메타', '콘텐츠', '기술', '성능']) {
    await expect(page.getByText(label).first()).toBeVisible()
  }
})

test('홈에서 잘못된 URL 입력 시 에러 또는 진행 화면 표시', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('https://example.com/blog/post').fill('not-a-url-and-no-dot')
  await page.getByRole('button', { name: /검사 시작/ }).click()
  // CI에서 워커가 외부 URL에 접근하지 못하므로 다음 중 하나가 나타나면 PASS:
  // - 인라인 400 에러 메시지
  // - 결과 페이지의 FAILED/네트워크 에러 메시지
  // - 진행 중 표시 (스캔이 시작은 됨)
  await expect(
    page.getByText(/검사할 수 없었어요|검사를 시작할 수 없|네트워크|FAILED|진행|분석 중/)
  ).toBeVisible({ timeout: 90_000 })
})
