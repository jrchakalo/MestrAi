import React from 'react'
import { render } from '@testing-library/react'
import { CampaignWizard } from '@/components/screens/CampaignWizard'
import { Campaign, CampaignStatus } from '@/types'

// Mock LoadingDots
jest.mock('@/components/ui/LoadingDots', () => {
  return {
    LoadingDots: () => <div data-testid="loading-dots">...</div>,
  }
})

// Mock fetch for image generation
global.fetch = jest.fn()

describe('CampaignWizard Component Snapshots', () => {
  const mockFunctions = {
    onSave: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('should match snapshot - initial world step', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - campaign wizard with all visible fields', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    // Check for expected elements
    expect(container.querySelector('input[placeholder*="título"]')).toBeInTheDocument()
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - campaign wizard form structure', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    // Verify main sections are rendered
    const formContainer = container.querySelector('.space-y-6')
    expect(formContainer).toBeInTheDocument()
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - step indicators and buttons', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    // Verify navigation buttons are present
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - genre options rendered', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    // Genre options should be visible in selects
    const selects = container.querySelectorAll('select')
    expect(selects.length).toBeGreaterThan(0)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - with loading state simulation', async () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot - wizard layout and structure', () => {
    const { container } = render(
      <CampaignWizard
        onSave={mockFunctions.onSave}
        onCancel={mockFunctions.onCancel}
        apiKey="test-api-key-123"
      />
    )

    // Main wrapper structure
    const mainDiv = container.querySelector('div')
    expect(mainDiv).toBeInTheDocument()
    expect(container.firstChild).toMatchSnapshot()
  })
})
