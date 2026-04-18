import { POST } from '@/app/api/chat/route'
import * as keyPool from '@/lib/ai/keyPool'
import * as rateLimit from '@/lib/ai/rateLimit'
import * as modelPool from '@/lib/ai/modelPool'
import * as openRouter from '@/lib/ai/openRouter'
import * as supabaseServer from '@/lib/supabase/server'
import { Role, Campaign, Message } from '@/types'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('@/lib/ai/keyPool')
jest.mock('@/lib/ai/rateLimit')
jest.mock('@/lib/ai/modelPool')
jest.mock('@/lib/ai/openRouter')
jest.mock('@/lib/supabase/server')

const mockPickApiKey = keyPool.pickApiKey as jest.MockedFunction<typeof keyPool.pickApiKey>
const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<typeof rateLimit.isRateLimited>
const mockWithModelFallback = modelPool.withModelFallback as jest.MockedFunction<
  typeof modelPool.withModelFallback
>
const mockCreateOpenRouterClient = openRouter.createOpenRouterClient as jest.MockedFunction<
  typeof openRouter.createOpenRouterClient
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
    mockCreateOpenRouterClient.mockReset()
    jest.clearAllMocks()
    mockCreateOpenRouterClient.mockReturnValue({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any)
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

    it('should strip the free suffix from the model in sim mode', async () => {
      mockIsRateLimited.mockResolvedValue(false)

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
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

      const createCompletion = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'You enter the tavern...',
              tool_calls: [],
            },
          },
        ],
      })

      mockCreateServerClient.mockReturnValue(mockSupabase as any)
      mockCreateOpenRouterClient.mockReturnValue({
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      } as any)
      mockWithModelFallback.mockImplementation(async (runner) => runner('openai/test-model:free'))

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        input: 'Test input',
        sim_mode: true,
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(createCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'openai/test-model' })
      )
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

    it('should return text response from OpenRouter', async () => {
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

    it('should handle tool calls from OpenRouter', async () => {
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

    it('should preserve full update_character payload for new character revival flows', async () => {
      mockWithModelFallback.mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_update_character',
                  type: 'function',
                  function: {
                    name: 'update_character',
                    arguments: JSON.stringify({
                      name: 'Astra Válcara',
                      appearance: 'Cabelos curtos cor de cobre, óculos de quartzo.',
                      backstory: 'Engenheira-alquimista em busca do Coração de Vapor.',
                      profession: 'Engenheira-Alquimista',
                      attributes: {
                        VIGOR: 2,
                        DESTREZA: 4,
                        MENTE: 5,
                        PRESENÇA: 3,
                      },
                      health: {
                        tier: 'HEALTHY',
                        lightDamageCounter: 0,
                      },
                      revive_character: true,
                      inventory: [
                        {
                          id: 'catalisador-vapor',
                          name: 'Frasco de Catalisador de Vapor',
                          type: 'consumable',
                          quantity: 1,
                        },
                      ],
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
        input: 'Quero criar um novo personagem depois da morte.',
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.toolCalls).toHaveLength(1)
      expect(data.toolCalls[0].name).toBe('update_character')
      expect(data.toolCalls[0].args).toMatchObject({
        name: 'Astra Válcara',
        profession: 'Engenheira-Alquimista',
        revive_character: true,
        attributes: {
          VIGOR: 2,
          DESTREZA: 4,
          MENTE: 5,
          PRESENÇA: 3,
        },
        health: {
          tier: 'HEALTHY',
          lightDamageCounter: 0,
        },
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

    it('should inject roll classification guidance when continuing after request_roll', async () => {
      const createCompletion = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Você falha e quase derruba a bandeja, chamando atenção indesejada.',
              tool_calls: [],
            },
          },
        ],
      })

      mockCreateOpenRouterClient.mockReturnValue({
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      } as any)

      mockWithModelFallback.mockImplementation(async (runner) => {
        return runner('openai/test-model')
      })

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        toolResponse: {
          name: 'request_roll',
          result: {
            total: 9,
            naturalRoll: 4,
            outcome: 'FALHA_LEVE',
            label: 'FALHA LEVE',
          },
          callId: 'call_roll_456',
          args: { attribute: 'DESTREZA', difficulty: 'NORMAL', is_profession_relevant: false },
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toContain('falha')

      const sent = createCompletion.mock.calls[0]?.[0]
      const sentMessages = sent?.messages || []
      const postRollSystemMessage = sentMessages.find((m: any) =>
        typeof m?.content === 'string' && m.content.includes('Classificacao oficial: FALHA LEVE')
      )

      expect(postRollSystemMessage).toBeTruthy()
    })

    it('should rewrite contradictory narrative after roll resolution', async () => {
      const createCompletion = jest.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Você executa um mortal perfeito e aterrissa de forma impecável.',
                tool_calls: [],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Você tenta o mortal, mas escorrega na aterrissagem e quase cai, chamando atenção com um tropeço visível.',
                tool_calls: [],
              },
            },
          ],
        })

      mockCreateOpenRouterClient.mockReturnValue({
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      } as any)

      mockWithModelFallback.mockImplementation(async (runner) => runner('openai/test-model'))

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        toolResponse: {
          name: 'request_roll',
          result: {
            total: 9,
            naturalRoll: 4,
            outcome: 'FALHA_LEVE',
            label: 'FALHA LEVE',
          },
          callId: 'call_roll_789',
          args: { attribute: 'DESTREZA', difficulty: 'NORMAL', is_profession_relevant: false },
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(createCompletion).toHaveBeenCalledTimes(2)
      expect(data.text).toContain('escorrega')

      const rewriteCall = createCompletion.mock.calls[1]?.[0]
      const rewriteMessages = rewriteCall?.messages || []
      const rewriteInstruction = rewriteMessages.find((m: any) =>
        typeof m?.content === 'string' && m.content.includes('REESCRITA OBRIGATORIA DE COERENCIA MECANICA')
      )
      expect(rewriteInstruction).toBeTruthy()
    })

    it('should not offer request_roll again while resolving a roll tool response', async () => {
      const createCompletion = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'A consequência da rolagem acontece agora.',
              tool_calls: [],
            },
          },
        ],
      })

      mockCreateOpenRouterClient.mockReturnValue({
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      } as any)

      mockWithModelFallback.mockImplementation(async (runner) => {
        return runner('openai/test-model')
      })

      const req = createRequest({
        campaign: testCampaign,
        messages: testMessages,
        toolResponse: {
          name: 'request_roll',
          result: 4,
          callId: 'call_roll_123',
          args: { attribute: 'MENTE', difficulty: 'NORMAL' },
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toContain('A consequência da rolagem acontece agora.')
      expect(createCompletion).toHaveBeenCalledTimes(1)

      const sent = createCompletion.mock.calls[0]?.[0]
      const toolNames = (sent?.tools || []).map((tool: any) => tool?.function?.name)
      expect(toolNames).not.toContain('request_roll')
      expect(toolNames).toContain('apply_damage')
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

    it('should handle OpenRouter 429 rate limit error', async () => {
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

    it('should handle OpenRouter generic errors', async () => {
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
