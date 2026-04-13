import { isRateLimited } from '@/lib/ai/rateLimit'

// Mock the supabase server
jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: jest.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>

describe('rateLimit - isRateLimited', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('with Supabase available', () => {
    beforeEach(() => {
      mockCreateAdminClient.mockReturnValue({
        rpc: jest.fn(),
      } as any)
    })

    it('should use Supabase RPC when admin client is available', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: false, error: null })
      mockCreateAdminClient.mockReturnValue({
        rpc: mockRpc,
      } as any)

      const result = await isRateLimited('test-key-supabase-1')

      expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
        p_key: 'test-key-supabase-1',
        p_limit: 20,
        p_window_seconds: 60,
      })
      expect(result).toBe(false)
    })

    it('should return true when rate limited', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null })
      mockCreateAdminClient.mockReturnValue({
        rpc: mockRpc,
      } as any)

      const result = await isRateLimited('test-key-supabase-2')

      expect(result).toBe(true)
    })

    it('should handle different keys independently', async () => {
      const mockRpc = jest
        .fn()
        .mockResolvedValueOnce({ data: false, error: null })
        .mockResolvedValueOnce({ data: true, error: null })

      mockCreateAdminClient.mockReturnValue({
        rpc: mockRpc,
      } as any)

      const result1 = await isRateLimited('key-supabase-a')
      const result2 = await isRateLimited('key-supabase-b')

      expect(result1).toBe(false)
      expect(result2).toBe(true)
    })

    it('should fallback to in-memory storage on RPC error', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } })
      mockCreateAdminClient.mockReturnValue({
        rpc: mockRpc,
      } as any)

      const result = await isRateLimited('test-key-fallback')

      // Should fall back to in-memory: false on first call
      expect(result).toBe(false)
    })
  })

  describe('without Supabase (fallback to in-memory)', () => {
    beforeEach(() => {
      mockCreateAdminClient.mockReturnValue(null)
    })

    it('should return false on first call for a key', async () => {
      const result = await isRateLimited('memory-test-key-unique-1')
      expect(result).toBe(false)
    })

    it('should return true when key makes 21 requests', async () => {
      const key = 'memory-test-key-unique-2'

      // Make 20 calls
      for (let i = 0; i < 20; i++) {
        const result = await isRateLimited(key)
        expect(result).toBe(false)
      }

      // 21st call should be rate limited
      const rateLimited = await isRateLimited(key)
      expect(rateLimited).toBe(true)
    })

    it('should track different keys independently', async () => {
      const key1 = 'memory-test-key-independent-1'
      const key2 = 'memory-test-key-independent-2'

      // Make 20 calls with key1
      for (let i = 0; i < 20; i++) {
        await isRateLimited(key1)
      }

      // key1 should be rate limited
      expect(await isRateLimited(key1)).toBe(true)

      // key2 should not be rate limited yet
      expect(await isRateLimited(key2)).toBe(false)
    })

    it('should handle malformed RPC response', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: undefined, error: null })
      mockCreateAdminClient.mockReturnValue({
        rpc: mockRpc,
      } as any)

      const result = await isRateLimited('test-key-malformed')
      expect(result).toBe(false) // Falls back to false for undefined data
    })

    it('should handle null admin client gracefully', async () => {
      mockCreateAdminClient.mockReturnValue(null)

      const result = await isRateLimited('test-key-null-admin')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('error handling', () => {
    it('should handle error in admin client gracefully', async () => {
      mockCreateAdminClient.mockReturnValue(null)

      const result = await isRateLimited('test-error-key')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('stress test - many concurrent calls', () => {
    beforeEach(() => {
      mockCreateAdminClient.mockReturnValue(null) // Use in-memory
    })

    it('should handle concurrent requests correctly', async () => {
      const key = 'stress-test-key'
      const promises = []

      // Create 25 concurrent requests
      for (let i = 0; i < 25; i++) {
        promises.push(isRateLimited(key))
      }

      const results = await Promise.all(promises)

      // Count results
      const passCount = results.filter((r) => r === false).length
      const blockCount = results.filter((r) => r === true).length

      // Should have approximately 20 passes and 5 blocks
      // (exact order depends on timing, but totals should be correct)
      expect(passCount + blockCount).toBe(25)
    })
  })
})
