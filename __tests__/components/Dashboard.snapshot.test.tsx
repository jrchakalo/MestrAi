import React from 'react'
import { render } from '@testing-library/react'
import { Dashboard } from '@/pages/Dashboard'
import { Campaign, CampaignStatus } from '@/types'

// Mock test data
const mockCampaigns: Campaign[] = [
  {
    id: 'campaign-1',
    title: 'The Lost Kingdom',
    description: 'An epic adventure',
    worldDescription: 'A mystical realm',
    worldHistory: 'Ancient history',
    genero: 'Fantasy',
    tom: 'Epic',
    magia: 'High',
    tech: 'Medieval',
    visualStyle: 'Dark and Mystical',
    characterName: 'Aragorn',
    characterProfession: 'Ranger',
    ownerName: 'GameMaster',
    status: CampaignStatus.ACTIVE,
    systemSetting: 'D20',
  } as Campaign,
  {
    id: 'campaign-2',
    title: 'Urban Shadows',
    description: 'A noir mystery',
    worldDescription: 'Modern city',
    worldHistory: 'Contemporary',
    genero: 'Cyberpunk',
    tom: 'Dark',
    magia: 'Low',
    tech: 'Modern',
    visualStyle: 'Neon and Shadows',
    characterName: 'Detective Smith',
    characterProfession: 'Investigator',
    ownerName: 'MysteryMaster',
    status: CampaignStatus.ACTIVE,
    systemSetting: 'D20',
  } as Campaign,
  {
    id: 'campaign-3',
    title: 'Ancient Quest',
    description: 'A completed adventure',
    worldDescription: 'Ancient lands',
    worldHistory: 'Lost civilizations',
    genero: 'Fantasy',
    tom: 'Adventure',
    magia: 'Medium',
    tech: 'Medieval',
    visualStyle: 'Exotic',
    characterName: 'Wizard',
    characterProfession: 'Mage',
    ownerName: 'OldMaster',
    status: CampaignStatus.ARCHIVED,
    systemSetting: 'D20',
  } as Campaign,
]

describe('Dashboard Component Snapshots', () => {
  const mockFunctions = {
    onCreateNew: jest.fn(),
    onSelectCampaign: jest.fn(),
    onLogout: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should match snapshot with multiple campaigns', () => {
    const { container } = render(
      <Dashboard
        campaigns={mockCampaigns}
        onCreateNew={mockFunctions.onCreateNew}
        onSelectCampaign={mockFunctions.onSelectCampaign}
        onLogout={mockFunctions.onLogout}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with empty campaigns', () => {
    const { container } = render(
      <Dashboard
        campaigns={[]}
        onCreateNew={mockFunctions.onCreateNew}
        onSelectCampaign={mockFunctions.onSelectCampaign}
        onLogout={mockFunctions.onLogout}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with edit and delete handlers', () => {
    const { container } = render(
      <Dashboard
        campaigns={mockCampaigns.slice(0, 2)}
        onCreateNew={mockFunctions.onCreateNew}
        onSelectCampaign={mockFunctions.onSelectCampaign}
        onEditCampaign={jest.fn()}
        onDeleteCampaign={jest.fn()}
        onJoinById={jest.fn()}
        onLogout={mockFunctions.onLogout}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with single active campaign', () => {
    const { container } = render(
      <Dashboard
        campaigns={[mockCampaigns[0]]}
        onCreateNew={mockFunctions.onCreateNew}
        onSelectCampaign={mockFunctions.onSelectCampaign}
        onLogout={mockFunctions.onLogout}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with only archived campaigns', () => {
    const { container } = render(
      <Dashboard
        campaigns={[mockCampaigns[2]]}
        onCreateNew={mockFunctions.onCreateNew}
        onSelectCampaign={mockFunctions.onSelectCampaign}
        onLogout={mockFunctions.onLogout}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
