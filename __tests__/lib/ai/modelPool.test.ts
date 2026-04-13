import { MODELS, withModelFallback } from '@/lib/ai/modelPool'

describe('modelPool - MODELS', () => {
  it('should have 3 models defined', () => {
    expect(MODELS).toHaveLength(3)
  })

  it('should have models in priority order', () => {
    expect(MODELS[0]).toBe('llama-3.3-70b-versatile')
    expect(MODELS[1]).toBe('qwen-2.5-72b-instruct')
    expect(MODELS[2]).toBe('llama-3.1-8b-instant')
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
    expect(handler).toHaveBeenCalledWith('llama-3.3-70b-versatile')
    expect(modelUsed).toBe('llama-3.3-70b-versatile')
  })

  it('should fallback to second model on failure', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === 'llama-3.3-70b-versatile') {
        throw new Error('First model failed')
      }
      return 'success'
    })

    const result = await withModelFallback(handler)

    expect(result).toBe('success')
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, 'llama-3.3-70b-versatile')
    expect(handler).toHaveBeenNthCalledWith(2, 'qwen-2.5-72b-instruct')
  })

  it('should fallback to third model on multiple failures', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model !== 'llama-3.1-8b-instant') {
        throw new Error(`${model} failed`)
      }
      return 'success from llama-3.1-8b-instant'
    })

    const result = await withModelFallback(handler)

    expect(result).toBe('success from llama-3.1-8b-instant')
    expect(handler).toHaveBeenCalledTimes(3)
    expect(handler).toHaveBeenLastCalledWith('llama-3.1-8b-instant')
  })

  it('should throw error if all models fail', async () => {
    const handler = jest.fn(async (model: string) => {
      throw new Error(`${model} failed`)
    })

    await expect(withModelFallback(handler)).rejects.toThrow('failed')
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('should propagate 429 error immediately', async () => {
    const error429: any = new Error('Rate limited')
    error429.status = 429

    const handler = jest.fn(async (model: string) => {
      throw error429
    })

    await expect(withModelFallback(handler)).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should propagate 429 code error immediately', async () => {
    const error429: any = new Error('Rate limited')
    error429.code = 429

    const handler = jest.fn(async (model: string) => {
      throw error429
    })

    await expect(withModelFallback(handler)).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should track model index by key', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === 'llama-3.3-70b-versatile') {
        throw new Error('First model failed')
      }
      return 'success'
    })

    // First call with key: tries first two models
    await withModelFallback(handler, { key: 'user-123' })
    expect(handler).toHaveBeenCalledTimes(2)

    // Reset mock
    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    // Second call with same key: should start from second model
    await withModelFallback(handler, { key: 'user-123' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('qwen-2.5-72b-instruct')
  })

  it('should remember best model per key', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === 'llama-3.3-70b-versatile') {
        throw new Error('First model failed')
      }
      if (model === 'qwen-2.5-72b-instruct') {
        throw new Error('Second model failed')
      }
      return 'success'
    })

    // First call: tries all three models, last one succeeds
    await withModelFallback(handler, { key: 'user-456' })
    expect(handler).toHaveBeenCalledTimes(3)

    // Reset mock
    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    // Second call with same key: should start from third model (the last successful one)
    await withModelFallback(handler, { key: 'user-456' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('llama-3.1-8b-instant')
  })

  it('should reset to first model on all failures with key', async () => {
    const handler = jest.fn(async (model: string) => {
      throw new Error(`${model} failed`)
    })

    // First call: all models fail
    await expect(withModelFallback(handler, { key: 'user-789' })).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(3)

    // Reset mock
    handler.mockClear()
    handler.mockImplementation(async (model: string) => 'success')

    // Second call with same key: should restart from first model
    await withModelFallback(handler, { key: 'user-789' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('llama-3.3-70b-versatile')
  })

  it('should support different keys independently', async () => {
    const handler1 = jest.fn(async (model: string) => {
      if (model === 'llama-3.3-70b-versatile') {
        throw new Error('Failed')
      }
      return 'success'
    })

    const handler2 = jest.fn(async (model: string) => {
      if (model !== 'llama-3.1-8b-instant') {
        throw new Error('Failed')
      }
      return 'success'
    })

    // First user: best model is second
    await withModelFallback(handler1, { key: 'user-a' })

    // Second user: best model is third
    await withModelFallback(handler2, { key: 'user-b' })

    // Clear mocks and try again
    handler1.mockClear()
    handler1.mockImplementation(async () => 'success')

    handler2.mockClear()
    handler2.mockImplementation(async () => 'success')

    // First user should use second model
    await withModelFallback(handler1, { key: 'user-a' })
    expect(handler1).toHaveBeenCalledWith('qwen-2.5-72b-instruct')

    // Second user should use third model
    await withModelFallback(handler2, { key: 'user-b' })
    expect(handler2).toHaveBeenCalledWith('llama-3.1-8b-instant')
  })

  it('should return data correctly from successful call', async () => {
    const testData = { message: 'Test response', tokens: 100 }
    const handler = jest.fn(async (model: string) => testData)

    const result = await withModelFallback(handler)

    expect(result).toEqual(testData)
  })

  it('should handle concurrent calls without interference', async () => {
    const handler = jest.fn(async (model: string) => {
      if (model === 'llama-3.3-70b-versatile') {
        throw new Error('First model failed')
      }
      return 'success'
    })

    // Run multiple concurrent calls
    const results = await Promise.all([
      withModelFallback(handler),
      withModelFallback(handler),
      withModelFallback(handler),
    ])

    expect(results).toEqual(['success', 'success', 'success'])
  })
})
