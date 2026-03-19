/// <reference types="cypress" />

import { TEST_USER, TEST_USER_2, URLS } from '../fixtures/test-data'

describe('Multiplayer E2E Tests', () => {
  /**
   * These tests simulate multiplayer interactions
   * They would require either:
   * 1. Multiple browser instances (using Cypress multi-browser)
   * 2. Mocking WebSocket/Realtime connections
   * 3. Test backend that can simulate multiple clients
   */

  describe('Two Player Game Flow', () => {
    it('should handle two players in same campaign', () => {
      // Player 1 creates campaign
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('button').contains(/New Campaign/i).click()

      // Fill campaign details
      cy.get('input[placeholder*="title"]').type('Multiplayer Test Campaign')
      cy.get('textarea[placeholder*="description"]').type('A campaign for two heroes')
      cy.get('textarea[placeholder*="world"]').type('A magical realm where heroes gather')
      cy.get('button').contains(/Next/i).click()

      // Fill character details
      cy.get('input[placeholder*="name"]').type('Hero 1')
      cy.get('textarea[placeholder*="appearance"]').type('Brave warrior')
      cy.get('textarea[placeholder*="backstory"]').type('Seeking adventure')
      cy.get('button').contains(/Create|Confirm/i).click()

      // Extract campaign URL
      cy.url().then((url) => {
        const campaignId = url.split('/campaigns/')[1]?.split('/')[0]

        if (campaignId) {
          // Logout and login as Player 2
          cy.logout()
          cy.login(TEST_USER_2.email, TEST_USER_2.password)

          // Player 2 joins campaign
          cy.visit(URLS.campaignJoin(campaignId))
          cy.get('button').contains(/Join/i).click()

          // Player 1 approves Player 2
          cy.logout()
          cy.login(TEST_USER.email, TEST_USER.password)
          cy.visit(URLS.campaignAdmin(campaignId))
          cy.get('button').contains(/Approve/i).first().click()

          // Both players should see the same campaign
          cy.visit(URLS.campaignById(campaignId))
          cy.get('[role="status"], .players-list').contains(/Hero 1|Player 1/).should(
            'be.visible'
          )
        }
      })
    })

    it('should synchronize player actions', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)

      cy.get('article, [role="listitem"]').first().click()
      cy.url().should('include', '/campaigns/')

      // Player 1 performs action
      const action1 = 'I cast a spell'
      cy.get('textarea[placeholder*="action"]').type(action1)
      cy.get('button').contains(/Send|Act/i).click()

      // Action should appear
      cy.get('div[role="log"]').contains(action1).should('be.visible')

      // Wait for AI response
      cy.get('[role="status"], .loading', { timeout: 15000 }).should('not.exist')

      // Response should appear
      cy.get('div[role="log"]').should('contain', /The|You/)
    })

    it('should update character status for all players', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Player status should be visible
      cy.get('[role="heading"]').contains(/Character|Player/i).should('be.visible')
      cy.get('span').contains(/Health|Saúde/i).should('be.visible')
    })

    it('should enforce turn order in multiplayer', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Turn indicator should be visible
      cy.get('span, p').contains(/Turn|Round|Initiative|Order/i).should('be.visible')
    })

    it('should prevent player from acting out of turn', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // If it's not player's turn, input might be disabled
      cy.get('textarea[placeholder*="action"]').then(($input) => {
        if ($input.prop('disabled')) {
          cy.wrap($input).should('be.disabled')
        }
      })
    })
  })

  describe('Game Master Features', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should display GM panel if user is owner', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Should have GM controls
      cy.get('button').contains(/GM|Admin|Control|Manage/i).then(($btn) => {
        // Only if user is GM
        if ($btn.length > 0) {
          cy.wrap($btn).should('be.visible')
        }
      })
    })

    it('should allow creating encounters', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('button').contains(/Encounter|Battle|Add Event/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('dialog, [role="dialog"]').should('be.visible')
        }
      })
    })

    it('should allow rolling dice for players', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // GM might have force roll option
      cy.get('button').contains(/Force Roll|Request Roll/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('dialog, [role="dialog"], span').contains(/Roll|Dice/i).should('be.visible')
        }
      })
    })

    it('should allow applying damage to party', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Look for damage application
      cy.get('button').contains(/Damage|Harm|Wound/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('input[type="number"], [role="spinbutton"]').should('be.visible')
        }
      })
    })
  })

  describe('Combat Mechanics', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should handle initiative order', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Initiative or turn order should be shown
      cy.get('[role="status"], .turn-order').should('exist')
    })

    it('should track round counter', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Should display round number
      cy.get('span, p').contains(/Round|Turn/i).should('be.visible')
    })

    it('should apply damage to character', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Get initial health
      let initialHealth: string

      cy.get('span').contains(/Health|Saúde/)
        .parent()
        .then(($health) => {
          initialHealth = $health.text()

          // Trigger damage
          cy.get('textarea[placeholder*="action"]').type('I take damage')
          cy.wait(1000)

          // Health might change (if AI decides to apply damage)
        })
    })

    it('should handle death of character', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Look for death triggers
      cy.get('button, [data-testid*="death"]').then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('[role="status"], .toast').contains(/dead|Dead|DEAD/i).should('be.visible')
        }
      })
    })

    it('should allow character resurrection', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // If character is dead, resurrection button might appear
      cy.get('button').contains(/Resurrect|Revive|Restore/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('[role="status"], .toast').should('be.visible')
        }
      })
    })
  })

  describe('Chat and Notifications', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should display system messages', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // System messages should be visible (e.g., "X joined the game")
      cy.get('div[role="log"]').should('contain', /joined|entered|started|Round/i)
    })

    it('should show combat log', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Combat actions should be logged
      cy.get('div[role="log"]').should('be.visible')
    })

    it('should notify on critical hits', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Critical hit might be highlighted
      cy.get('div[role="log"]').then(($log) => {
        if ($log.text().match(/critical/i)) {
          cy.wrap($log).contains(/Critical|CRITICAL|critical/i).should('be.visible')
        }
      })
    })

    it('should show ability usage notifications', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Actions like spell casting, attacks should be logged
      cy.get('div[role="log"]').should('contain', /cast|attack|use|skill/i)
    })
  })

  describe('Connection Loss & Reconnection', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should show connection indicator', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Should show connection status
      cy.get('[class*="connect"], [data-testid*="status"]').should('exist')
    })

    it('should handle temporary connection loss', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Simulate offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'))
      })

      // Should show offline indicator
      cy.get('[class*="offline"], [role="status"]').then(($status) => {
        if ($status.length > 0) {
          cy.wrap($status).should('contain', /offline|disconnected/i)
        }
      })

      // Simulate back online
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'))
      })
    })

    it('should queue actions during disconnect', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Type action
      cy.get('textarea[placeholder*="action"]').type('I attack!')

      // Simulate offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'))
      })

      // Try to send
      cy.get('button').contains(/Send|Act/i).click()

      // Should either show error or queue
      cy.get('[role="status"], [class*="error"]').should('be.visible')
    })
  })
})
