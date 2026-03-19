import { GET } from '@/app/api/image/route'
import * as rateLimit from '@/lib/ai/rateLimit'
import { mockReset } from 'jest-mock-extended'

jest.mock('@/lib/ai/rateLimit')
jest.mock('node-fetch', () => require('jest-fetch-mock'))

const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<typeof rateLimit.isRateLimited>

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function createRequest(
  prompt: string,
  params: Record<string, string | number> = {},
  ip: string = '127.0.0.1'
): Request {
  const searchParams = new URLSearchParams({
    prompt,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  return new Request(`http://localhost:3000/api/image?${searchParams.toString()}`, {
    headers: {
      'x-forwarded-for': ip,
    },
  })
}

describe('GET /api/image', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    mockIsRateLimited.mockResolvedValue(false)
  })

  describe('Parameter Validation', () => {
    it('should return 400 if prompt is missing', async () => {
      const req = createRequest('')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('prompt')
    })

    it('should return 400 if prompt is only whitespace', async () => {
      const req = createRequest('   ')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('prompt')
    })

    it('should parse optional width parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard', { width: 512 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('width=512'),
        expect.any(Object)
      )
    })

    it('should parse optional height parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard', { height: 768 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('height=768'),
        expect.any(Object)
      )
    })

    it('should parse optional seed parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard', { seed: 42 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('seed=42'),
        expect.any(Object)
      )
    })

    it('should handle seed parameter of 0', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard', { seed: 0 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('seed=0'),
        expect.any(Object)
      )
    })

    it('should ignore invalid width', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = new Request(
        'http://localhost:3000/api/image?prompt=wizard&width=abc'
      )
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('width='),
        expect.any(Object)
      )
    })
  })

  describe('Rate Limiting', () => {
    it('should rate limit by IP address', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest('a wizard', {}, '192.168.1.100')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit')
    })

    it('should extract IP from x-forwarded-for header', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = new Request(
        'http://localhost:3000/api/image?prompt=wizard',
        {
          headers: {
            'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          },
        }
      )

      await GET(req as any)

      expect(mockIsRateLimited).toHaveBeenCalledWith('image:10.0.0.1')
    })

    it('should use unknown if no IP header', async () => {
      mockIsRateLimited.mockResolvedValue(false)
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = new Request('http://localhost:3000/api/image?prompt=wizard')

      await GET(req as any)

      expect(mockIsRateLimited).toHaveBeenCalledWith('image:unknown')
    })
  })

  describe('Model Selection', () => {
    beforeEach(() => {
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should use klein-large for < 5 users', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard', { users: 3 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('model=klein-large'),
        expect.any(Object)
      )
    })

    it('should try klein and klein-large for 5-10 users', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(Buffer.from('fail'), {
            status: 503,
          })
        )
        .mockResolvedValueOnce(
          new Response(Buffer.from('image-data'), {
            headers: { 'content-type': 'image/jpeg' },
          })
        )

      const req = createRequest('a wizard', { users: 8 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch.mock.calls[0][0]).toContain('model=klein')
      expect(mockFetch.mock.calls[1][0]).toContain('model=klein-large')
    })

    it('should try multiple models for 11-500 users', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(Buffer.from('fail'), {
            status: 502,
          })
        )
        .mockResolvedValueOnce(
          new Response(Buffer.from('fail'), {
            status: 502,
          })
        )
        .mockResolvedValueOnce(
          new Response(Buffer.from('image-data'), {
            headers: { 'content-type': 'image/jpeg' },
          })
        )

      const req = createRequest('a wizard', { users: 100 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockFetch.mock.calls[0][0]).toContain('model=turbo')
      expect(mockFetch.mock.calls[1][0]).toContain('model=klein')
      expect(mockFetch.mock.calls[2][0]).toContain('model=klein-large')
    })

    it('should use full chain for 500+ users', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount < 5) {
          return Promise.resolve(
            new Response(Buffer.from('fail'), { status: 502 })
          )
        }
        return Promise.resolve(
          new Response(Buffer.from('image-data'), {
            headers: { 'content-type': 'image/jpeg' },
          })
        )
      })

      const req = createRequest('a wizard', { users: 1000 })
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledTimes(5)
      expect(mockFetch.mock.calls[0][0]).toContain('model=flux')
      expect(mockFetch.mock.calls[1][0]).toContain('model=zimage')
      expect(mockFetch.mock.calls[2][0]).toContain('model=turbo')
      expect(mockFetch.mock.calls[3][0]).toContain('model=klein')
      expect(mockFetch.mock.calls[4][0]).toContain('model=klein-large')
    })
  })

  describe('Image Response', () => {
    beforeEach(() => {
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return image data with correct content type', async () => {
      const imageData = Buffer.from('fake-image-data')
      mockFetch.mockResolvedValueOnce(
        new Response(imageData, {
          headers: { 'content-type': 'image/png' },
        })
      )

      const req = createRequest('a wizard')
      const response = await GET(req as any)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
    })

    it('should default to image/jpeg if no content-type', async () => {
      const imageData = Buffer.from('fake-image-data')
      mockFetch.mockResolvedValueOnce(
        new Response(imageData, {
          headers: {},
        })
      )

      const req = createRequest('a wizard')
      const response = await GET(req as any)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/jpeg')
    })

    it('should set cache control headers', async () => {
      const imageData = Buffer.from('fake-image-data')
      mockFetch.mockResolvedValueOnce(
        new Response(imageData, {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard')
      const response = await GET(req as any)

      expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    })

    it('should preserve image buffer correctly', async () => {
      const imageData = Buffer.from('test-image-content')
      mockFetch.mockResolvedValueOnce(
        new Response(imageData, {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard')
      const response = await GET(req as any)
      const buffer = await response.arrayBuffer()

      expect(buffer.byteLength).toBe(imageData.byteLength)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return 502 if all models fail', async () => {
      mockFetch.mockResolvedValue(
        new Response(Buffer.from('error'), { status: 502 })
      )

      const req = createRequest('a wizard', { users: 1 })
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toContain('failed')
    })

    it('should return last error status if all fail', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('', { status: 504 }))
        .mockResolvedValueOnce(new Response('', { status: 502 }))

      const req = createRequest('a wizard', { users: 1 })
      const response = await GET(req as any)

      expect(response.status).toBe(502)
    })

    it('should use 502 as default if no last error', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 500 }))

      const req = createRequest('a wizard', { users: 1 })
      const response = await GET(req as any)

      expect(response.status).toBe(502)
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'))

      const req = createRequest('a wizard', { users: 1 })

      // Should throw during iteration
      expect(async () => {
        await GET(req as any)
      }).rejects.toThrow()
    })
  })

  describe('URL Construction', () => {
    beforeEach(() => {
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should URL encode prompt correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('a wizard casting "fireball" spell!')
      await GET(req as any)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'a%20wizard%20casting%20%22fireball%22%20spell'
        ),
        expect.any(Object)
      )
    })

    it('should build URL with all parameters', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(Buffer.from('image-data'), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = createRequest('dragon', {
        width: 512,
        height: 768,
        seed: 123,
      })
      await GET(req as any)

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('width=512')
      expect(url).toContain('height=768')
      expect(url).toContain('seed=123')
      expect(url).toContain('model=klein-large')
    })
  })
})
