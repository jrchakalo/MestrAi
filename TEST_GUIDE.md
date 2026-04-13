# 🧪 Guia Completo de Testes - MestrAi

**Virtual Tabletop com IA** - Stack de Testes Profissional

Última atualização: 2026-03-20
Status: ✅ Production Ready
Total de Testes: **200+**

---

## 📊 Visão Geral

### Estrutura de Testes

```
Unit Tests (Jest)                      112
├─ Game Rules                    45 testes
├─ Inventory Rules              36 testes
├─ AI Models & Fallback         18 testes
└─ Rate Limiting                13 testes

Snapshot Tests (Jest + React)     18
├─ Dashboard Component            5
├─ Campaign Wizard Component      7
└─ Other UI Components            6

API Integration Tests (Jest)      81+
├─ /api/chat                     17
├─ /api/validate-key            14
├─ /api/image                   20
└─ /api/character-infer         30
```

### Estatísticas Resumidas

```
╔════════════════════════════════════════════════════════╗
║        FRAMEWORK DE TESTES - MESTRAI                  ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Unit Tests (Jest)                           112      ║
║  Snapshot Tests (Jest + React)               18       ║
║  API Integration Tests (Jest + Mocks)        81+      ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║  TOTAL:        200+ TESTES                            ║
║  COBERTURA:    ~93% (Unit), 100% (APIs)              ║
║  TEMPO:        ~3s (Unit) + ~2s (API)                ║
║  STATUS:       ✅ PRODUCTION READY                    ║
╚════════════════════════════════════════════════════════╝
```

---

## 🚀 Quick Start

### 1. Instalação

```bash
# Instalar dependências
npm install

# Verificar que tudo está instalado
npm test -- --version
```

### 2. Executar Testes

```bash
# Unit tests (rápido - ~3s)
npm test

# API tests (médio - ~2s)
npm run test:api

# Todos os testes com coverage
npm run test:coverage

# Watch mode para desenvolvimento
npm run test:watch
```

### 3. Estrutura de Pastas

```
MestrAi/
├── __tests__/
│   ├── lib/                          # Unit tests
│   │   ├── gameRules.test.ts         (45 testes)
│   │   ├── inventoryRules.test.ts    (36 testes)
│   │   └── ai/
│   │       ├── modelPool.test.ts     (18 testes)
│   │       └── rateLimit.test.ts     (13 testes)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.test.tsx       (testes)
│   │   │   └── Input.test.tsx        (testes)
│   │   ├── Dashboard.snapshot.test.tsx
│   │   └── CampaignWizard.snapshot.test.tsx
│   └── api/
│       ├── chat.test.ts              (17 testes)
│       ├── validate-key.test.ts      (14 testes)
│       ├── image.test.ts             (20 testes)
│       └── character-infer.test.ts   (30 testes)
│
├── jest.config.js                    # Jest config (Unit + Snapshot)
└── jest.api.config.js                # Jest config (API tests)
```

---

## 📍 PARTE 1: UNIT TESTS (112 Testes)

### 1.1 Game Rules Tests (45 testes)

**Arquivo**: `__tests__/lib/gameRules.test.ts`

Testes para a lógica fundamental do sistema:
- Sistema de D20 e rolagem de dados
- Atributos e sanitização
- Saúde e dano
- Estados críticos

### 1.2 Inventory Rules Tests (36 testes)

**Arquivo**: `__tests__/lib/inventoryRules.test.ts`

Testes para gerenciamento de inventário:
- Adição e remoção de itens
- Limite de capacidade
- Tipos de itens
- Validação de estados

### 1.3 AI Models & Fallback (18 testes)

**Arquivo**: `__tests__/lib/ai/modelPool.test.ts`

Testes para seleção e fallback de modelos:
- Estratégia de pool de modelos
- Fallback automático
- Validação de respostas

### 1.4 Rate Limiting (13 testes)

**Arquivo**: `__tests__/lib/ai/rateLimit.test.ts`

Testes para limitação de taxa:
- Contador de requisições
- Reset por período
- Bloqueo quando excedido

### 1.5 UI Component Tests

**Arquivos**:
- `__tests__/components/ui/Button.test.tsx`
- `__tests__/components/ui/Input.test.tsx`

Testes para componentes básicos de UI:
- Renderização correta
- Propriedades e eventos
- Estados (hover, disabled, etc)

---

## 🖼️ PARTE 2: SNAPSHOT TESTS (18 Testes)

### 2.1 Dashboard Snapshot Test

**Arquivo**: `__tests__/components/Dashboard.snapshot.test.tsx`

Testa estados visuais do Dashboard:
- Com múltiplas campanhas
- Vazio (sem campanhas)
- Estados de carregamento

### 2.2 Campaign Wizard Snapshot Test

**Arquivo**: `__tests__/components/CampaignWizard.snapshot.test.tsx`

Testa todos os steps do wizard:
- Step 1: Básico
- Step 2: Configurações
- Step 3: Review

---

## 🔌 PARTE 3: API INTEGRATION TESTS (81+ Testes)

### 3.1 Chat API Tests (17 testes)

**Arquivo**: `__tests__/api/chat.test.ts`

Testa endpoint `/api/chat`:
- Requisição com prompt válido
- Tratamento de erros
- Timeout handling
- Validação de resposta

### 3.2 Validate Key Tests (14 testes)

**Arquivo**: `__tests__/api/validate-key.test.ts`

Testa endpoint `/api/validate-key`:
- Validação de chaves Groq
- Tratamento de chaves inválidas
- Rate limiting

### 3.3 Image Generation Tests (20 testes)

**Arquivo**: `__tests__/api/image.test.ts`

Testa endpoint `/api/image`:
- Geração de imagens válidas
- Tratamento de descrições vazias
- Fallback para imagens placeholders
- Erros de API

### 3.4 Character Inference Tests (30 testes)

**Arquivo**: `__tests__/api/character-infer.test.ts`

Testa endpoint `/api/character-infer`:
- Inferência de atributos
- Validação de dados entrada
- Geração de personagem completo
- Tratamento de erros de modelo

---

## 📋 Coverage Goals

### Unit Tests
- ✅ Game Rules: ~95% coverage
- ✅ Inventory: ~90% coverage
- ✅ AI/Rate Limiting: ~85% coverage
- ✅ UI Components: ~80% coverage

### API Tests
- ✅ Request validation
- ✅ Response formatting
- ✅ Error handling
- ✅ External API integration (mocked)

### Snapshot Tests
- ✅ UI regressions detection
- ✅ Component state variations
- ✅ Critical user flows

---

## 🔍 Executar Testes Específicos

```bash
# Um teste específico
npm test -- gameRules.test.ts

# Todos os testes de um diretório
npm test -- api/

# Com padrão no nome
npm test -- --testNamePattern="should clamp"

# Apenas testes com snapshot
npm test -- --testPathPattern="snapshot"

# API tests específicos
npm run test:api -- validate-key.test.ts
```

---

## 📊 Analisar Coverage

```bash
# Gerar relatório de coverage
npm run test:coverage

# Abrir relatório HTML
open coverage/lcov-report/index.html
```

---

## ✅ Checklist de Testes

Antes de fazer deploy:

- [ ] `npm test` passa com sucesso
- [ ] `npm run test:api` passa com sucesso
- [ ] Coverage acima de 80%
- [ ] Sem warnings ou erros de tipo
- [ ] Snapshots atualizadas se houver mudanças visuais

---

## 🛠️ Adicionando Novos Testes

### Padrão para Unit Tests

```typescript
describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = { /* dados */ }

    // Act
    const result = functionToTest(input)

    // Assert
    expect(result).toBe(expectedValue)
  })
})
```

### Padrão para API Tests

```typescript
describe('POST /api/endpoint', () => {
  it('should handle valid request', async () => {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(validData)
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject(expectedStructure)
  })
})
```

### Padrão para Snapshot Tests

```typescript
describe('Component Name', () => {
  it('should match snapshot with default props', () => {
    const { container } = render(<Component />)
    expect(container).toMatchSnapshot()
  })
})
```

---

## 📝 Notas Importantes

1. **Testes são executados antes de commit** - Configure git hooks para rodar testes automaticamente
2. **Snapshots devem ser revisados** - Sempre revise mudanças em snapshots antes de commitar
3. **Mocks devem estar sincronizados** - APIs mockadas devem refletir a realidade do backend
4. **Coverage importante** - Procure manter acima de 80% em áreas críticas

---

**Última atualização**: 2026-03-20
**Mantido por**: MestrAi Development Team
