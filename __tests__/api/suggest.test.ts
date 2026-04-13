import { POST } from '@/app/api/suggest/route'
import Groq from 'groq-sdk'
import * as keyPool from '@/lib/ai/keyPool'
import * as rateLimit from '@/lib/ai/rateLimit'
import * as modelPool from '@/lib/ai/modelPool'
import { mockReset } from 'jest-mock-extended'

jest.mock('groq-sdk')
jest.mock('@/lib/ai/keyPool')
jest.mock('@/lib/ai/rateLimit')
jest.mock('@/lib/ai/modelPool')

const MockGroq = Groq as jest.MockedClass<typeof Groq>
const mockPickApiKey = keyPool.pickApiKey as jest.MockedFunction<typeof keyPool.pickApiKey>
const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<typeof rateLimit.isRateLimited>
const mockWithModelFallback = modelPool.withModelFallback as jest.MockedFunction<
  typeof modelPool.withModelFallback
>

function createRequest(
  body: any,
  headers: Record<string, string> = {},
  ip: string = '127.0.0.1'
): Request {
  return new Request('http://localhost:3000/api/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      'x-custom-api-key': 'user-api-key',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/suggest', () => {
  beforeEach(() => {
    mockReset(MockGroq)
    jest.clearAllMocks()
    mockPickApiKey.mockReturnValue('valid-api-key')
    mockIsRateLimited.mockResolvedValue(false)
  })

  describe('Input Validation', () => {
    it('should return 400 for invalid JSON', async () => {
      const req = new Request('http://localhost:3000/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      expect(async () => {
        await POST(req)
      }).rejects.toThrow()
    })

    it('should return 400 for missing type field', async () => {
      const req = createRequest({ payload: {} })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payload')
    })

    it('should return 400 for invalid type', async () => {
      const req = createRequest({
        type: 'invalidType',
        payload: {},
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid type')
    })
  })

  describe('Valid Suggestion Types', () => {
    beforeEach(() => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Suggested content',
            },
          },
        ],
      } as any)
    })

    it('should handle suggestTitle type', async () => {
      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestWorldHistory type', async () => {
      const req = createRequest({
        type: 'suggestWorldHistory',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestStyle type', async () => {
      const req = createRequest({
        type: 'suggestStyle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
          worldHistory: 'A dark fantasy world',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestCharacterName type', async () => {
      const req = createRequest({
        type: 'suggestCharacterName',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestCharacterAppearance type', async () => {
      const req = createRequest({
        type: 'suggestCharacterAppearance',
        payload: {
          name: 'Aragorn',
          genero: 'Fantasy',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestCharacterBackstory type', async () => {
      const req = createRequest({
        type: 'suggestCharacterBackstory',
        payload: {
          name: 'Aragorn',
          appearance: 'Tall and noble',
          profession: 'Ranger',
          worldHistory: 'A dark fantasy world',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })

    it('should handle suggestCharacterProfession type', async () => {
      const req = createRequest({
        type: 'suggestCharacterProfession',
        payload: {
          appearance: 'Tall and noble',
          backstory: 'A skilled warrior',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBeDefined()
    })
  })

  describe('Rate Limiting', () => {
    it('should return 429 if rate limited', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('should rate limit by IP address', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest(
        {
          type: 'suggestTitle',
          payload: {},
        },
        {},
        '192.168.1.100'
      )
      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalledWith('suggest:192.168.1.100')
    })

    it('should extract IP from x-forwarded-for header', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Title suggestion',
            },
          },
        ],
      } as any)

      const req = new Request('http://localhost:3000/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          'x-custom-api-key': 'user-api-key',
        },
        body: JSON.stringify({
          type: 'suggestTitle',
          payload: {
            genero: 'Fantasy',
            tom: 'Epic',
            magia: 'High',
            tech: 'Medieval',
          },
        }),
      })

      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalledWith('suggest:10.0.0.1')
    })
  })

  describe('API Key Handling', () => {
    it('should return 401 if no API key available', async () => {
      mockPickApiKey.mockImplementation(() => {
        throw new Error('No API key available')
      })

      const req = createRequest({
        type: 'suggestTitle',
        payload: {},
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing API key')
    })

    it('should use custom API key from header', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Title suggestion',
            },
          },
        ],
      } as any)

      const req = createRequest(
        {
          type: 'suggestTitle',
          payload: {
            genero: 'Fantasy',
            tom: 'Epic',
            magia: 'High',
            tech: 'Medieval',
          },
        },
        { 'x-custom-api-key': 'custom-key' }
      )
      await POST(req)

      expect(mockPickApiKey).toHaveBeenCalledWith('custom-key')
    })
  })

  describe('AI Response Handling', () => {
    it('should return empty text if no content in response', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      } as any)

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('')
    })

    it('should return generated suggestion text', async () => {
      const suggestionText = 'The Shadows of Arath'
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: suggestionText,
            },
          },
        ],
      } as any)

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe(suggestionText)
    })

    it('should handle null choices gracefully', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [],
      } as any)

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('')
    })
  })

  describe('Error Handling', () => {
    it('should handle Groq errors', async () => {
      mockWithModelFallback.mockRejectedValue(
        new Error('Groq API error')
      )

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Server error')
    })

    it('should handle unknown errors', async () => {
      mockWithModelFallback.mockRejectedValue(
        new Error('Unknown error')
      )

      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
        },
      })
      const response = await POST(req)

      expect(response.status).toBe(500)
    })
  })

  describe('Payload Handling', () => {
    beforeEach(() => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Generated content',
            },
          },
        ],
      } as any)
    })

    it('should work with optional payload', async () => {
      const req = createRequest({
        type: 'suggestTitle',
      })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('should handle payload with extra fields', async () => {
      const req = createRequest({
        type: 'suggestTitle',
        payload: {
          genero: 'Fantasy',
          tom: 'Epic',
          magia: 'High',
          tech: 'Medieval',
          extra: 'field',
        },
      })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('should handle suggestCharacterProfession with missing optional fields', async () => {
      const req = createRequest({
        type: 'suggestCharacterProfession',
        payload: {},
      })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })
})
