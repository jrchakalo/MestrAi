import { POST } from '@/app/api/chat/route'
import Groq from 'groq-sdk'
import * as keyPool from '@/lib/ai/keyPool'
import * as rateLimit from '@/lib/ai/rateLimit'
import * as modelPool from '@/lib/ai/modelPool'
import * as supabaseServer from '@/lib/supabase/server'
import { Role, Campaign, Message } from '@/types'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('groq-sdk')
jest.mock('@/lib/ai/keyPool')
jest.mock('@/lib/ai/rateLimit')
jest.mock('@/lib/ai/modelPool')
jest.mock('@/lib/supabase/server')

const MockGroq = Groq as jest.MockedClass<typeof Groq>
const mockPickApiKey = keyPool.pickApiKey as jest.MockedFunction<typeof keyPool.pickApiKey>
const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<typeof rateLimit.isRateLimited>
const mockWithModelFallback = modelPool.withModelFallback as jest.MockedFunction<
  typeof modelPool.withModelFallback
>
const mockCreateServerClient = supabaseServer.createServerClient as jest.MockedFunction<
  typeof supabaseServer.createServerClient
>
const mockCreateAdminClient = supabaseServer.createAdminClient as jest.MockedFunction<
  typeof supabaseServer.createAdminClient
>

// Test campaign data
const testCampaign: Campaign = {
  id: 'campaign-123',
  status: 'active',
  ownerName: 'GM',
  characterName: 'Hero',
  characterProfession: 'Ranger',
  genero: 'Fantasy',
  tom: 'Epic',
  magia: 'High',
  tech: 'Medieval',
  visualStyle: 'Dark',
  worldDescription: 'A dark fantasy world',
  worldHistory: 'Ancient history...',
  systemSetting: 'D20',
}

// Test messages
const testMessages: Message[] = [
  {
    role: Role.SYSTEM,
    content: 'You are an RPG narrator',
  },
  {
    role: Role.USER,
    content: 'I walk into the tavern',
  },
]

// Helper to create request
function createRequest(
  body: any,
  headers: Record<string, string> = {}
): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer test-token-123',
      'x-custom-api-key': 'user-api-key',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    mockReset(MockGroq)
    jest.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should return 400 for invalid payload', async () => {
      const req = createRequest({ invalid: 'payload' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payload')
    })

    it('should return 401 if missing API key', async () => {
      mockPickApiKey.mockImplementation(() => {
        throw new Error('No API key available')
      })

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing API key')
    })

    it('should return 401 if missing auth token', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')

      const req = createRequest(
        {
          campaign: testCampaign,
          messages: testMessages,
          input: 'Test input',
        },
        { authorization: '' }
      )

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing auth token')
    })

    it('should return 401 if Supabase returns no user', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 503 if Supabase not configured', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockCreateServerClient.mockReturnValue(null)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('Supabase not configured on server')
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')

      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              status: 'active',
              owner_id: 'user-123',
              character_data_json: {
                inferred: {
                  profession: 'Ranger',
                  health: { tier: 'HEALTHY' },
                  inventory: [],
                },
              },
            },
          }),
        })),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)
    })

    it('should return 429 if rate limited', async () => {
      mockIsRateLimited.mockResolvedValue(true)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('should rate limit by campaign and user', async () => {
      mockIsRateLimited.mockResolvedValue(false)

      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              status: 'active',
              owner_id: 'owner-456',
              character_data_json: {
                inferred: {
                  profession: 'Ranger',
                  health: { tier: 'HEALTHY' },
                  inventory: [],
                },
              },
            },
          }),
        })),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'You enter the tavern...',
              tool_calls: [],
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      await POST(req)

      expect(mockIsRateLimited).toHaveBeenCalledWith('chat:user-123:campaign-123')
    })
  })

  describe('Campaign Validation', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)
    })

    it('should return 404 if campaign not found', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => {
          if (table === 'campaigns') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            }
          }

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest
              .fn()
              .mockReturnThis()
              .mockImplementation(() => ({
                eq: jest.fn().mockReturnThis().mockImplementation(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      status: 'accepted',
                      is_dead: false,
                      character_data_json: {
                        inferred: {
                          profession: 'Ranger',
                          health: { tier: 'HEALTHY' },
                          inventory: [],
                        },
                      },
                    },
                  }),
                })),
              })),
          }
        }),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Campaign not found')
    })

    it('should return 403 if character is dead', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => {
          if (table === 'campaigns') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  status: 'active',
                  owner_id: 'owner-456',
                },
              }),
            }
          }

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest
              .fn()
              .mockReturnThis()
              .mockImplementation(() => ({
                eq: jest.fn().mockReturnThis().mockImplementation(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      is_dead: true,
                      status: 'accepted',
                      character_data_json: {
                        inferred: {
                          profession: 'Ranger',
                          health: { tier: 'DEAD' },
                          inventory: [],
                        },
                      },
                    },
                  }),
                })),
              })),
          }
        }),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Character is dead')
    })

    it('should return 200 if campaign in waiting status', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              status: 'waiting_for_players',
              owner_id: 'user-123',
              character_data_json: {
                inferred: {
                  profession: 'Ranger',
                  health: { tier: 'HEALTHY' },
                  inventory: [],
                },
              },
            },
          }),
        })),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toContain('[SISTEMA] Mesa em espera')
      expect(data.toolCalls).toEqual([])
    })
  })

  describe('AI Response Handling', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)

      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              status: 'active',
              owner_id: 'owner-456',
              character_data_json: {
                inferred: {
                  profession: 'Ranger',
                  health: { tier: 'HEALTHY' },
                  inventory: [],
                },
              },
            },
          }),
        })),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)
      mockCreateAdminClient.mockReturnValue(mockSupabase as any)
    })

    it('should return text response from Groq', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'You walk into the tavern...',
              tool_calls: null,
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'I walk into the tavern',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('You walk into the tavern...')
      expect(data.toolCalls).toEqual([])
    })

    it('should handle tool calls from Groq', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'request_roll',
                    arguments: JSON.stringify({
                      attribute: 'VIGOR',
                      is_profession_relevant: true,
                      difficulty: 'NORMAL',
                    }),
                  },
                },
              ],
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'I try to climb the wall',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('')
      expect(data.toolCalls).toHaveLength(1)
      expect(data.toolCalls[0].name).toBe('request_roll')
      expect(data.toolCalls[0].args).toEqual({
        attribute: 'VIGOR',
        is_profession_relevant: true,
        difficulty: 'NORMAL',
      })
    })

    it('should suppress text if request_roll tool is called', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Some text here',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'request_roll',
                    arguments: JSON.stringify({
                      attribute: 'VIGOR',
                      is_profession_relevant: true,
                      difficulty: 'NORMAL',
                    }),
                  },
                },
              ],
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'I attack!',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(data.text).toBe('')
      expect(data.toolCalls).toHaveLength(1)
    })

    it('should handle tool response continuation', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Based on your roll result...',
              tool_calls: [],
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        toolResponse: {
          name: 'request_roll',
          result: { success: true, dice: 18 },
          callId: 'call_123',
          args: { attribute: 'VIGOR', difficulty: 'NORMAL' },
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toContain('Based on your roll result')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)

      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              status: 'active',
              owner_id: 'owner-456',
              character_data_json: {
                inferred: {
                  profession: 'Ranger',
                  health: { tier: 'HEALTHY' },
                  inventory: [],
                },
              },
            },
          }),
        })),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)
      mockCreateAdminClient.mockReturnValue(mockSupabase as any)
    })

    it('should handle Groq 429 rate limit error', async () => {
      const error = new Error('Rate limit exceeded')
      ;(error as any).status = 429

      mockWithModelFallback.mockRejectedValue(error)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('should handle Groq generic errors', async () => {
      const error = new Error('Something went wrong')
      ;(error as any).status = 500

      mockWithModelFallback.mockRejectedValue(error)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Server error')
    })
  })

  describe('Multiplayer Scenarios', () => {
    it('should include multiplayer POV instructions with multiple players', async () => {
      mockPickApiKey.mockReturnValue('valid-api-key')
      mockIsRateLimited.mockResolvedValue(false)

      const mockSupabase = {
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: jest.fn((table) => {
          if (table === 'campaign_players') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  status: 'accepted',
                  is_dead: false,
                  character_data_json: {
                    inferred: {
                      profession: 'Ranger',
                      health: { tier: 'HEALTHY' },
                      inventory: [],
                    },
                  },
                },
              }),
            }
          }

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                status: 'active',
                owner_id: 'owner-456',
              },
            }),
          }
        }),
      }

      mockCreateServerClient.mockReturnValue(mockSupabase as any)

      const mockAdminSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [
              { player_id: 'player-1', character_name: 'Hero 1' },
              { player_id: 'player-2', character_name: 'Hero 2' },
            ],
          }),
        }),
      }

      mockCreateAdminClient.mockReturnValue(mockAdminSupabase as any)

      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'POV - Hero 1: ...\n\nPOV - Hero 2: ...',
              tool_calls: [],
            },
          },
        ],
      } as any)

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'What do we see?',
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })
})
