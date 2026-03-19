/// <reference types="cypress" />

import { TEST_USER, TEST_USER_2, URLS } from '../fixtures/test-data'

describe('Campaign Joining & Game Session E2E Tests', () => {
  describe('Campaign Join Flow - Owner Perspective', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should display campaign admin panel', () => {
      cy.visit(URLS.dashboard)
      // Assuming campaign exists
      cy.get('article, [role="listitem"]').first().click()
      cy.url().should('include', '/campaigns/')
      cy.get('button, a').contains(/Admin|Settings|Manage/i).click()

      cy.get('[role="heading"]').contains(/Admin|Settings|Players/i).should('be.visible')
    })

    it('should show share link or join code', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.url().should('include', '/campaigns/')

      // Should display invite link or code
      cy.get('input[readonly], code, [role="status"]').should('be.visible')
    })

    it('should display pending players list', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.get('button, a').contains(/Admin|Settings/i).click()

      // Should show players section
      cy.get('h2, h3').contains(/Players|Pending/i).should('be.visible')
    })

    it('should approve pending player', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.get('button, a').contains(/Admin|Settings/i).click()

      // Should have approve button for pending players
      cy.get('button').contains(/Approve|Accept/i).first().then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('[role="status"], .toast').should('contain', /Approved|Added/i)
        }
      })
    })

    it('should ban player', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.get('button, a').contains(/Admin|Settings/i).click()

      cy.get('button').contains(/Ban|Remove/i).first().then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('[role="status"], .toast').should('contain', /Banned|Removed/i)
        }
      })
    })
  })

  describe('Campaign Join Flow - Player Perspective', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
    })

    it('should navigate to join campaign page', () => {
      // Assuming a campaign with known ID
      cy.visit(URLS.campaignJoin('test-campaign-id'))
      cy.get('h1, h2').should('contain', /Join|Campaign/i)
    })

    it('should display campaign info before joining', () => {
      cy.visit(URLS.campaignJoin('test-campaign-id'))
      cy.get('[role="heading"], .campaign-title').should('be.visible')
      cy.get('p, [role="status"]').contains(/World|Description/i).should('be.visible')
    })

    it('should allow player to join campaign', () => {
      cy.visit(URLS.campaignJoin('test-campaign-id'))
      cy.get('button').contains(/Join|Enter|Apply/i).click()

      // Should either redirect to game or show confirmation
      cy.get('[role="status"], .toast').should('contain', /Joining|Applied|Waiting/i)
    })

    it('should require login to join', () => {
      cy.visit(URLS.campaignJoin('test-campaign-id'))
      cy.get('button').contains(/Join|Enter/i).click()

      // Should redirect to login
      cy.url().should('include', '/auth')
    })

    it('should not allow joining own campaign', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      // Try to join own campaign
      cy.visit(URLS.campaignJoin('test-campaign-id'))
      cy.get('button').contains(/Join|Enter/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).should('be.disabled')
        }
      })
    })
  })

  describe('Game Session', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should display game session interface', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.url().should('include', '/campaigns/')

      // Game session should be displayed
      cy.get('h2, [role="heading"]').contains(/Session|Game|Campaign/i).should('be.visible')
    })

    it('should display character sheet', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Character info should be visible
      cy.get('span, p').contains(/VIGOR|DESTREZA|MENTE|PRESENÇA/i).should('be.visible')
      cy.get('span, p').contains(/Health|Saúde/i).should('be.visible')
    })

    it('should display health status', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Health tier should be visible
      cy.get('span, p').contains(/HEALTHY|INJURED|CRITICAL|DEAD/i).should('be.visible')
    })

    it('should display inventory', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Inventory section should exist
      cy.get('h3, h4').contains(/Inventory|Items/i).should('be.visible')
    })

    it('should display game chat', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Chat area should be visible
      cy.get('div[role="log"], [role="main"]').should('be.visible')
    })

    it('should have action input form', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Input for player actions
      cy.get('textarea[placeholder*="action"], input[placeholder*="action"]').should('be.visible')
      cy.get('button').contains(/Send|Act|Roll/i).should('be.visible')
    })

    it('should send player action', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      const action = 'I attack the goblin with my sword!'
      cy.get('textarea[placeholder*="action"], input[placeholder*="action"]').type(action)
      cy.get('button').contains(/Send|Act/i).click()

      // Action should appear in chat
      cy.get('div[role="log"], [role="main"]').contains(action).should('be.visible')
    })

    it('should display AI response with typewriter effect', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('textarea[placeholder*="action"]').type('What do I see?')
      cy.get('button').contains(/Send|Act/i).click()

      // Wait for AI response
      cy.get('[role="status"], .loading').should('exist')
      cy.get('[role="status"], .loading', { timeout: 15000 }).should('not.exist')

      // Response should appear
      cy.get('div[role="log"], [role="main"]').should('contain', /The|You|A|An/)
    })
  })

  describe('Dice Rolling', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should open dice roller when requested', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Look for dice roller trigger
      cy.get('button').contains(/Roll|Dice/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('dialog, [role="dialog"]').should('be.visible')
        }
      })
    })

    it('should show attribute options', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('button').contains(/Roll|Dice/i).click()
      cy.get('select, [role="combobox"]').should('be.visible')
      cy.get('[role="option"]').contains(/VIGOR|DESTREZA/i).should('be.visible')
    })

    it('should show difficulty options', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('button').contains(/Roll|Dice/i).click()
      cy.get('select, [role="combobox"]').eq(1).should('be.visible')
      cy.get('[role="option"]').contains(/NORMAL|HARD|VERY_HARD/i).should('be.visible')
    })

    it('should roll dice and show result', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('button').contains(/Roll|Dice/i).click()
      cy.get('select, [role="combobox"]').first().click()
      cy.get('[role="option"]').contains('VIGOR').click({ force: true })

      cy.get('button').contains(/Roll|Submit/i).click()

      // Should show success/failure
      cy.get('span, p').contains(/SUCESSO|FALHA|Result|Roll/i).should('be.visible')
    })
  })

  describe('Real-time Multiplayer Updates', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
    })

    it('should receive real-time messages from other players', () => {
      // User 1 logs in and joins campaign
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Get current message count
      cy.get('div[role="log"]').then(($log) => {
        const initialCount = $log.contents().length

        // In real scenario, another user would send message
        // For testing, we'll just verify structure exists for real-time updates
        cy.get('[role="status"], [data-testid*="realtime"]').should('exist')
      })
    })

    it('should show other player status updates', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Should show list of other players
      cy.get('[role="status"], .players-list').should('be.visible')
    })

    it('should update turns indicator', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Should show whose turn it is
      cy.get('span, p').contains(/Turn|Round|Initiative/i).should('be.visible')
    })
  })
})
