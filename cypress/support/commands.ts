// Cypress custom commands

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth')
  cy.get('input[type="email"]').first().type(email, { delay: 50 })
  cy.get('input[type="password"]').first().type(password, { delay: 50 })
  cy.get('button[type="submit"]').contains(/Sign in|Login/).click()
  cy.url().should('include', '/dashboard', { timeout: 10000 })
})

Cypress.Commands.add('loginDefaultUser', () => {
  cy.login('teste@example.com', 'TestPassword123!')
})

Cypress.Commands.add('logout', () => {
  cy.get('button').contains(/Logout|Sign out/).click()
  cy.url().should('include', '/')
})

Cypress.Commands.add('waitForLoadingToFinish', () => {
  cy.get('[role="status"], .loading, .spinner').should('not.exist')
})

Cypress.Commands.add('fillForm', (formData: Record<string, string>) => {
  Object.entries(formData).forEach(([label, value]) => {
    cy.get(`input[placeholder*="${label}"], textarea[placeholder*="${label}"]`).type(value)
  })
})

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      loginDefaultUser(): Chainable<void>
      logout(): Chainable<void>
      waitForLoadingToFinish(): Chainable<void>
      fillForm(formData: Record<string, string>): Chainable<void>
    }
  }
}

export {}
