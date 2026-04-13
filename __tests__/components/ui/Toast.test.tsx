import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '@/components/ui/Toast'

describe('Toast', () => {
  it('should render toast message', () => {
    const onClose = jest.fn()
    render(<Toast message="Test message" type="success" onClose={onClose} />)
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('should apply success styling', () => {
    const onClose = jest.fn()
    const { container } = render(
      <Toast message="Success" type="success" onClose={onClose} />
    )
    const toast = container.querySelector('div[class*="border-green"]')
    expect(toast).toBeInTheDocument()
  })

  it('should apply error styling', () => {
    const onClose = jest.fn()
    const { container } = render(
      <Toast message="Error occurred" type="error" onClose={onClose} />
    )
    const toast = container.querySelector('div[class*="border-red"]')
    expect(toast).toBeInTheDocument()
  })

  it('should show success icon for success type', () => {
    const onClose = jest.fn()
    const { container } = render(
      <Toast message="Success" type="success" onClose={onClose} />
    )
    expect(container.textContent).toContain('✓')
  })

  it('should show error icon for error type', () => {
    const onClose = jest.fn()
    const { container } = render(
      <Toast message="Error" type="error" onClose={onClose} />
    )
    expect(container.textContent).toContain('✕')
  })

  it('should auto-dismiss after custom duration', async () => {
    const onClose = jest.fn()
    render(
      <Toast message="Dismiss me" type="success" onClose={onClose} duration={100} />
    )

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    }, { timeout: 200 })
  })

  it('should use default 3000ms duration', async () => {
    const onClose = jest.fn()
    jest.useFakeTimers()
    render(
      <Toast message="Message" type="success" onClose={onClose} />
    )

    expect(onClose).not.toHaveBeenCalled()
    jest.advanceTimersByTime(3000)
    expect(onClose).toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('should handle close button click', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const { container } = render(
      <Toast message="Message" type="success" onClose={onClose} />
    )

    const closeButton = container.querySelector('button')
    expect(closeButton).toBeInTheDocument()
    await user.click(closeButton!)
    expect(onClose).toHaveBeenCalled()
  })

  it('should handle very long messages', () => {
    const onClose = jest.fn()
    const longMessage = 'A'.repeat(200)
    render(<Toast message={longMessage} type="success" onClose={onClose} />)
    expect(screen.getByText(longMessage)).toBeInTheDocument()
  })

  it('should handle special characters in message', () => {
    const onClose = jest.fn()
    const specialMessage = 'Error: "something" went <wrong>'
    render(
      <Toast message={specialMessage} type="error" onClose={onClose} />
    )
    expect(screen.getByText(specialMessage)).toBeInTheDocument()
  })

  it('should clean up timer on unmount', () => {
    const onClose = jest.fn()
    jest.useFakeTimers()
    const { unmount } = render(
      <Toast message="Message" type="success" onClose={onClose} duration={1000} />
    )

    unmount()
    jest.advanceTimersByTime(1000)
    expect(onClose).not.toHaveBeenCalled()
    jest.useRealTimers()
  })
})
