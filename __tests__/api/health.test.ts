import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('should return 200 OK', async () => {
    const req = new Request('http://localhost:3000/api/health')
    const response = await GET(req as any)

    expect(response.status).toBe(200)
  })

  it('should return JSON response', async () => {
    const req = new Request('http://localhost:3000/api/health')
    const response = await GET(req as any)
    const data = await response.json()

    expect(data).toEqual({ status: 'ok' })
  })

  it('should have correct content-type header', async () => {
    const req = new Request('http://localhost:3000/api/health')
    const response = await GET(req as any)

    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('should handle multiple requests', async () => {
    for (let i = 0; i < 5; i++) {
      const req = new Request('http://localhost:3000/api/health')
      const response = await GET(req as any)
      expect(response.status).toBe(200)
    }
  })

  it('should have successful status field', async () => {
    const req = new Request('http://localhost:3000/api/health')
    const response = await GET(req as any)
    const data = await response.json()

    expect(data.status).toBe('ok')
  })
})
