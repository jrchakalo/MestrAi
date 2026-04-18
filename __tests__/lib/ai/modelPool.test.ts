import { FAST_MODELS, MASTER_MODELS, MODELS, withModelFallback } from '@/lib/ai/modelPool'

describe('modelPool - model pools', () => {
  it('should expose the master pool in priority order', () => {
    expect(MASTER_MODELS).toHaveLength(4)
    expect(MASTER_MODELS[0]).toBe('meta-llama/llama-3.3-70b-instruct:free')
    expect(MASTER_MODELS[1]).toBe('openai/gpt-oss-120b:free')
    expect(MASTER_MODELS[2]).toBe('qwen/qwen3-next-80b-a3b-instruct:free')
    expect(MASTER_MODELS[3]).toBe('openrouter/free')
  })

  it('should expose the fast pool in priority order', () => {
    expect(FAST_MODELS).toHaveLength(3)
    expect(FAST_MODELS[0]).toBe('meta-llama/llama-3.1-8b-instruct:free')
    expect(FAST_MODELS[1]).toBe('google/gemma-2-9b-it:free')
    expect(FAST_MODELS[2]).toBe('openrouter/free')
  })

  it('should keep MODELS as an alias to the master pool', () => {
    expect(MODELS).toBe(MASTER_MODELS)
  })
})

describe('modelPool - withModelFallback', () => {
  it('should use the first model successfully', async () => {
    let modelUsed: string | undefined
    const handler = jest.fn(async (model: string) => {
      modelUsed = model
      return 'success'
    })

    const result = await withModelFallback(handler)

    expect(result).toBe('success')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(MASTER_MODELS[0])
    expect(modelUsed).toBe(MASTER_MODELS[0])
  })

  it('should fallback to second model on failure', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        throw new Error('First model failed')
      }
      return 'success'
    })

    const result = await withModelFallback(handler)

    expect(result).toBe('success')
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, MASTER_MODELS[0])
    expect(handler).toHaveBeenNthCalledWith(2, MASTER_MODELS[1])
  })

  it('should continue through retryable errors until a later model succeeds', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        const error: any = new Error('Rate limited')
        error.status = 429
        throw error
      }
      if (model === MASTER_MODELS[1]) {
        const error: any = new Error('Service unavailable')
        error.status = 503
        throw error
      }
      if (model === MASTER_MODELS[2]) {
        const error: any = new Error('Bad gateway')
        error.status = 502
        throw error
      }
      return 'success from safety net'
    })

    const result = await withModelFallback(handler)

    expect(result).toBe('success from safety net')
    expect(handler).toHaveBeenCalledTimes(4)
    expect(handler).toHaveBeenNthCalledWith(1, MASTER_MODELS[0])
    expect(handler).toHaveBeenNthCalledWith(2, MASTER_MODELS[1])
    expect(handler).toHaveBeenNthCalledWith(3, MASTER_MODELS[2])
    expect(handler).toHaveBeenNthCalledWith(4, MASTER_MODELS[3])
  })

  it('should throw error if all models fail', async () => {
    const handler = jest.fn(async (model: string) => {
      const error: any = new Error(`${model} failed`)
      error.status = 429
      throw error
    })

    await expect(withModelFallback(handler)).rejects.toThrow('failed')
    expect(handler).toHaveBeenCalledTimes(4)
  })

  it('should track model index by key', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        throw new Error('First model failed')
      }
      return 'success'
    })

    await withModelFallback(handler, { key: 'user-123' })
    expect(handler).toHaveBeenCalledTimes(2)

    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    await withModelFallback(handler, { key: 'user-123' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(MASTER_MODELS[1])
  })

  it('should remember best model per key', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        throw new Error('First model failed')
      }
      if (model === MASTER_MODELS[1]) {
        throw new Error('Second model failed')
      }
      return 'success'
    })

    await withModelFallback(handler, { key: 'user-456' })
    expect(handler).toHaveBeenCalledTimes(3)

    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    await withModelFallback(handler, { key: 'user-456' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(MASTER_MODELS[2])
  })

  it('should reset to first model on all failures with key', async () => {
    const handler = jest.fn(async (model: string) => {
      throw new Error(`${model} failed`)
    })

    await expect(withModelFallback(handler, { key: 'user-789' })).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(4)

    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    await withModelFallback(handler, { key: 'user-789' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(MASTER_MODELS[0])
  })

  it('should support different keys independently', async () => {
    const handler1 = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        throw new Error('Failed')
      }
      return 'success'
    })

    const handler2 = jest.fn(async (model: string) => {
      if (model !== MASTER_MODELS[2]) {
        throw new Error('Failed')
      }
      return 'success'
    })

    await withModelFallback(handler1, { key: 'user-a' })
    await withModelFallback(handler2, { key: 'user-b' })

    handler1.mockClear()
    handler1.mockImplementation(async () => 'success')

    handler2.mockClear()
    handler2.mockImplementation(async () => 'success')

    await withModelFallback(handler1, { key: 'user-a' })
    expect(handler1).toHaveBeenCalledWith(MASTER_MODELS[1])

    await withModelFallback(handler2, { key: 'user-b' })
    expect(handler2).toHaveBeenCalledWith(MASTER_MODELS[2])
  })

  it('should return data correctly from successful call', async () => {
    const testData = { message: 'Test response', tokens: 100 }
    const handler = jest.fn(async () => testData)

    const result = await withModelFallback(handler)

    expect(result).toEqual(testData)
  })

  it('should handle concurrent calls without interference', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === MASTER_MODELS[0]) {
        throw new Error('First model failed')
      }
      return 'success'
    })

    const results = await Promise.all([
      withModelFallback(handler),
      withModelFallback(handler),
      withModelFallback(handler),
    ])

    expect(results).toEqual(['success', 'success', 'success'])
  })
})
