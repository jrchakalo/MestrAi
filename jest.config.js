const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
  // Handle ESM modules properly
})

const isApiTestExplicitlyRequested = process.argv.some((arg) =>
  arg.includes('__tests__/api/')
)

const testPathIgnorePatterns = ['<rootDir>/.next/', '<rootDir>/node_modules/']

if (!isApiTestExplicitlyRequested) {
  testPathIgnorePatterns.push('<rootDir>/__tests__/api/')
}

// Set environment variables before config
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key-123'

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns,
  transformIgnorePatterns: [
    'node_modules/(?!(remark-gfm|micromark-extend-gfm|decode-named-character-reference|character-entities|ccount)/)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
}

module.exports = createJestConfig(customJestConfig)

