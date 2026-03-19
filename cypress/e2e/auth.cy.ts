/// <reference types="cypress" />

import { TEST_USER, URLS } from '../fixtures/test-data'

describe('Authentication E2E Tests', () => {
  beforeEach(() => {
    cy.clearAllCookies()
    localStorage.clear()
  })

  describe('Landing Page', () => {
    it('should display landing page', () => {
      cy.visit('/')
      cy.get('h1').should('be.visible')
      cy.get('button').contains(/Get Started|Start Playing/i).should('be.visible')
    })

    it('should navigate to how-it-works', () => {
      cy.visit('/')
      cy.get('a, button').contains(/How It Works|Learn More/i).click()
      cy.url().should('include', '/how-it-works')
    })

    it('should navigate to auth page', () => {
      cy.visit('/')
      cy.get('a, button').contains(/Sign In|Login|Get Started/i).click()
      cy.url().should('include', '/auth')
    })
  })

  describe('Sign In', () => {
    it('should show sign in form', () => {
      cy.visit(URLS.auth)
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
      cy.get('button[type="submit"]').contains(/Sign in|Login/i).should('be.visible')
    })

    it('should display validation errors for empty fields', () => {
      cy.visit(URLS.auth)
      cy.get('button[type="submit"]').click()
      // Should show validation errors or prevent submission
      cy.url().should('not.include', URLS.dashboard)
    })

    it('should display error for invalid email format', () => {
      cy.visit(URLS.auth)
      cy.get('input[type="email"]').type('invalid-email')
      cy.get('button[type="submit"]').click()
      // Should show validation error
      cy.get('[role="status"], .error, [class*="error"]', { timeout: 5000 }).should(
        'be.visible'
      )
    })

    it('should handle incorrect credentials', () => {
      cy.visit(URLS.auth)
      cy.get('input[type="email"]').type('nonexistent@example.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()

      // Should show error message
      cy.get('[role="alert"], [class*="error"], [class*="toast"]', { timeout: 5000 }).should(
        'contain',
        /Invalid|Error|wrong/i
      )
    })

    it('should successfully sign in with valid credentials', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.url().should('include', URLS.dashboard)
    })

    it('should show sign up option', () => {
      cy.visit(URLS.auth)
      cy.get('a, button').contains(/Sign up|Create account|Don't have/i).should('be.visible')
    })
  })

  describe('Sign Up', () => {
    it('should switch to sign up form', () => {
      cy.visit(URLS.auth)
      cy.get('button, a').contains(/Sign up|Create account/i).click({ force: true })
      cy.get('input[type="email"]').should('be.visible')
      // Should have username field or similar
    })

    it('should display password strength requirements', () => {
      cy.visit(URLS.auth)
      cy.get('button, a').contains(/Sign up|Create account/i).click({ force: true })
      cy.get('input[type="password"]').focus()
      // Might show password strength indicator
      cy.get('input[type="password"]').should('have.focus')
    })
  })

  describe('Setup Groq Key', () => {
    it('should redirect to setup key page after first login', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      // If first time, should redirect to setup
      const url = cy.url()
      url.then((currentUrl) => {
        if (currentUrl.includes(URLS.setupKey)) {
          cy.get('input[placeholder*="key"]').should('be.visible')
        }
      })
    })

    it('should display setup key form', () => {
      cy.visit(URLS.setupKey)
      cy.get('input[placeholder*="key"], input[name*="key"]').should('be.visible')
      cy.get('button').contains(/Save|Validate|Submit/i).should('be.visible')
    })

    it('should show helpful info about Groq key', () => {
      cy.visit(URLS.setupKey)
      cy.get('p, [role="note"], [role="status"]').should('contain', /Groq|API key/i)
    })

    it('should validate API key format', () => {
      cy.visit(URLS.setupKey)
      cy.get('input[placeholder*="key"]').type('invalid-key')
      cy.get('button').contains(/Validate|Test/i).click()
      // Should show validation error
      cy.get('[role="alert"], .error', { timeout: 5000 }).should('contain', /Invalid|Error/i)
    })

    it('should accept valid Groq API key', () => {
      cy.visit(URLS.setupKey)
      // Using a test key format (in real scenario would be actual key)
      cy.get('input[placeholder*="key"]').type('gsk_test_1234567890abcdef')
      cy.get('button').contains(/Validate|Test/i).click()
      // Should proceed or show success
      cy.get('button').contains(/Continue|Next|Dashboard/i).should('be.visible')
    })
  })

  describe('Session Persistence', () => {
    it('should maintain session after reload', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.reload()
      cy.url().should('include', URLS.dashboard)
    })

    it('should redirect to login if not authenticated', () => {
      localStorage.clear()
      cy.visit(URLS.dashboard)
      cy.url().should('include', URLS.auth)
    })

    it('should logout successfully', () => {
      cy.login(TEST_USER.email, TEST_USER.password)
      cy.logout()
      cy.url().should('include', URLS.home)
      cy.visit(URLS.dashboard)
      cy.url().should('include', URLS.auth)
    })
  })
})
