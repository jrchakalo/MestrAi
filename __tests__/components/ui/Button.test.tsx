import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should render button element', () => {
    render(<Button>Test</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should apply primary variant by default', () => {
    const { container } = render(<Button>Primary</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-purple-600')
  })

  it('should apply secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-slate-800')
  })

  it('should apply ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('hover:bg-slate-800')
  })

  it('should apply destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-red-600')
  })

  it('should apply outline variant', () => {
    const { container } = render(<Button variant="outline">Outline</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('border-slate-600')
  })

  it('should apply small size', () => {
    const { container } = render(<Button size="sm">Small</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('h-8')
    expect(button).toHaveClass('px-3')
  })

  it('should apply medium size by default', () => {
    const { container } = render(<Button>Medium</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('h-10')
    expect(button).toHaveClass('px-4')
  })

  it('should apply large size', () => {
    const { container } = render(<Button size="lg">Large</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('h-12')
    expect(button).toHaveClass('px-8')
  })

  it('should be clickable', async () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should handle disabled state', async () => {
    const handleClick = jest.fn()
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should show loading indicator when isLoading is true', () => {
    render(<Button isLoading>Save</Button>)
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('should be disabled when isLoading is true', () => {
    render(<Button isLoading>Save</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should not respond to clicks when loading', async () => {
    const handleClick = jest.fn()
    render(
      <Button isLoading onClick={handleClick}>
        Save
      </Button>
    )

    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should accept custom className', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('custom-class')
  })

  it('should pass through HTML attributes', () => {
    render(
      <Button data-testid="custom-button" aria-label="Test button">
        Test
      </Button>
    )

    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('aria-label', 'Test button')
  })

  it('should have focus styles', () => {
    const { container } = render(<Button>Focusable</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('focus-visible:ring-2')
    expect(button).toHaveClass('focus-visible:ring-purple-500')
  })

  it('should support all HTML button attributes', () => {
    render(
      <Button type="submit" name="action" value="submit" data-testid="submit-btn">
        Submit
      </Button>
    )

    const button = screen.getByTestId('submit-btn') as HTMLButtonElement
    expect(button.type).toBe('submit')
    expect(button.name).toBe('action')
  })
})
