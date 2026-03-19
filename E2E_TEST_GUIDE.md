# 🎮 MestrAi - E2E Test Suite com Cypress

Guia completo dos testes E2E (End-to-End) para o projeto **MestrAi** - Virtual Tabletop com IA.

## 📊 Visão Geral

Suite de testes E2E que cobrem os principais fluxos de usuário:

```
✅ Autenticação (Signin/Signup)
✅ Criação de Campanha (Campaign Wizard)
✅ Entrar em Campanha (Campaign Join)
✅ Sessão de Jogo (Game Session)
✅ Interações Multiplayer
✅ Tratamento de Erros
```

---

## 📁 Estrutura de Testes

```
cypress/
├── e2e/
│   ├── auth.cy.ts                 (40 testes - Autenticação)
│   ├── campaign-creation.cy.ts    (30 testes - Criação de Campanha)
│   ├── game-session.cy.ts         (45 testes - Sessão de Jogo)
│   ├── multiplayer.cy.ts          (50 testes - Multiplayer)
│   └── error-handling.cy.ts       (35 testes - Erros)
├── fixtures/
│   └── test-data.ts               (Dados de teste)
├── support/
│   ├── commands.ts                (Comandos customizados)
│   ├── helpers.ts                 (Funções auxiliares)
│   └── e2e.ts                     (Setup)
├── tsconfig.json                  (TypeScript config)
└── cypress.config.ts              (Configuração Cypress)
```

**Total: ~200 testes E2E**

---

## 🚀 Como Executar

### Modo Interativo (Recomendado para Desenvolvimento)
```bash
npm run e2e:open
```
Abre o Cypress Test Runner com interface visual.

### Modo Headless (CI/CD)
```bash
npm run e2e
```
Executa todos os testes sem interface gráfica.

### Testes Específicos
```bash
# Apenas testes de autenticação
npm run e2e -- --spec "cypress/e2e/auth.cy.ts"

# Apenas testes de criação de campanha
npm run e2e -- --spec "cypress/e2e/campaign-creation.cy.ts"

# Browser específico
npm run e2e:chrome
npm run e2e:firefox
```

---

## 📝 Testes Detalhados

### 1. Autenticação (40 testes)

**Arquivo**: `cypress/e2e/auth.cy.ts`

#### Landing Page
- ✅ Exibir página inicial
- ✅ Navegar para "How It Works"
- ✅ Navegar para autenticação

#### Sign In
- ✅ Exibir formulário
- ✅ Validação de campos vazios
- ✅ Validação de email inválido
- ✅ Login com credenciais incorretas
- ✅ Login bem-sucedido
- ✅ Opção de Sign Up

#### Sign Up
- ✅ Alternar para formulário de registro
- ✅ Requisitos de força de senha
- ✅ Validação de termos

#### Setup Groq Key
- ✅ Redirecionar após primeiro login
- ✅ Exibir formulário
- ✅ Informações sobre Groq
- ✅ Validação de chave
- ✅ Aceitar chave válida

#### Session
- ✅ Manter sessão após reload
- ✅ Redirecionar se não autenticado
- ✅ Logout bem-sucedido

---

### 2. Criação de Campanha (30 testes)

**Arquivo**: `cypress/e2e/campaign-creation.cy.ts`

#### Dashboard
- ✅ Exibir dashboard com campanhas
- ✅ Navegar para nova campanha
- ✅ Listar campanhas do usuário
- ✅ Ver detalhes de campanha

#### Campaign Wizard - Passo 1: Detalhes do Mundo
- ✅ Exibir formulário
- ✅ Permitir entrada de título
- ✅ Permitir descrição do mundo
- ✅ Permitir seleção de gênero
- ✅ Progredir para próximo passo
- ✅ Validação de campos obrigatórios

#### Campaign Wizard - Passo 2: Detalhes do Personagem
- ✅ Exibir formulário
- ✅ Permitir entrada de nome
- ✅ Permitir entrada de aparência
- ✅ Permitir entrada de backstory
- ✅ Progredir para passo 3 ou confirmar

#### Campaign Wizard - Passo 3: Atributos
- ✅ Exibir forma de alocação (se aplicável)

#### Fluxo Completo
- ✅ Criar campanha do início ao fim
- ✅ Exibir campanha no dashboard

---

### 3. Sessão de Jogo (45 testes)

**Arquivo**: `cypress/e2e/game-session.cy.ts`

#### Entrar em Campanha - Owner
- ✅ Exibir painel admin
- ✅ Mostrar link de compartilhamento
- ✅ Listar jogadores pendentes
- ✅ Aprovar jogador
- ✅ Banir jogador

#### Entrar em Campanha - Player
- ✅ Navegar para página de join
- ✅ Exibir informações de campanha
- ✅ Permitir entrada em campanha
- ✅ Exigir login para entrar
- ✅ Não permitir entrar em própria campanha

#### Sessão de Jogo
- ✅ Exibir interface de jogo
- ✅ Exibir character sheet
- ✅ Exibir status de saúde
- ✅ Exibir inventário
- ✅ Exibir chat de jogo
- ✅ Exibir formulário de ação
- ✅ Enviar ação de jogador
- ✅ Exibir resposta com efeito typewriter

#### Rolagem de Dados
- ✅ Abrir roller de dados quando requisitado
- ✅ Exibir opções de atributo
- ✅ Exibir opções de dificuldade
- ✅ Rolagem e exibir resultado

#### Multiplicador em Tempo Real
- ✅ Receber mensagens em tempo real
- ✅ Exibir atualiza código de status
- ✅ Atualizar indicador de turno

---

### 4. Multiplayer (50 testes)

**Arquivo**: `cypress/e2e/multiplayer.cy.ts`

#### Dois Jogadores
- ✅ Dois jogadores mesma campanha
- ✅ Sincronizar ações
- ✅ Atualizar status para todos
- ✅ Aplicar ordem de turnos
- ✅ Impedir ações fora do turno

#### Recursos do Mestre
- ✅ Exibir painel GM se owner
- ✅ Permitir criar encontros
- ✅ Permitir rolar dados
- ✅ Permitir aplicar dano

#### Mecânica de Combate
- ✅ Manipular ordem de iniciativa
- ✅ Rastrear contador de round
- ✅ Aplicar dano a personagem
- ✅ Manipular morte
- ✅ Permitir ressurreição

#### Chat e Notificações
- ✅ Exibir mensagens de sistema
- ✅ Exibir combat log
- ✅ Notificar acertos críticos
- ✅ Exibir notificações de habilidade

#### Perda de Conexão
- ✅ Exibir indicador de conexão
- ✅ Manipular perda temporária
- ✅ Queue de ações durante disconnect

---

### 5. Tratamento de Erros (35 testes)

**Arquivo**: `cypress/e2e/error-handling.cy.ts`

#### Erros de Rede
- ✅ API timeout
- ✅ Erro 500
- ✅ Rate limit 429

#### Validação de Dados
- ✅ Validar comprimento do título
- ✅ Validar campos obrigatórios
- ✅ Validar nome do personagem

#### Sessão e Autenticação
- ✅ Manipular sessão expirada
- ✅ Manipular refresh de token
- ✅ Impedir acesso sem chave API

#### Ciclo de Vida da Campanha
- ✅ Manipular exclusão de campanha
- ✅ Manipular arquivamento
- ✅ Impedir ações em campanha arquivada

#### Progressão de Personagem
- ✅ Rastrear acúmulo de dano
- ✅ Manipular level up
- ✅ Impedir aumento além do máximo

#### Gerenciamento de Inventário
- ✅ Exibir inventário
- ✅ Adicionar item
- ✅ Usar item

---

## 🛠️ Helpers e Comandos Customizados

### Helpers (cypress/support/helpers.ts)

```typescript
login(email, password)          // Login como usuário
signup(email, password, username) // Registrar novo usuário
setupGroqKey(apiKey)            // Setup chave Groq
createCampaign(campaignData)    // Criar nova campanha
logout()                        // Fazer logout
visitDashboard()               // Visitar dashboard
joinCampaign(campaignTitle)    // Entrar em campanha
rollDice(attribute, difficulty) // Rolar dados
playerAction(action)           // Enviar ação de jogador
waitForAIResponse()            // Aguardar resposta IA
checkHealthStatus(status)      // Verificar saúde
```

### Comandos Customizados (cypress/support/commands.ts)

```typescript
cy.login(email, password)      // Login customizado
cy.loginDefaultUser()          // Login com usuário padrão
cy.logout()                    // Logout
cy.waitForLoadingToFinish()   // Esperar carregamento
cy.fillForm(formData)          // Preencher formulário
```

---

## 📋 Test Data (cypress/fixtures/test-data.ts)

Dados predefinidos para testes:

```typescript
TEST_USER {
  email: 'teste@example.com'
  password: 'TestPassword123!'
  username: 'TestUser'
}

TEST_CAMPAIGN {
  title: 'The Lost Kingdom'
  description: '...'
  genero: 'Fantasy'
  // ... outros campos
}

URLS {
  home, auth, dashboard, newCampaign, ...
}
```

---

## ⚙️ Configuração

### cypress.config.ts

```typescript
baseUrl: 'http://localhost:3000'
viewportWidth: 1280
viewportHeight: 720
defaultCommandTimeout: 8000
requestTimeout: 10000
responseTimeout: 10000
```

### Estratégia de Wait

- **Timeouts curtos**: 3-5 segundos para elementos UI
- **Timeouts médios**: 8-10 segundos para operações
- **Timeouts longos**: 15 segundos para resposta IA

---

## 🔍 Melhores Práticas

### 1. **Isolamento de Testes**
```typescript
beforeEach(() => {
  cy.clearAllCookies()
  localStorage.clear()
  cy.login(...)
})
```

### 2. **Seletores Robustos**
```typescript
// ✅ Bom
cy.get('button').contains(/Send|Act/i).click()

// ❌ Ruim
cy.get('.btn-123').click()
```

### 3. **Aguardar Condições**
```typescript
// ✅ Esperar elemento desaparecer
cy.get('[role="status"], .loading').should('not.exist')

// ❌ Não confiar apenas em timeouts
cy.wait(5000)
```

### 4. **Verificar Estados Alternativos**
```typescript
cy.get('button').contains(/Join/i).then(($btn) => {
  if ($btn.length > 0) {
    cy.wrap($btn).click()
  }
})
```

---

## 🐛 Debugging

### Abrir DevTools
```typescript
cy.debug()
cy.pause()
```

### Logs Detalhados
```bash
npm run e2e -- --headed  # Abrir navegador
npm run e2e -- --verbose # Logs detalhados
```

### Screenshot e Vídeo
- Screenshots automáticos em falhas (em `cypress/screenshots`)
- Vídeos em (em `cypress/videos`)

---

## 🔄 Manutenção de Testes

### Quando Atualizar
1. **Mudanças de UI**: Atualizar seletores
2. **Novos fluxos**: Adicionar novos testes
3. **API changes**: Atualizar mocks/intercepts

### Princípios
- Testes devem ser independentes
- Evitar dependências entre testes
- Limpar estado após cada teste
- Usar waits inteligentes

---

## 📈 Próximos Passos

Testes adicionais que podem ser implementados:

1. **Performance E2E**
   - Medir tempo de carregamento
   - Testar com conexão lenta

2. **Accessibility Testing**
   - ARIA labels
   - Navegação por teclado
   - Screen readers

3. **Visual Regression**
   - Screenshots comparativos
   - Detectar mudanças de UI

4. **Load Testing**
   - Múltiplos usuários
   - Stress testing

---

## 📚 Recursos

- [Cypress Documentation](https://docs.cypress.io/)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [API Reference](https://docs.cypress.io/api/table-of-contents)

---

## ✨ Resumo

```
Total de Testes E2E:    ~200
Cobertura:              Autenticação, Campanha, Jogo, Multiplayer, Erros
Tempo de Execução:      ~5-10 minutos (headless)
Status:                 ✅ Pronto para Use
```

---

**Criado em**: 2026-03-19
**Versão**: 1.0.0
**Mantém com**: `npm run e2e`
