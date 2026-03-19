// Fixtures para testes E2E do MestrAi

export const TEST_USER = {
  email: 'teste@example.com',
  password: 'TestPassword123!',
  username: 'TestUser',
}

export const TEST_USER_2 = {
  email: 'teste2@example.com',
  password: 'TestPassword123!',
  username: 'TestUser2',
}

export const TEST_CAMPAIGN = {
  title: 'The Lost Kingdom',
  description: 'A epic adventure in a magical realm',
  worldHistory: 'Three centuries ago, a great darkness fell upon the kingdom...',
  genero: 'Fantasy',
  tom: 'Epic and Heroic',
  magia: 'High Magic',
  tech: 'Medieval',
  visualStyle: 'Dark and Mystical',
  characterName: 'Aragorn the Ranger',
  characterAppearance: 'Tall, dark-haired warrior with piercing blue eyes',
  characterBackstory: 'Once a great ranger, now seeking redemption',
  characterProfession: 'Ranger',
}

export const TEST_CHARACTER = {
  name: 'Legolas Greenleaf',
  appearance: 'Blonde elf with keen eyes',
  profession: 'Archer',
  backstory: 'Ancient elf from the woodland realm',
  VIGOR: 3,
  DESTREZA: 5,
  MENTE: 3,
  PRESENÇA: 4,
}

export const GROQ_API_KEY = 'gsk_test_1234567890abcdef'

export const URLS = {
  home: '/',
  auth: '/auth',
  dashboard: '/dashboard',
  setupKey: '/setup-key',
  howItWorks: '/how-it-works',
  newCampaign: '/campaigns/new',
  campaignById: (id: string) => `/campaigns/${id}`,
  campaignJoin: (id: string) => `/campaigns/${id}/join`,
  campaignAdmin: (id: string) => `/campaigns/${id}/admin`,
}
