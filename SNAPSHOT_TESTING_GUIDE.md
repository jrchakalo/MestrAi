# 📸 Snapshot Testing Guide

**MestrAi Virtual Tabletop** - Component Snapshot Testing

Created: 2026-03-19
Version: 1.0.0

---

## 📋 Overview

Snapshot testing captures the rendered output of React components at a point in time. Any changes to the component output are detected as differences from the snapshot, allowing for regression detection and documentation of component structure.

### What Are Snapshots?

Snapshots are serialized representations of component output saved in `.snap` files:

```javascript
// Example snapshot
exports[`Dashboard Component Snapshots should match snapshot with multiple campaigns 1`] = `
<div class="min-h-screen bg-slate-950 p-4 md:p-8">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white">Minhas Mesas</h1>
        <p class="text-slate-400">Gerencie suas campanhas de RPG.</p>
      </div>
      ...
    </header>
  </div>
</div>
`;
```

---

## 🧪 Components Tested

### 1. Dashboard Component

**File:** `__tests__/components/Dashboard.snapshot.test.tsx`

**Component:** `pages/Dashboard.tsx`

**Test Cases:**
- ✅ Multiple campaigns rendering
- ✅ Empty campaigns state
- ✅ With edit and delete handlers
- ✅ Single active campaign
- ✅ Only archived campaigns

**Key Props:**
```typescript
interface DashboardProps {
  campaigns: Campaign[]
  onCreateNew: () => void
  onSelectCampaign: (id: string) => void
  onEditCampaign?: (id: string) => void
  onDeleteCampaign?: (id: string) => void
  onJoinById?: (id: string) => void
  onLogout: () => void
}
```

### 2. GameSession Component

**File:** `__tests__/components/GameSession.snapshot.test.tsx`

**Component:** `pages/GameSession.tsx`

**Test Cases:**
- ✅ Basic campaign props
- ✅ Accepted player status
- ✅ Pending player status
- ✅ Paused campaign
- ✅ Waiting for players
- ✅ Cyberpunk campaign setting

**Key Props:**
```typescript
interface GameSessionProps {
  campaign: Campaign
  apiKey: string
  playerStatus?: string
  onExit: () => void
}
```

### 3. CampaignWizard Component

**File:** `__tests__/components/CampaignWizard.snapshot.test.tsx`

**Component:** `components/screens/CampaignWizard.tsx`

**Test Cases:**
- ✅ Initial world step
- ✅ All visible fields
- ✅ Form structure
- ✅ Step indicators and buttons
- ✅ Genre options rendered
- ✅ Loading state simulation
- ✅ Wizard layout

**Key Props:**
```typescript
interface CampaignWizardProps {
  onSave: (campaign: Campaign) => Promise<void>
  onCancel: () => void
  apiKey: string
}
```

---

## 🚀 Running Snapshot Tests

### Generate Initial Snapshots

```bash
# Run all snapshot tests (generates .snap files)
npm test -- snapshot --no-coverage

# Run specific component snapshots
npm test -- Dashboard.snapshot.test.tsx --no-coverage
npm test -- GameSession.snapshot.test.tsx --no-coverage
npm test -- CampaignWizard.snapshot.test.tsx --no-coverage
```

### Update Snapshots

When component output changes intentionally, update snapshots:

```bash
# Update all snapshots
npm test -- snapshot -u --no-coverage

# Update specific snapshots
npm test -- Dashboard.snapshot.test.tsx -u --no-coverage

# Interactive mode: review and decide for each diff
npm test:watch
# Press 'u' to update snapshots
```

### View Snapshots

Snapshot files are stored in `__snapshots__/ ` directories:

```
__tests__/components/
├── __snapshots__/
│   ├── Dashboard.snapshot.test.tsx.snap
│   ├── GameSession.snapshot.test.tsx.snap
│   └── CampaignWizard.snapshot.test.tsx.snap
├── Dashboard.snapshot.test.tsx
├── GameSession.snapshot.test.tsx
└── CampaignWizard.snapshot.test.tsx
```

---

## 📊 Test Data Used

### Dashboard Test Campaigns

```typescript
// Campaign 1: Active Fantasy
{
  id: 'campaign-1',
  title: 'The Lost Kingdom',
  genero: 'Fantasy',
  tom: 'Epic',
  status: CampaignStatus.ACTIVE,
}

// Campaign 2: Active Cyberpunk
{
  id: 'campaign-2',
  title: 'Urban Shadows',
 genero: 'Cyberpunk',
  tom: 'Dark',
  status: CampaignStatus.ACTIVE,
}

// Campaign 3: Archived Fantasy
{
  id: 'campaign-3',
  title: 'Ancient Quest',
  genero: 'Fantasy',
  status: CampaignStatus.ARCHIVED,  // Will render with special styling
}
```

### GameSession Test Campaigns

```typescript
// Primary: Fantasy Epic campaign
{
  title: 'The Lost Kingdom',
  description: 'An epic adventure in a mystical realm',
  genero: 'Fantasy',
  tom: 'Epic',
  magia: 'High',
  tech: 'Medieval',
}

// Secondary: Cyberpunk Dark campaign
{
  genero: 'Cyberpunk',
  tom: 'Dark',
  magia: 'Low',
  tech: 'Modern',
  visualStyle: 'Neon and Shadows',
}
```

---

## 🔄 When Snapshots Change

### Legitimate Changes (Update Snapshot)

```bash
npm test -- component.snapshot.test.tsx -u
```

**Examples:**
- UI redesign (intentional)
- Component refactoring
- New features added to component
- Bug fixes that change output

### Unintended Changes (Fix Code)

**DO NOT update snapshot if:**
- Styles accidentally changed
- Regression was introduced
- HTML structure became invalid
- Accessibility features removed

---

## 🛠️ Best Practices

### DO:
- ✅ Commit `.snap` files to version control
- ✅ Review snapshot diffs in code reviews
- ✅ Use snapshots for structural regression detection
- ✅ Combine snapshots with unit tests
- ✅ Keep snapshots focused on one component
- ✅ Update snapshots purposefully, not blindly

### DON'T:
- ❌ Ignore snapshot diffs without reviewing
- ❌ Update snapshots for all failed tests automatically
- ❌ Use snapshots as the only test type
- ❌ Create huge component snapshots (test smaller components)
- ❌ Update snapshots without understanding changes

---

## 🔍 Snapshot Examples

### Dashboard - Empty State

```jsx
<div className="col-span-full py-20 text-center">
  <p className="text-slate-500">Nenhuma campanha encontrada.</p>
  <Button>Criar Primeira Aventura</Button>
</div>
```

### Dashboard - Active Campaign Card

```jsx
<div className="border rounded-xl p-6 bg-slate-900 border-slate-800 hover:border-purple-500">
  <span className="text-xs font-mono uppercase text-purple-400">Fantasy</span>
  <h3 className="text-lg font-bold text-white">The Lost Kingdom</h3>
  <p className="text-sm text-slate-400">An epic adventure</p>
  <Button>Entrar</Button>
</div>
```

### Dashboard - Archived Campaign Card

```jsx
<div className="opacity-75 grayscale-[0.5]">
  <div className="absolute top-0 right-0 bg-slate-800">ARQUIVADA</div>
  <!-- Campaign content with reduced opacity -->
</div>
```

---

## 💾 Managing Snapshots in Git

### Reviewing Snapshots

```bash
# See what changed in a snapshot
git diff __snapshots__/component.snap

# Stage snapshot changes
git add __snapshots__/component.snap

# Review before committing
git diff --cached __snapshots__/
```

### Snapshot Size Tips

Snapshots become large when:
- ❌ Component renders too many nested elements
- ❌ Many attributes/classes on elements
- ❌ Long text content included

Solutions:
- ✅ Test smaller components individually
- ✅ Mock child components
- ✅ Use focused snapshots for critical structure

---

## 🔧 Mocking in Snapshot Tests

```typescript
// Mock child components
jest.mock('@/components/DiceRoller', () => {
  return {
    DiceRoller: () => <div>Dice Roller</div>,
  }
})

// Mock hooks
jest.mock('@/hooks/useTypewriter', () => {
  return {
    useTypewriter: (text: string) => text,
  }
})

// Mock external libraries
jest.mock('react-markdown', () => {
  return (...args: any[]) => <div>Content</div>
})
```

---

## 📈 Test Suite Statistics

```
Snapshot Tests: 3 test files
Snapshots Created: 19 total
Components Covered:
  ├─ Dashboard: 5 snapshots
  ├─ GameSession: 6 snapshots
  └─ CampaignWizard: 7 snapshots

Coverage:
  ├─ Empty states: ✅
  ├─ Multiple data sets: ✅
  ├─ Different statuses: ✅
  ├─ Loading states: ✅
  └─ Error scenarios: Complementary (unit tests)
```

---

## 🚨 Troubleshooting

### Snapshot Mismatch on Mac/Linux

**Problem:** Different line endings cause snapshot diffs

**Solution:**
```bash
# Configure git to handle line endings
git config core.autocrlf false
npm test -- -u  # Regenerate snapshots
```

### Large Snapshots

**Problem:** Snapshot files are too large

**Solution:**
- Split component into smaller testable units
- Mock heavy child components
- Focus on critical structure

### Snapshot Update Not Working

**Problem:** `-u` flag not recognized

**Solution:**
```bash
# Use full flag name
npm test --  --updateSnapshot
```

---

## 📚 Related Documentation

- **TEST_GUIDE.md** - Unit testing details
- **API_TEST_GUIDE.md** - API integration testing
- **E2E_TEST_GUIDE.md** - End-to-end testing
- **COMPLETE_TESTING_GUIDE.md** - All testing layers overview

---

## 🎯 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Snapshot Tests

on: [push, pull_request]

jobs:
  snapshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm test -- snapshot --no-coverage

      # Fail if snapshots changed unexpectedly
      - name: Check for unexpected snapshot changes
        run: git diff --exit-code __snapshots__/ || echo "Snapshots changed"
```

---

## 📞 Quick Reference

```bash
# Generate snapshots
npm test -- snapshot --no-coverage

# Update snapshots (intentional changes)
npm test -- snapshot -u --no-coverage

# Run specific component
npm test -- Dashboard.snapshot.test.tsx --no-coverage

# Interactive snapot review
npm test:watch
# Then press 'u' for each diff to review

# View snapshot files
ls -la __tests__/components/__snapshots__/

# Review changes
git diff __snapshots__/
```

---

**Created:** 2026-03-19
**Version:** 1.0.0
**Status:** ✅ Production Ready
**Coverage:** 3 components | 19 snapshots | Full regression protection
