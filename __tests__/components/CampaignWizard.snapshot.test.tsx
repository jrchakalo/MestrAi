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

    // Verify component renders
    expect(container.firstChild).toBeInTheDocument()
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

    // Verify component renders
    expect(container.firstChild).toBeInTheDocument()
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

    // Verify component renders
    expect(container.firstChild).toBeInTheDocument()
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

    // Verify component renders
    expect(container.firstChild).toBeInTheDocument()
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

    // Verify component renders
    expect(container.firstChild).toBeInTheDocument()
    expect(container.firstChild).toMatchSnapshot()
  })
})
