import { POST } from '@/app/api/character-infer/route'
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
const mockWithModelFallback = modelPool.withModelFallback as jest.MockedFunction<
  typeof modelPool.withModelFallback
>

function createRequest(
  body: any,
  headers: Record<string, string> = {},
  ip: string = '127.0.0.1'
): Request {
  return new Request('http://localhost:3000/api/character-infer', {
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

const testCharacterInput = {
  genero: 'Fantasy',
  tom: 'Epic',
  magia: 'High',
  tech: 'Medieval',
  name: 'Aragorn',
  appearance: 'Tall ranger with dark hair',
  backstory: 'A skilled ranger from the north',
  profession: 'Ranger',
}

const validCharacterOutput = {
  profession: 'Ranger',
  attributes: {
    VIGOR: 3,
    DESTREZA: 4,
    MENTE: 2,
    PRESENÇA: 1,
  },
  inventory: [
    { name: 'Sword', type: 'equipment', quantity: 1 },
    { name: 'Bow', type: 'equipment', quantity: 1 },
    { name: 'Arrows', type: 'consumable', quantity: 20 },
  ],
}

describe('POST /api/character-infer', () => {
  beforeEach(() => {
    mockReset(MockGroq)
    jest.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should return 400 for invalid payload', async () => {
      const req = createRequest({ invalid: 'data' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payload')
    })

    it('should require genero field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        genero: undefined,
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payload')
    })

    it('should require tom field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        tom: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should require magia field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        magia: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should require tech field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        tech: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should require name field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        name: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should require appearance field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        appearance: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should require backstory field', async () => {
      const req = createRequest({
        ...testCharacterInput,
        backstory: undefined,
      })
      const response = await POST(req)

      expect(response.status).toBe(400)
    })

    it('should allow optional profession field', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const { profession, ...inputWithoutProfession } = testCharacterInput
      const req = createRequest(inputWithoutProfession)
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
    })

    it('should rate limit by IP address', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest(testCharacterInput, {}, '192.168.1.100')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('should check rate limit before API call', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest(testCharacterInput)
      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalled()
      expect(mockWithModelFallback).not.toHaveBeenCalled()
    })

    it('should extract IP from x-forwarded-for', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest(testCharacterInput, {
        'x-forwarded-for': '10.0.0.1, 192.168.1.1',
      })
      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalledWith('infer:10.0.0.1')
    })
  })

  describe('API Key Handling', () => {
    beforeEach(() => {
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return 401 if API key missing', async () => {
      mockPickApiKey.mockImplementation(() => {
        throw new Error('No API key available')
      })

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing API key')
    })

    it('should use custom API key if provided', async () => {
      mockPickApiKey.mockReturnValue('custom-api-key')
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput, {
        'x-custom-api-key': 'custom-key',
      })
      await POST(req)

      expect(mockPickApiKey).toHaveBeenCalledWith('custom-key')
    })

    it('should use fallback if no custom key', async () => {
      mockPickApiKey.mockReturnValue('fallback-key')
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput, {
        'x-custom-api-key': '',
      })
      await POST(req)

      expect(mockPickApiKey).toHaveBeenCalledWith('')
    })
  })

  describe('Character Generation', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return valid character sheet', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.character).toBeDefined()
      expect(data.character.name).toBe('Aragorn')
      expect(data.character.profession).toBe('Ranger')
      expect(data.warnings).toEqual([])
    })

    it('should normalize attribute values to 0-5 range', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                attributes: {
                  VIGOR: 10,
                  DESTREZA: -5,
                  MENTE: 3,
                  PRESENÇA: 2,
                },
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.attributes.VIGOR).toBeLessThanOrEqual(5)
      expect(data.character.attributes.DESTREZA).toBeGreaterThanOrEqual(0)
    })

    it('should handle string attribute values', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                attributes: {
                  VIGOR: '3',
                  DESTREZA: '4.5',
                  MENTE: '2',
                  PRESENÇA: '1',
                },
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.attributes.VIGOR).toBe(3)
      expect(data.character.attributes.DESTREZA).toBe(4)
    })

    it('should handle comma decimals in attributes', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                attributes: {
                  VIGOR: '3,5',
                  DESTREZA: '4,2',
                  MENTE: '2,1',
                  PRESENÇA: '0,8',
                },
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.attributes.VIGOR).toBe(3)
      expect(data.character.attributes.DESTREZA).toBe(4)
    })

    it('should normalize inventory items', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                attributes: {
                  VIGOR: 3,
                  DESTREZA: 4,
                  MENTE: 2,
                  PRESENÇA: 1,
                },
                inventory: [
                  'Sword',
                  { name: 'Bow', type: 'equipment' },
                  { name: 'Arrows', type: 'consumable', quantity: 20 },
                ],
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.inventory).toHaveLength(3)
      expect(data.character.inventory[0].name).toBe('Sword')
      expect(data.character.inventory[0].type).toBe('equipment')
      expect(data.character.inventory[1].name).toBe('Bow')
      expect(data.character.inventory[2].type).toBe('consumable')
    })

    it('should set initial health to HEALTHY', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.health.tier).toBe('HEALTHY')
      expect(data.character.health.lightDamageCounter).toBe(0)
    })
  })

  describe('JSON Parsing', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return warning if JSON not found', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not JSON',
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.warnings).toContain('JSON nao encontrado na resposta.')
      expect(data.character).toEqual({})
    })

    it('should return warning if JSON invalid', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{ invalid json }',
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.warnings).toContain('JSON invalido na resposta.')
    })

    it('should extract JSON from markdown code block', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: `Here is your character:
\`\`\`json
${JSON.stringify(validCharacterOutput)}
\`\`\`

Good luck!`,
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.character.profession).toBe('Ranger')
    })

    it('should extract JSON with extra whitespace', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: `

              ${JSON.stringify(validCharacterOutput)}

              `,
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.profession).toBe('Ranger')
    })
  })

  describe('Schema Validation', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return warning for incomplete character', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                // Missing attributes
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.warnings).toContain('Ficha incompleta.')
    })

    it('should handle missing attributes gracefully', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Ranger',
                attributes: {},
                inventory: [],
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.character.attributes.VIGOR).toBe(0)
    })

    it('should fallback profession if model provides different', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Wizard',
                attributes: {
                  VIGOR: 2,
                  DESTREZA: 2,
                  MENTE: 4,
                  PRESENÇA: 2,
                },
                inventory: [],
              }),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.profession).toBe('Ranger')
    })

    it('should use model profession if input profession empty', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profession: 'Wizard',
                attributes: {
                  VIGOR: 2,
                  DESTREZA: 2,
                  MENTE: 4,
                  PRESENÇA: 2,
                },
                inventory: [],
              }),
            },
          },
        ],
      } as any)

      const req = createRequest({ ...testCharacterInput, profession: '' })
      const response = await POST(req)
      const data = await response.json()

      expect(data.character.profession).toBe('Wizard')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return 500 for unexpected errors', async () => {
      mockWithModelFallback.mockRejectedValue(new Error('Unexpected error'))

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Server error')
    })

    it('should handle Groq errors gracefully', async () => {
      const error = new Error('Groq API error')
      ;(error as any).status = 503

      mockWithModelFallback.mockRejectedValue(error)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)

      expect(response.status).toBe(500)
    })
  })

  describe('Integration Tests', () => {
    it('should create full character from input', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.character).toMatchObject({
        name: 'Aragorn',
        appearance: 'Tall ranger with dark hair',
        profession: 'Ranger',
        backstory: 'A skilled ranger from the north',
        attributes: expect.any(Object),
        health: expect.any(Object),
        inventory: expect.any(Array),
      })
      expect(data.warnings).toEqual([])
    })

    it('should pass campaign context to Groq prompt', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(validCharacterOutput),
            },
          },
        ],
      } as any)

      const req = createRequest(testCharacterInput)
      await POST(req)

      expect(mockWithModelFallback).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          key: `infer:${testCharacterInput.name}`,
        })
      )
    })
  })
})
