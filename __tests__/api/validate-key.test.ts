import { POST } from '@/app/api/validate-key/route'
import Groq from 'groq-sdk'
import * as keyPool from '@/lib/ai/keyPool'
import * as rateLimit from '@/lib/ai/rateLimit'
import * as modelPool from '@/lib/ai/modelPool'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('groq-sdk')
jest.mock('@/lib/ai/keyPool')
jest.mock('@/lib/ai/rateLimit')
jest.mock('@/lib/ai/modelPool')

const MockGroq = Groq as jest.MockedClass<typeof Groq>
const mockPickApiKey = keyPool.pickApiKey as jest.MockedFunction<typeof keyPool.pickApiKey>
const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<typeof rateLimit.isRateLimited>

function createRequest(
  headers: Record<string, string> = {},
  ip: string = '127.0.0.1'
): Request {
  const defaultHeaders = {
    'x-forwarded-for': ip,
    'x-custom-api-key': 'user-api-key-123',
    ...headers,
  }

  return new Request('http://localhost:3000/api/validate-key', {
    method: 'POST',
    headers: defaultHeaders,
  })
}

describe('POST /api/validate-key', () => {
  beforeEach(() => {
    mockReset(MockGroq)
    jest.clearAllMocks()
  })

  describe('API Key Validation', () => {
    it('should return 401 if no custom API key provided', async () => {
      const req = createRequest({ 'x-custom-api-key': '' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
    })

    it('should pick API key from header', async () => {
      mockPickApiKey.mockReturnValue('picked-api-key')
      mockIsRateLimited.mockResolvedValue(false)

      // Mock Groq to succeed
      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'pong',
                  },
                },
              ],
            }),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest({ 'x-custom-api-key': 'custom-key' })
      const response = await POST(req)

      expect(mockPickApiKey).toHaveBeenCalledWith('custom-key')
      expect(response.status).toBe(200)
    })

    it('should use fallback if no custom key provided', async () => {
      mockPickApiKey.mockReturnValue('default-api-key')
      mockIsRateLimited.mockResolvedValue(false)

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'pong',
                  },
                },
              ],
            }),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest({ 'x-custom-api-key': '' })

      // Should return 401 before calling pickApiKey since header is empty
      const response = await POST(req)
      expect(response.status).toBe(401)
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
    })

    it('should rate limit by IP address', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest({}, '192.168.1.100')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('should allow request if not rate limited', async () => {
      mockIsRateLimited.mockResolvedValue(false)

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'pong',
                  },
                },
              ],
            }),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest({}, '192.168.1.100')

      expect(mockIsRateLimited).not.toHaveBeenCalled()

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should extract IP from x-forwarded-for header', async () => {
      mockIsRateLimited.mockResolvedValue(true)
      mockPickApiKey.mockReturnValue('valid-key')

      const req = createRequest({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 127.0.0.1' })
      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalledWith('validate:10.0.0.1')
    })
  })

  describe('Groq Model Testing', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should test Groq connection with minimal config', async () => {
      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'pong',
                  },
                },
              ],
            }),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      await POST(req)

      expect(mockGroqInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        })
      )
    })

    it('should return 200 if Groq responds successfully', async () => {
      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'pong',
                  },
                },
              ],
            }),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should return 429 if Groq rate limits', async () => {
      const error = new Error('Rate limit exceeded')
      ;(error as any).status = 429

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(error),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.ok).toBe(false)
      expect(data.error).toContain('sem recursos')
    })

    it('should handle Groq 401 as generic error', async () => {
      const error = new Error('Unauthorized')
      ;(error as any).status = 401

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(error),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
      expect(data.error).toContain('validar')
    })

    it('should handle Groq error with response status', async () => {
      const error = new Error('Bad request')
      ;(error as any).response = { status: 400 }

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(error),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
    })

    it('should handle Groq error with error code', async () => {
      const error = new Error('Connection error')
      ;(error as any).code = 502

      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(error),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)

      expect(response.status).toBe(400)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should handle unexpected errors', async () => {
      mockPickApiKey.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Unexpected error')
    })

    it('should return generic error message', async () => {
      const mockGroqInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Network error')),
          },
        },
      }

      MockGroq.mockImplementation(() => mockGroqInstance as any)

      const req = createRequest()
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
      expect(data.error).toContain('validar')
    })
  })
})
