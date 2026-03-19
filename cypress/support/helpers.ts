// Cypress helpers para testes E2E

import { TEST_USER, TEST_CAMPAIGN, GROQ_API_KEY, URLS } from '../fixtures/test-data'

/**
 * Login como usuário de teste
 */
export const login = (email = TEST_USER.email, password = TEST_USER.password) => {
  cy.visit(URLS.auth)
  cy.get('input[type="email"]').first().type(email)
  cy.get('input[type="password"]').first().type(password)
  cy.get('button[type="submit"]').contains(/Sign in|Login/).click()
  cy.url().should('include', URLS.dashboard)
}

/**
 * Signup como novo usuário
 */
export const signup = (email: string, password: string, username: string) => {
  cy.visit(URLS.auth)

  // Switch to signup tab or form
  cy.get('button').contains(/Sign up|Create account/).click({ force: true })

  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').first().type(password)
  cy.get('input[type="text"]').type(username)

  cy.get('button[type="submit"]').contains(/Sign up|Create/).click()
  cy.url().should('include', URLS.dashboard)
}

/**
 * Setup Groq API Key
 */
export const setupGroqKey = (apiKey = GROQ_API_KEY) => {
  cy.visit(URLS.setupKey)
  cy.get('input[placeholder*="key"]', { timeout: 5000 }).type(apiKey)
  cy.get('button').contains(/Save|Validate|Submit/).click()
  cy.get('button').contains(/Continue|Next/).click({ force: true })
}

/**
 * Criar nova campanha
 */
export const createCampaign = (campaignData = TEST_CAMPAIGN) => {
  cy.visit(URLS.newCampaign)

  // Step 1: World Details
  cy.get('input[placeholder*="title"], input[name*="title"]').type(campaignData.title)
  cy.get('textarea[placeholder*="description"]').type(campaignData.description)
  cy.get('textarea[placeholder*="world"]').type(campaignData.worldHistory)

  // Select genre
  cy.get('select, [role="combobox"]').first().click()
  cy.get('[role="option"]').contains(campaignData.genero).click({ force: true })

  // Continue to next step
  cy.get('button').contains(/Next|Continue/).first().click()

  // Step 2: Character Details
  cy.get('input[placeholder*="name"]').eq(1).type(campaignData.characterName)
  cy.get('textarea[placeholder*="appearance"]').type(campaignData.characterAppearance)
  cy.get('textarea[placeholder*="backstory"]').type(campaignData.characterBackstory)

  // Continue to step 3
  cy.get('button').contains(/Next|Continue/).click()

  // Step 3: Attributes (if present)
  cy.get('button').contains(/Create|Start Campaign/).click()

  // Should redirect to campaign or dashboard
  cy.url().should('include', '/campaigns')
}

/**
 * Fazer logout
 */
export const logout = () => {
  cy.get('button').contains(/Logout|Sign out/).click()
  cy.url().should('include', URLS.home)
}

/**
 * Visitar dashboard
 */
export const visitDashboard = () => {
  cy.visit(URLS.dashboard)
  cy.get('[role="heading"]').contains(/Campaigns|Dashboard/).should('be.visible')
}

/**
 * Entrar em uma campanha
 */
export const joinCampaign = (campaignTitle: string) => {
  cy.visit(URLS.dashboard)
  cy.contains(campaignTitle).click()
  cy.get('button').contains(/Join|Enter/).click()
}

/**
 * Fazer uma ação de rolagem de dados
 */
export const rollDice = (attribute: string, difficulty = 'NORMAL') => {
  cy.get('button').contains(/Roll|Dice|Test/).click()
  cy.get('select, [role="combobox"]').eq(0).click()
  cy.get('[role="option"]').contains(attribute).click({ force: true })
  cy.get('select, [role="combobox"]').eq(1).click()
  cy.get('[role="option"]').contains(difficulty).click({ force: true })
  cy.get('button').contains(/Roll|Confirm/).click()
}

/**
 * Enviar uma ação de jogo
 */
export const playerAction = (action: string) => {
  cy.get('textarea[placeholder*="action"], input[placeholder*="action"]').type(action)
  cy.get('button').contains(/Send|Roll|Act/).click()
}

/**
 * Esperar pelainterpretação da IA
 */
export const waitForAIResponse = (timeout = 10000) => {
  cy.get('[role="status"], .loading').should('exist')
  cy.get('[role="status"], .loading', { timeout }).should('not.exist')
}

/**
 * Verificar se personagem está vivo
 */
export const isCharacterAlive = () => {
  return cy.contains(/DEAD|Dead|dead/).should('not.exist')
}

/**
 * Verificar status de saúde
 */
export const checkHealthStatus = (expectedStatus: string) => {
  cy.contains(expectedStatus).should('be.visible')
}

/**
 * Verificar dano aplicado
 */
export const checkDamageTaken = () => {
  cy.contains(/damage|Damage|DAMAGE/).should('be.visible')
}

/**
 * Limpar localStorage (logout simulado)
 */
export const clearAuth = () => {
  localStorage.clear()
  cy.visit(URLS.home)
}
