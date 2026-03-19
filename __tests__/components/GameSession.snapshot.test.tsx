import React from 'react'
import { render } from '@testing-library/react'
import { GameSession } from '@/pages/GameSession'
import { Campaign, CampaignStatus, Role, Message } from '@/types'

// Mock dependencies
jest.mock('@/components/ui/ErrorBoundary', () => {
  return {
    ErrorBoundary: ({ children }: any) => <>{children}</>,
  }
})

jest.mock('@/components/DiceRoller', () => {
  return {
    DiceRoller: () => <div data-testid="dice-roller">Dice Roller Mock</div>,
  }
})

jest.mock('@/lib/supabaseClient')
jest.mock('react-markdown', () => {
  return (...args: any[]) => <div>Markdown Content</div>
})
jest.mock('@/hooks/useTypewriter', () => {
  return {
    useTypewriter: (text: string) => text,
  }
})

// Mock test data
const mockCampaign: Campaign = {
  id: 'campaign-1',
  title: 'The Lost Kingdom',
  description: 'An epic adventure in a mystical realm',
  worldDescription: 'A mystical realm with magic and monsters',
  worldHistory: 'Ancient history spanning millennia',
  genero: 'Fantasy',
  tom: 'Epic',
  magia: 'High',
  tech: 'Medieval',
  visualStyle: 'Dark and Mystical',
  characterName: 'Aragorn the Ranger',
  characterProfession: 'Ranger',
  ownerName: 'GameMaster',
  status: CampaignStatus.ACTIVE,
  systemSetting: 'D20',
}

const mockMessages: Message[] = [
  {
    role: Role.SYSTEM,
    content: 'Welcome to the game!',
  },
  {
    role: Role.USER,
    content: 'I prepare my bow',
  },
  {
    role: Role.MODEL,
    content: 'The forest opens before you. Trees tower above as sunlight filters through the leaves.',
  },
]

describe('GameSession Component Snapshots', () => {
  const mockProps = {
    campaign: mockCampaign,
    apiKey: 'test-api-key-123',
    onExit: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should match snapshot with basic campaign props', () => {
    const { container } = render(
      <GameSession
        campaign={mockProps.campaign}
        apiKey={mockProps.apiKey}
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with accepted player status', () => {
    const { container } = render(
      <GameSession
        campaign={mockProps.campaign}
        apiKey={mockProps.apiKey}
        playerStatus="accepted"
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with pending player status', () => {
    const { container } = render(
      <GameSession
        campaign={mockProps.campaign}
        apiKey={mockProps.apiKey}
        playerStatus="pending"
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with paused campaign', () => {
    const pausedCampaign = {
      ...mockCampaign,
      status: CampaignStatus.PAUSED,
    }

    const { container } = render(
      <GameSession
        campaign={pausedCampaign}
        apiKey={mockProps.apiKey}
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with waiting campaign', () => {
    const waitingCampaign = {
      ...mockCampaign,
      status: CampaignStatus.WAITING_FOR_PLAYERS,
    }

    const { container } = render(
      <GameSession
        campaign={waitingCampaign}
        apiKey={mockProps.apiKey}
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match snapshot with cyberpunk campaign setting', () => {
    const cyberpunkCampaign = {
      ...mockCampaign,
      genero: 'Cyberpunk',
      tom: 'Dark',
      magia: 'Low',
      tech: 'Modern',
      visualStyle: 'Neon and Shadows',
    }

    const { container } = render(
      <GameSession
        campaign={cyberpunkCampaign}
        apiKey={mockProps.apiKey}
        onExit={mockProps.onExit}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
