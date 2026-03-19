import './commands'

// Disable uncaught exception handling for specific errors
Cypress.on('uncaught:exception', (err) => {
  // Return false to prevent Cypress from failing the test
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection') ||
    err.message.includes('Network error')
  ) {
    return false
  }
})

beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear()
  sessionStorage.clear()
})
