export function normalizeUrl(input: string): string {
  let u: URL
  try {
    u = new URL(input)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('INVALID_URL')
  }
  u.protocol = u.protocol.toLowerCase()
  u.hostname = u.hostname.toLowerCase()
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = ''
  }
  u.hash = ''
  let s = u.toString()
  // URL 객체는 경로 없을 때 '/'를 붙여줌. 그대로 둠.
  return s
}
