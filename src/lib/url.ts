import { isIP } from 'node:net'

/**
 * SSRF 방어: 사설/루프백/링크로컬/멀티캐스트 등 내부 주소를 차단한다.
 * hostname은 이미 소문자화된 상태로 넘어온다고 가정.
 */
function assertPublicHost(hostname: string): void {
  // URL API는 IPv6를 [::1] 형태로 반환하므로 브래킷을 제거하고 검사
  const bare = hostname.replace(/^\[|\]$/g, '')

  // 명시적으로 차단할 호스트명
  if (bare === 'localhost') throw new Error('INVALID_URL')
  if (bare === 'host.docker.internal') throw new Error('INVALID_URL')

  // 점이 없는 단일 토큰 호스트명(예: "caddy", "postgres", "crawl-lens-web")은
  // 같은 docker network의 컨테이너명으로 해석되어 SSRF 통로가 된다. 차단.
  // 정상 FQDN은 항상 점을 포함하므로 일반 사용에 영향 없음.
  // (IPv4/IPv6 리터럴은 아래 isIP에서 별도 처리되므로 여기서 막혀도 무방)
  if (!bare.includes('.') && !bare.includes(':')) throw new Error('INVALID_URL')

  const ipVersion = isIP(bare)

  if (ipVersion === 4) {
    const parts = bare.split('.').map(Number)
    const [a, b, c] = parts
    // 0.0.0.0/8
    if (a === 0) throw new Error('INVALID_URL')
    // 10.0.0.0/8
    if (a === 10) throw new Error('INVALID_URL')
    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) throw new Error('INVALID_URL')
    // 127.0.0.0/8 (loopback)
    if (a === 127) throw new Error('INVALID_URL')
    // 169.254.0.0/16 (link-local, AWS metadata)
    if (a === 169 && b === 254) throw new Error('INVALID_URL')
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) throw new Error('INVALID_URL')
    // 192.168.0.0/16
    if (a === 192 && b === 168) throw new Error('INVALID_URL')
    // 224.0.0.0/4 (multicast)
    if (a >= 224 && a <= 239) throw new Error('INVALID_URL')
    // 240.0.0.0/4 (reserved)
    if (a >= 240) throw new Error('INVALID_URL')
    // suppress unused variable warning
    void c
  }

  if (ipVersion === 6) {
    const addr = bare.toLowerCase()
    // ::1 (loopback)
    if (addr === '::1') throw new Error('INVALID_URL')
    // :: (unspecified)
    if (addr === '::') throw new Error('INVALID_URL')
    // fe80::/10 (link-local)
    if (addr.startsWith('fe8') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) {
      throw new Error('INVALID_URL')
    }
    // fc00::/7 (unique local: fc00:: ~ fdff::)
    if (addr.startsWith('fc') || addr.startsWith('fd')) throw new Error('INVALID_URL')
    // IPv4-mapped: ::ffff:...
    if (addr.startsWith('::ffff:')) throw new Error('INVALID_URL')
  }
}

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

  // SSRF 방어: 사설/내부 호스트 차단 (프로토콜 검사 후, 반환 전)
  assertPublicHost(u.hostname)

  const s = u.toString()
  // URL 객체는 경로 없을 때 '/'를 붙여줌. 그대로 둠.
  return s
}
