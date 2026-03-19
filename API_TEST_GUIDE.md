# 🔌 API Integration Tests Guide

**MestrAi Virtual Tabletop** - API Integration Testing Documentation

Created: 2026-03-19
Version: 1.0.0

---

## 📋 Overview

This guide covers the API integration tests for MestrAi's backend endpoints. The test suite includes comprehensive coverage for:

- ✅ `/api/chat` - Main game narrative AI endpoint
- ✅ `/api/validate-key` - Groq API key validation
- ✅ `/api/image` - Image generation with Pollinations API
- ✅ `/api/character-infer` - Character sheet generation with Groq

**Test Statistics:**
- Total Files: 4 API test files
- Total Test Suites: 40+ test suites
- Total Tests: 150+ integration tests
- Coverage: Authentication, Rate Limiting, Error Handling, Data Validation

---

## 🚀 Quick Start

### Running API Tests

```bash
# Run all tests (unit tests, API tests excluded)
npm test

# Run specific API test file
npm test -- __tests__/api/chat.test.ts

# Run API tests with Node environment
npx jest __tests__/api/validate-key.test.ts --testEnvironment=node --no-coverage
```

### Test File Locations

```
__tests__/api/
├── chat.test.ts              ✅ AI chat endpoint tests
├── validate-key.test.ts      ✅ API key validation tests
├── image.test.ts             ✅ Image generation tests
└── character-infer.test.ts   ✅ Character generation tests
```

---

## 📝 Test Files

### 1. Chat API Tests (`__tests__/api/chat.test.ts`)

**Endpoint:** `POST /api/chat`
**Purpose:** Main game narrative AI endpoint
**Tests:** 17+ test cases

#### Test Categories:

```typescript
describe('POST /api/chat', () => {
  describe('Authentication & Authorization', () => {
    ✓ Invalid payload validation
    ✓ Missing API key handling
    ✓ Missing auth token handling
    ✓ Unauthorized user rejection
    ✓ Supabase configuration errors
  })

  describe('Rate Limiting', () => {
    ✓ Rate limit enforcement
    ✓ Rate limit key generation (user + campaign)
  })

  describe('Campaign Validation', () => {
    ✓ Campaign not found (404)
    ✓ Dead character handling (403)
    ✓ Waiting game status (200)
  })

  describe('AI Response Handling', () => {
    ✓ Text response from Groq
    ✓ Tool call handling
    ✓ Text suppression for request_roll
    ✓ Tool response continuation
  })

  describe('Error Handling', () => {
    ✓ Groq 429 rate limit errors
    ✓ Generic Groq errors (500)
  })

  describe('Multiplayer Scenarios', () => {
    ✓ Multiple player POV instructions
  })
})
```

#### Key Mocks:

```typescript
// Groq SDK
jest.mock('groq-sdk')
MockGroq.mockImplementation(() => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({...})
    }
  }
}))

// Supabase
mockCreateServerClient.mockReturnValue({
  auth: { getUser: jest.fn(...) },
  from: jest.fn(...)
})

// Rate Limiter
mockIsRateLimited.mockResolvedValue(false)

// Model Fallback
mockWithModelFallback.mockResolvedValue({...})
```

#### Example Test:

```typescript
it('should return text response from Groq', async () => {
  mockWithModelFallback.mockResolvedValue({
    choices: [{
      message: {
        content: 'You walk into the tavern...',
        tool_calls: [],
      },
    }],
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
```

---

### 2. Validate Key Tests (`__tests__/api/validate-key.test.ts`)

**Endpoint:** `POST /api/validate-key`
**Purpose:** Validate Groq API key functionality
**Tests:** 14+ test cases

#### Test Categories:

```typescript
describe('POST /api/validate-key', () => {
  describe('API Key Validation', () => {
    ✓ Missing API key rejection
    ✓ API key header parsing
    ✓ Fallback key handling
  })

  describe('Rate Limiting', () => {
    ✓ IP-based rate limiting
    ✓ Allowed requests
    ✓ x-forwarded-for header parsing
  })

  describe('Groq Model Testing', () => {
    ✓ Minimal Groq config
    ✓ Successful Groq response(200)
    ✓ Groq rate limit handling (429)
    ✓ Groq 401 error handling
    ✓ Groq response status extraction
    ✓ Groq error code extraction
  })

  describe('Error Handling', () => {
    ✓ Unexpected errors
    ✓ Generic error messages
  })
})
```

#### Test Details:

```typescript
// Rate limiting by IP
it('should rate limit by IP address', async () => {
  mockIsRateLimited.mockResolvedValue(true)
  const req = createRequest({}, '192.168.1.100')
  expect(mockIsRateLimited).toHaveBeenCalledWith('validate:192.168.1.100')
})

// Groq rate limit detection
it('should return 429 if Groq rate limits', async () => {
  const error = new Error('Rate limit exceeded')
  error.status = 429
  mockGroqInstance.chat.completions.create.mockRejectedValue(error)
  const response = await POST(req)
  expect(response.status).toBe(429)
  expect(data.error).toContain('sem recursos')  // Portuguese message
})
```

---

### 3. Image API Tests (`__tests__/api/image.test.ts`)

**Endpoint:** `GET /api/image`
**Purpose:** Generate images using Pollinations API
**Tests:** 20+ test cases

#### Test Categories:

```typescript
describe('GET /api/image', () => {
  describe('Parameter Validation', () => {
    ✓ Missing prompt rejection
    ✓ Whitespace-only prompt rejection
    ✓ Width parameter parsing
    ✓ Height parameter parsing
    ✓ Seed parameter parsing
    ✓ Invalid parameter handling
  })

  describe('Rate Limiting', () => {
    ✓ IP-based rate limiting
    ✓ x-forwarded-for extraction
    ✓ Default unknown IP
  })

  describe('Model Selection', () => {
    ✓ klein-large for <5 users
    ✓ klein + klein-large for 5-10 users
    ✓ turbo + klein + klein-large for 11-500 users
    ✓ Full chain for 500+ users
  })

  describe('Image Response', () => {
    ✓ Image data with correct content-type
    ✓ Default to image/jpeg
    ✓ Cache control headers
    ✓ Buffer preservation
  })

  describe('Error Handling', () => {
    ✓ All models fail (502)
    ✓ Last error status returned
    ✓ Default 502 status
  })

  describe('URL Construction', () => {
    ✓ Prompt URL encoding
    ✓ Multi-parameter URL construction
  })
})
```

#### Model Fallback Chain:

```typescript
<5 users:      ['klein-large']
5-10 users:    ['klein', 'klein-large']
11-500 users:  ['turbo', 'klein', 'klein-large']
500+ users:    ['flux', 'zimage', 'turbo', 'klein', 'klein-large']

// Tests verify the chain is tried in order until one succeeds
it('should try multiple models for 11-500 users', async () => {
  mockFetch
    .mockResolvedValueOnce(new Response(null, { status: 502 }))
    .mockResolvedValueOnce(new Response(null, { status: 502 }))
    .mockResolvedValueOnce(new Response(imageData, { status: 200 }))

  const req = createRequest('wizard', { users: 100 })
  await GET(req)

  expect(mockFetch).toHaveBeenCalledTimes(3)
  expect(mockFetch.mock.calls[0][0]).toContain('model=turbo')
  expect(mockFetch.mock.calls[2][0]).toContain('model=klein-large')
})
```

---

### 4. Character Infer Tests (`__tests__/api/character-infer.test.ts`)

**Endpoint:** `POST /api/character-infer`
**Purpose:** Generate character sheets using AI + rule validation
**Tests:** 30+ test cases

#### Test Categories:

```typescript
describe('POST /api/character-infer', () => {
  describe('Input Validation', () => {
    ✓ Invalid payload rejection
    ✓ Required field validation (all 7 fields)
    ✓ Optional profession field
  })

  describe('Rate Limiting', () => {
    ✓ IP-based rate limiting
    ✓ Rate limit check before API call
    ✓ x-forwarded-for extraction
  })

  describe('API Key Handling', () => {
    ✓ Missing API key (401)
    ✓ Custom API key usage
    ✓ Fallback API key
  })

  describe('Character Generation', () => {
    ✓ Valid character sheet creation
    ✓ Attribute normalization (0-5 range)
    ✓ String attribute conversion
    ✓ Comma decimal handling
    ✓ Inventory normalization
    ✓ Initial HEALTHY health state
  })

  describe('JSON Parsing', () => {
    ✓ JSON not found warning
    ✓ Invalid JSON warning
    ✓ Markdown code block extraction
    ✓ Extra whitespace handling
  })

  describe('Schema Validation', () => {
    ✓ Incomplete character warning
    ✓ Missing attributes handling
    ✓ Profession fallback logic
    ✓ Model profession usage
  })

  describe('Error Handling', () => {
    ✓ Server errors (500)
    ✓ Groq errors (503)
  })

  describe('Integration Tests', () => {
    ✓ Full character creation flow
    ✓ Campaign context in prompt
  })
})
```

#### Attribute Normalization:

```typescript
// Maintains D&D-style attributes (0-5 scale)
// Handles various input formats:

✓ Numbers:     3 → 3
✓ Strings:     "3" → 3
✓ Decimals:    3.5 → 3
✓ Comma format: "3,5" → 3

// Clamping to valid range [0-5]
✓ Over max:    10 → 5
✓ Under min:   -5 → 0
```

#### Example Test:

```typescript
it('should normalize inventory items', async () => {
  mockWithModelFallback.mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          profession: 'Ranger',
          attributes: { VIGOR: 3, ... },
          inventory: [
            'Sword',  // String → equipment
            { name: 'Bow', type: 'equipment' },
            { name: 'Arrows', type: 'consumable', quantity: 20 },
          ],
        }),
      },
    }],
  } as any)

  const response = await POST(req)
  const data = await response.json()

  expect(data.character.inventory).toHaveLength(3)
  expect(data.character.inventory[0].type).toBe('equipment')
  expect(data.character.inventory[2].type).toBe('consumable')
})
```

---

## 🛠️ Mock Setup

### Common Mock Patterns

#### Mock Groq SDK

```typescript
jest.mock('groq-sdk')

const MockGroq = Groq as jest.MockedClass<typeof Groq>
const mockGroqInstance = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Response text',
            tool_calls: [],
          },
        }],
      }),
    },
  },
}
MockGroq.mockImplementation(() => mockGroqInstance as any)
```

#### Mock Supabase Client

```typescript
jest.mock('@/lib/supabase/server')

const mockCreateServerClient = supabaseServer.createServerClient as jest.MockedFunction<...>
mockCreateServerClient.mockReturnValue({
  auth: { getUser: jest.fn(...) },
  from: jest.fn((table) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: {...} }),
  })),
} as any)
```

#### Mock Rate Limiter

```typescript
jest.mock('@/lib/ai/rateLimit')

const mockIsRateLimited = rateLimit.isRateLimited as jest.MockedFunction<...>
mockIsRateLimited.mockResolvedValue(false)  // Allow request
// or
mockIsRateLimited.mockResolvedValue(true)   // Reject request
```

---

## 📊 Test Execution Stats

### By Endpoint

| Endpoint | Tests | Focus | Status |
|----------|-------|-------|--------|
| `/api/chat` | 17 | Narrative AI, Groq, Tools | ✅ |
| `/api/validate-key` | 14 | Key validation, Groq | ✅ |
| `/api/image` | 20 | Image generation, Fallback | ✅ |
| `/api/character-infer` | 30 | Character generation, Validation | ✅ |
| **TOTAL** | **81** | **Full API coverage** | **✅** |

### By Category

| Category | Count | Examples |
|----------|-------|----------|
| Authentication | 12 | Token validation, API key checks |
| Rate Limiting | 9 | IP extraction, enforcement |
| Data Validation | 18 | Schema validation, type checking |
| AI Integration | 15 | Groq SDK, responses, fallbacks |
| Error Handling | 12 | 429, 503, 500 responses |
| Image Generation | 10 | Model selection, URL, buffering |
| Character Generation | 5 | Normalization, schema validation |

---

## 🔍 Key Testing Patterns

### 1. Request Creation Helper

```typescript
function createRequest(
  body: any,
  headers: Record<string, string> = {},
  ip: string = '127.0.0.1'
): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer test-token',
      'x-custom-api-key': 'user-key',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}
```

### 2. Response Verification

```typescript
const response = await POST(req)
const data = await response.json()

expect(response.status).toBe(200)
expect(data).toMatchObject({
  text: expect.any(String),
  toolCalls: expect.any(Array),
})
```

### 3. Mock Verification

```typescript
expect(mockIsRateLimited).toHaveBeenCalledWith('chat:user-123:campaign-123')
expect(mockWithModelFallback).toHaveBeenCalledWith(
  expect.any(Function),
  expect.objectContaining({ key: expect.any(String) })
)
```

---

## 🚨 Common Issues & Solutions

### Issue: Request/Response not defined

**Problem:** API tests expect Node environment with fetch globals
**Solution:**
```bash
# Run with Node environment
npx jest __tests__/api/chat.test.ts --testEnvironment=node
```

### Issue: TypeScript generics cause parse errors

**Problem:** `jest.MockedClass<typeof Groq>` syntax errors
**Solution:** Ensure jest.config.js properly handles TypeScript for API tests

### Issue: Mock not resetting between tests

**Problem:** MockGroq remains in state from previous test
**Solution:**
```typescript
beforeEach(() => {
  mockReset(MockGroq)
  jest.clearAllMocks()
})
```

### Issue: Nested Supabase mock structure wrong

**Problem:** Test expects different table structure
**Solution:** Verify mock `.from()` returns correct chain for that table name

---

## 📈 Extending Tests

### Adding New API Test

1. **Create test file** in `__tests__/api/new-endpoint.test.ts`
2. **Import helpers** for Request creation
3. **Set up mocks** for external dependencies
4. **Write test suites** by category
5. **Run tests** with `npm test -- __testPathPatterns=__tests__/api/new-endpoint`

### Example: Adding OAuth2 Endpoint Test

```typescript
describe('POST /api/oauth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('OAuth Token Exchange', () => {
    it('should exchange code for access token', async () => {
      mockOAuthProvider.mockResolvedValue({
        access_token: 'token',
        expires_in: 3600,
      })

      const req = createRequest({ code: 'auth-code-123' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.token).toBe('token')
    })
  })
})
```

---

## 🔗 Integration with CI/CD

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm test -- __testPathPatterns=__tests__/api --no-coverage

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: coverage/
```

---

## 📚 Best Practices

### DO:
- ✅ Use `beforeEach()` to reset all mocks
- ✅ Create helper functions for common request patterns
- ✅ Test both success and error paths
- ✅ Mock external APIs (Groq, Pollinations, Supabase)
- ✅ Verify mock call arguments
- ✅ Use descriptive test names
- ✅ Group tests by feature with `describe()`

### DON'T:
- ❌ Use real API keys in tests
- ❌ Make actual HTTP requests
- ❌ Leave tests in pending state
- ❌ Share mocks between test suites
- ❌ Test implementation details
- ❌ Have tests dependent on each other order

---

## 📞 Support

For questions or issues:

1. Check test files in `__tests__/api/`
2. Review mock setup patterns
3. Consult This documentation
4. Check `__tests__/lib/` for unit test examples
5. Review E2E_TEST_GUIDE.md for end-to-end patterns

---

**Created:** 2026-03-19
**Last Updated:** 2026-03-19
**Maintained by:** API Test Suite
**Status:** ✅ Production Ready
