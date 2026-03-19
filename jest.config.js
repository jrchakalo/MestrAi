const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const isApiTestExplicitlyRequested = process.argv.some((arg) =>
  arg.includes('__tests__/api/')
)

const testPathIgnorePatterns = ['<rootDir>/.next/', '<rootDir>/node_modules/']

if (!isApiTestExplicitlyRequested) {
  testPathIgnorePatterns.push('<rootDir>/__tests__/api/')
}

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns,
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

