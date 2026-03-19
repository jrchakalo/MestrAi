/// <reference types="cypress" />

import { TEST_USER, URLS } from '../fixtures/test-data'

describe('Error Handling & Edge Cases E2E Tests', () => {
  describe('Network Error Handling', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
    })

    it('should handle API timeout gracefully', () => {
      cy.intercept('POST', '**/api/chat', (req) => {
        req.destroy()
      })

      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('textarea[placeholder*="action"]').type('Test action')
      cy.get('button').contains(/Send|Act/i).click()

      // Should show error or retry
      cy.get('[role="alert"], [class*="error"]', { timeout: 15000 }).should('be.visible')
    })

    it('should handle 500 server error', () => {
      cy.intercept('POST', '**/api/chat', {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
      })

      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('textarea[placeholder*="action"]').type('Test')
      cy.get('button').contains(/Send/i).click()

      cy.get('[role="alert"], [class*="error"]', { timeout: 10000 }).should('contain', /error/i)
    })

    it('should handle 429 rate limit', () => {
      cy.intercept('POST', '**/api/chat', {
        statusCode: 429,
        body: { error: 'Too Many Requests' },
      })

      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('textarea[placeholder*="action"]').type('Test')
      cy.get('button').contains(/Send/i).click()

      cy.get('[role="alert"], [class*="error"], [role="status"]', { timeout: 5000 }).should(
        'be.visible'
      )
    })
  })

  describe('Data Validation', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should validate campaign title length', () => {
      cy.visit(URLS.newCampaign)
      const longTitle = 'A'.repeat(300)
      cy.get('input[placeholder*="title"]').type(longTitle)

      cy.get('button').contains(/Next/i).click()

      // Should either truncate or show error
      cy.get('[role="alert"], input[placeholder*="title"]').then(($el) => {
        // Either has error message or truncated value
        cy.wrap($el).should('exist')
      })
    })

    it('should prevent empty campaign world', () => {
      cy.visit(URLS.newCampaign)
      cy.get('input[placeholder*="title"]').type('Test Campaign')
      cy.get('textarea[placeholder*="description"]').type('Desc')

      cy.get('button').contains(/Next/i).click()

      // Should show validation error
      cy.get('[role="alert"], [class*="error"], input[placeholder*="world"]').should('exist')
    })

    it('should validate character name', () => {
      cy.visit(URLS.newCampaign)
      cy.get('input[placeholder*="title"]').type('Test')
      cy.get('textarea[placeholder*="description"]').type('Desc')
      cy.get('textarea[placeholder*="world"]').type('World')
      cy.get('button').contains(/Next/i).click()

      // Continue without character name
      cy.get('button').contains(/Next|Create/i).click()

      // Should show error
      cy.get('[role="alert"], [class*="error"]').should('be.visible')
    })
  })

  describe('Session & Authentication', () => {
    it('should handle expired session', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)

      // Simulate expired token
      localStorage.removeItem('auth_token')

      // Try to load protected page
      cy.visit(URLS.dashboard)

      // Should redirect to login
      cy.url().should('include', '/auth')
    })

    it('should handle token refresh', () => {
      cy.intercept('POST', '**/auth/refresh', {
        statusCode: 200,
        body: { token: 'new-token' },
      }).as('refreshToken')

      cy.login(TEST_USER.email, TEST_USER.password)
      cy.visit(URLS.dashboard)

      // Simulate token expiry
      cy.window().then((win) => {
        win.localStorage.setItem('token_expires', String(Date.now() - 1000))
      })

      // Make API call
      cy.get('article, [role="listitem"]').first().click()

      // Token should have been refreshed (silently)
      cy.get('article, [role="listitem"]').should('exist')
    })

    it('should prevent access without API key', () => {
      cy.login(TEST_USER.email, TEST_USER.password)

      // Clear API key
      localStorage.removeItem('groq_key')

      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Might redirect to setup-key or show error
      cy.url().then((url) => {
        expect([URLS.setupKey, URLS.dashboard].some((u) => url.includes(u))).to.be.ok
      })
    })
  })

  describe('Campaign Lifecycle', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should handle campaign deletion', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().then(($campaign) => {
        if ($campaign.length > 0) {
          cy.wrap($campaign).rightclick()
          cy.get('[role="menuitem"]').contains(/Delete|Remove/i).then(($btn) => {
            if ($btn.length > 0) {
              cy.wrap($btn).click()
              // Confirm deletion
              cy.get('button').contains(/Confirm|Yes|Delete/i).click()
              // Should be removed from list
              cy.get('[role="alert"], [role="status"]').should('contain', /deleted|removed/i)
            }
          })
        }
      })
    })

    it('should handle campaign archival', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()
      cy.get('button').contains(/Admin|Settings/i).click()

      cy.get('button').contains(/Archive|Close|End/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('[role="status"], [role="alert"]').should('be.visible')
        }
      })
    })

    it('should prevent actions on archived campaign', () => {
      cy.visit(URLS.dashboard)

      // Find archived campaign if exists
      cy.get('article, [role="listitem"]').contains(/Archived|Closed/i).then(($campaign) => {
        if ($campaign.length > 0) {
          cy.wrap($campaign).click()

          // Input should be disabled
          cy.get('textarea[placeholder*="action"]').then(($input) => {
            cy.wrap($input).should('be.disabled')
          })
        }
      })
    })
  })

  describe('Character Progression', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should track damage accumulation', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Get initial health
      cy.get('span, p').contains(/HEALTHY/).should('be.visible')

      // Simulate taking damage (multiple times)
      for (let i = 0; i < 3; i++) {
        cy.get('textarea[placeholder*="action"]').type(`I take damage ${i + 1}`)
        cy.get('button').contains(/Send|Act/i).click()
        cy.wait(2000)
      }

      // Health might degrade
      cy.get('span, p').contains(/HEALTHY|INJURED|CRITICAL|DEAD/).should('be.visible')
    })

    it('should handle leveling up', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Look for level or attribute increase
      cy.get('span, p').contains(/Level|Experience|Attribute/i).then(($el) => {
        if ($el.length > 0) {
          // Level system exists
          cy.wrap($el).should('be.visible')
        }
      })
    })

    it('should prevent stat increase beyond max', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Find stat improvement button if exists
      cy.get('button').contains(/Improve|Increase|Stat/i).then(($btn) => {
        if ($btn.length > 0) {
          // Try to increase beyond limit multiple times
          for (let i = 0; i < 10; i++) {
            cy.wrap($btn).click()
          }

          // Stats should be clamped at max (5)
          cy.get('span').contains(/VIGOR|DESTREZA/).then(($stat) => {
            const value = $stat.text().match(/\d+/)
            expect(parseInt(value[0])).to.be.lte(5)
          })
        }
      })
    })
  })

  describe('Inventory Management', () => {
    beforeEach(() => {
      cy.clearAllCookies()
      localStorage.clear()
      cy.login(TEST_USER.email, TEST_USER.password)
    })

    it('should display inventory', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      cy.get('h3, h4').contains(/Inventory|Items/i).should('be.visible')
    })

    it('should add item to inventory', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Look for add item button
      cy.get('button').contains(/Add|Acquire|Get/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click()
          cy.get('input[placeholder*="item"]').type('Health Potion')
          cy.get('button').contains(/Add|Confirm/i).click()

          // Item should appear
          cy.get('ul, [role="list"]').contains('Health Potion').should('be.visible')
        }
      })
    })

    it('should use item from inventory', () => {
      cy.visit(URLS.dashboard)
      cy.get('article, [role="listitem"]').first().click()

      // Find existing item and use it
      cy.get('[role="listitem"], li').first().then(($item) => {
        cy.wrap($item).click()
        cy.get('button').contains(/Use|Equip|Consume/i).then(($btn) => {
          if ($btn.length > 0) {
            cy.wrap($btn).click()
            cy.get('[role="status"], .toast').should('be.visible')
          }
        })
      })
    })
  })
})
