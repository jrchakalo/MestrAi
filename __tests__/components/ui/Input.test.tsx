import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should render with label', () => {
    render(<Input label="Username" />)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('should not render label when not provided', () => {
    const { container } = render(<Input />)
    expect(container.querySelector('label')).not.toBeInTheDocument()
  })

  it('should accept input value', async () => {
    render(<Input />)
    const input = screen.getByRole('textbox')

    await userEvent.type(input, 'test value')
    expect(input).toHaveValue('test value')
  })

  it('should handle placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('should support email input type', () => {
    render(<Input type="email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('should handle disabled state', async () => {
    render(<Input disabled value="test" />)
    const input = screen.getByRole('textbox')

    expect(input).toBeDisabled()
    await userEvent.type(input, 'extra')
    expect(input).toHaveValue('test') // Should not change
  })

  it('should apply focus styles', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('focus:ring-2')
    expect(input).toHaveClass('focus:ring-purple-500')
  })

  it('should accept custom className', () => {
    const { container } = render(<Input className="custom-class" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('custom-class')
  })

  it('should call onChange callback', async () => {
    const handleChange = jest.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'test')

    expect(handleChange).toHaveBeenCalled()
    expect(handleChange).toHaveBeenCalledTimes(4) // Once for each character
  })

  it('should call onFocus and onBlur callbacks', async () => {
    const handleFocus = jest.fn()
    const handleBlur = jest.fn()

    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    const input = screen.getByRole('textbox')

    await userEvent.click(input)
    expect(handleFocus).toHaveBeenCalled()

    await userEvent.tab()
    expect(handleBlur).toHaveBeenCalled()
  })

  it('should support defaultValue', () => {
    render(<Input defaultValue="initial" />)
    expect(screen.getByRole('textbox')).toHaveValue('initial')
  })

  it('should support required attribute', () => {
    render(<Input required />)
    const input = screen.getByRole('textbox')
    expect(input).toBeRequired()
  })

  it('should support pattern attribute', () => {
    render(<Input pattern="[0-9]*" />)
    const input = screen.getByRole('textbox')

    expect(input).toHaveAttribute('pattern', '[0-9]*')
  })

  it('should have proper styling classes', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')

    expect(input).toHaveClass('h-10')
    expect(input).toHaveClass('w-full')
    expect(input).toHaveClass('rounded-md')
    expect(input).toHaveClass('border')
    expect(input).toHaveClass('border-slate-700')
    expect(input).toHaveClass('bg-slate-900')
    expect(input).toHaveClass('text-slate-100')
  })

  it('should maintain label and input relationship', () => {
    const { container } = render(<Input label="Email" type="email" />)
    const label = container.querySelector('label')
    const input = container.querySelector('input')

    expect(label?.textContent).toBe('Email')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('should be a controlled component', () => {
    const TestComponent = () => {
      const [value, setValue] = React.useState('initial')

      return (
        <div>
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
          <div>{value}</div>
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.getByText('initial')).toBeInTheDocument()

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('initial')
  })

  it('should pass through HTML attributes', () => {
    render(<Input data-testid="custom-input" aria-label="Test input" />)
    const input = screen.getByTestId('custom-input')
    expect(input).toHaveAttribute('aria-label', 'Test input')
  })
})
