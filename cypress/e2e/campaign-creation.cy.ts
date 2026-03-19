/// <reference types="cypress" />

import { TEST_USER, TEST_CAMPAIGN, URLS } from '../fixtures/test-data'

describe('Campaign Creation E2E Tests', () => {
  beforeEach(() => {
    // Login before each test
    cy.clearAllCookies()
    localStorage.clear()
    cy.login(TEST_USER.email, TEST_USER.password)
  })

  describe('Dashboard', () => {
    it('should display dashboard with campaigns list', () => {
      cy.visit(URLS.dashboard)
      cy.get('h1, h2').contains(/Campaign|Dashboard/i).should('be.visible')
      cy.get('button').contains(/New Campaign|Create/i).should('be.visible')
    })

    it('should navigate to new campaign page', () => {
      cy.visit(URLS.dashboard)
      cy.get('button').contains(/New Campaign|Create/i).click()
      cy.url().should('include', '/campaigns/new')
    })

    it('should display list of user campaigns', () => {
      cy.visit(URLS.dashboard)
      // Should show at least one campaign or empty state
      cy.get('[role="list"], table, .campaign-list, article').should('be.visible')
    })

    it('should show campaign details when clicking on campaign', () => {
      cy.visit(URLS.dashboard)
      // Assuming there's at least one campaign
      cy.get('[role="listitem"], tr, article').first().click()
      cy.url().should('include', '/campaigns/')
    })
  })

  describe('Campaign Wizard - Step 1: World Details', () => {
    beforeEach(() => {
      cy.visit(URLS.newCampaign)
    })

    it('should display world details form', () => {
      cy.get('input[placeholder*="title"], input[name*="title"]').should('be.visible')
      cy.get('textarea[placeholder*="description"]').should('be.visible')
      cy.get('textarea[placeholder*="world"], textarea[placeholder*="history"]').should(
        'be.visible'
      )
    })

    it('should allow entering campaign title', () => {
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('input[placeholder*="title"]').should('have.value', TEST_CAMPAIGN.title)
    })

    it('should allow entering world description', () => {
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="description"]').should(
        'have.value',
        TEST_CAMPAIGN.description
      )
    })

    it('should allow selecting genre', () => {
      cy.get('select, [role="combobox"]').first().click()
      cy.get('[role="option"]').contains(/Fantasy|Horror|Sci-Fi/i).first().click()
      cy.get('select, [role="combobox"]').first().should('contain.text', /Fantasy|Horror|Sci-Fi/i)
    })

    it('should progress to next step', () => {
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="world"]').type(TEST_CAMPAIGN.worldHistory)
      cy.get('button').contains(/Next|Continue/i).click()

      // Should move to step 2
      cy.get('textarea[placeholder*="appearance"], input[placeholder*="name"]').should(
        'be.visible'
      )
    })

    it('should prevent next without required fields', () => {
      cy.get('button').contains(/Next|Continue/i).click()
      // Should stay on same page or show validation error
      // Title is usually required
      cy.url().should('include', '/campaigns/new')
    })

    it('should display all world customization options', () => {
      cy.get('select, [role="combobox"]').should('have.length.at.least', 3)
    })
  })

  describe('Campaign Wizard - Step 2: Character Details', () => {
    beforeEach(() => {
      cy.visit(URLS.newCampaign)
      // Complete step 1
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="world"]').type(TEST_CAMPAIGN.worldHistory)
      cy.get('button').contains(/Next|Continue/i).click()
    })

    it('should display character creation form', () => {
      cy.get('input[placeholder*="name"]').should('be.visible')
      cy.get('textarea[placeholder*="appearance"]').should('be.visible')
      cy.get('textarea[placeholder*="backstory"]').should('be.visible')
    })

    it('should allow entering character name', () => {
      cy.get('input[placeholder*="name"]').type(TEST_CAMPAIGN.characterName)
      cy.get('input[placeholder*="name"]').should('have.value', TEST_CAMPAIGN.characterName)
    })

    it('should allow entering character appearance', () => {
      cy.get('textarea[placeholder*="appearance"]').type(TEST_CAMPAIGN.characterAppearance)
      cy.get('textarea[placeholder*="appearance"]').should(
        'have.value',
        TEST_CAMPAIGN.characterAppearance
      )
    })

    it('should allow entering character backstory', () => {
      cy.get('textarea[placeholder*="backstory"]').type(TEST_CAMPAIGN.characterBackstory)
      cy.get('textarea[placeholder*="backstory"]').should('have.value', TEST_CAMPAIGN.characterBackstory)
    })

    it('should progress to step 3 or confirm', () => {
      cy.get('input[placeholder*="name"]').type(TEST_CAMPAIGN.characterName)
      cy.get('textarea[placeholder*="appearance"]').type(TEST_CAMPAIGN.characterAppearance)
      cy.get('textarea[placeholder*="backstory"]').type(TEST_CAMPAIGN.characterBackstory)
      cy.get('button').contains(/Next|Continue|Create/i).click()

      // Should either show step 3 or redirect to campaign
      cy.url().should('include', '/campaigns')
    })
  })

  describe('Campaign Wizard - Step 3: Attributes', () => {
    it('should display attribute allocation form if step 3 exists', () => {
      cy.visit(URLS.newCampaign)
      // Complete steps 1 and 2, then check for step 3
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="world"]').type(TEST_CAMPAIGN.worldHistory)
      cy.get('button').contains(/Next|Continue/i).click()

      cy.get('input[placeholder*="name"]').type(TEST_CAMPAIGN.characterName)
      cy.get('textarea[placeholder*="appearance"]').type(TEST_CAMPAIGN.characterAppearance)
      cy.get('textarea[placeholder*="backstory"]').type(TEST_CAMPAIGN.characterBackstory)
      cy.get('button').contains(/Next|Continue/i).click()

      // Check if attributes form appears
      cy.get('label, span').contains(/VIGOR|DESTREZA|MENTE/i).then(($el) => {
        if ($el.length > 0) {
          // Step 3 exists
          cy.get('label').contains(/VIGOR|DESTREZA/i).should('be.visible')
        }
      })
    })
  })

  describe("Complete Campaign Creation Flow", () => {
    it('should create campaign from start to finish', () => {
      cy.visit(URLS.newCampaign)

      // Step 1: World Details
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="world"]').type(TEST_CAMPAIGN.worldHistory)
      cy.get('button').contains(/Next|Continue/i).click()

      // Step 2: Character Details
      cy.get('input[placeholder*="name"]').type(TEST_CAMPAIGN.characterName)
      cy.get('textarea[placeholder*="appearance"]').type(TEST_CAMPAIGN.characterAppearance)
      cy.get('textarea[placeholder*="backstory"]').type(TEST_CAMPAIGN.characterBackstory)
      cy.get('button').contains(/Create|Start|Confirm/i).click()

      // Should be redirected to campaign or game session
      cy.url().should('include', '/campaigns')
      cy.url().should('not.include', '/new')
    })

    it('should show campaign in dashboard after creation', () => {
      cy.visit(URLS.newCampaign)
      cy.get('input[placeholder*="title"]').type(TEST_CAMPAIGN.title)
      cy.get('textarea[placeholder*="description"]').type(TEST_CAMPAIGN.description)
      cy.get('textarea[placeholder*="world"]').type(TEST_CAMPAIGN.worldHistory)
      cy.get('button').contains(/Next|Continue/i).click()

      cy.get('input[placeholder*="name"]').type(TEST_CAMPAIGN.characterName)
      cy.get('textarea[placeholder*="appearance"]').type(TEST_CAMPAIGN.characterAppearance)
      cy.get('textarea[placeholder*="backstory"]').type(TEST_CAMPAIGN.characterBackstory)
      cy.get('button').contains(/Create|Start|Confirm/i).click()

      // Go back to dashboard
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"], tr').contains(TEST_CAMPAIGN.title).should('be.visible')
    })
  })
})
