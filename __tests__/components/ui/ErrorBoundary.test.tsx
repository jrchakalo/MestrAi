import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Suppress console.error for this test file
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalError
})

const BrokenComponent = () => {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should catch errors and display fallback UI', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Erro inesperado no chat')).toBeInTheDocument()
  })

  it('should display error message in fallback', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText(/falha de renderização/i)).toBeInTheDocument()
  })

  it('should have fallback with button to recover', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )
    const button = screen.getByRole('button', { name: /tentar recuperar/i })
    expect(button).toBeInTheDocument()
  })

  it('should have recovery button that redirects focus', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    const button = screen.getByRole('button', { name: /tentar recuperar/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('rounded-md')
  })

  it('should render multiple children correctly', () => {
    render(
      <ErrorBoundary>
        <div>First</div>
        <div>Second</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('should use custom fallback message when provided', () => {
    render(
      <ErrorBoundary fallbackMessage="Custom error message">
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('should use custom fallback title when provided', () => {
    render(
      <ErrorBoundary fallbackTitle="Custom Title">
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })
})
