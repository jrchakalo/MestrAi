# 🚀 Como Executar os Testes E2E

## ⚠️ Pré-requisitos

1. **Servidor Next.js rodando** - Os testes E2E precisam de um servidor ativo
2. **Base de dados configurada** - Para testes com autenticação
3. **Variáveis de ambiente** - `.env.local` configurado

## 📋 Setup Inicial

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Iniciar o Servidor
```bash
npm run dev
```
O servidor estará em `http://localhost:3000`

## 🎯 Executar Testes E2E

### Modo 1: Interface Visual (Recomendado para Desenvolvimento)
```bash
npm run e2e:open
```
Abre o Cypress Test Runner com interface visual onde você pode:
- ✅ Ver todos os testes
- ✅ Executar testes individuais
- ✅ Debugar em tempo real
- ✅ Ver screenshots e vídeos

### Modo 2: Headless (Recomendado para CI/CD)
```bash
npm run e2e
```
Executa todos os testes sem interface gráfica. Os resultados serão exibidos no terminal.

### Modo 3: Browser Específico
```bash
# Chrome
npm run e2e:chrome

# Firefox
npm run e2e:firefox
```

### Modo 4: Testes Específicos
```bash
# Apenas autenticação
npm run e2e -- --spec "cypress/e2e/auth.cy.ts"

# Apenas criação de campanha
npm run e2e -- --spec "cypress/e2e/campaign-creation.cy.ts"
```

## 📊 O Que os Testes Cobrem

```
✅ Autenticação (40 testes)
   - Login/Signup
   - Setup de API Key
   - Session management

✅ Criação de Campanha (30 testes)
   - Campaign Wizard (3 passos)
   - Validação de formulários
   - Listagem

✅ Sessão de Jogo (45 testes)
   - Entrar em campanha
   - Interface de jogo
   - Rolagem de dados
   - Chat e mensagens

✅ Multiplayer (50 testes)
   - Dois jogadores
   - GM features
   - Mecânica de combate
   - Chat em tempo real

✅ Tratamento de Erros (35 testes)
   - Erros de rede
   - Validação de dados
   - Edge cases
```

## 🐛 Troubleshooting

### Erro: "Cannot verify that this server is running"
**Solução**: Certifique-se que o servidor Next.js está rodando
```bash
npm run dev
# Aguarde até ver "Ready in Xs"
```

### Erro: "Module not found: test-data"
**Solução**: Os arquivos já foram corrigidos. Se persistir, limpe cache:
```bash
rm -rf node_modules/.cache
npm run e2e:open
```

### Erro: "ResizeObserver loop limit exceeded"
**Solução**: Este é um aviso conhecido de Cypress, não afeta os testes.

### Tests abrem mas não executam
**Solução**:
1. Verifique que a URL está correcta em `cypress.config.ts`
2. Veja se há elementos para clicar na página
3. Tente com `--headed` para ver o que está acontecendo

```bash
npm run e2e -- --headed
```

## 📝 Estrutura dos Testes

```
cypress/
├── e2e/                      # Testes E2E
│   ├── auth.cy.ts
│   ├── campaign-creation.cy.ts
│   ├── game-session.cy.ts
│   ├── multiplayer.cy.ts
│   └── error-handling.cy.ts
├── fixtures/
│   └── test-data.ts          # Dados de teste
├── support/
│   ├── commands.ts           # Comandos customizados
│   ├── helpers.ts            # Funções auxiliares
│   └── e2e.ts               # Setup
└── cypress.config.ts          # Configuração
```

## 🎬 Outputs dos Testes

Após executar os testes, você encontrará:

```
cypress/
├── screenshots/              # Screenshots em caso de falha
└── videos/                   # Vídeos em caso de falha
```

## 🔄 Workflow Recomendado

1. **Desenvolvimento**
   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2
   npm run e2e:open
   ```

2. **Antes de Commitar**
   ```bash
   npm run e2e
   ```

3. **CI/CD Pipeline**
   ```bash
   npm run build
   npm run e2e
   ```

## 💡 Tips

### 1. Debugar um Teste Específico
```bash
npm run e2e:open
# Selecione o teste na interface
# Use cy.debug() ou cy.pause() no código
```

### 2. Ver Logs Detalhados
```bash
npm run e2e -- --verbose
```

### 3. Aumentar Timeouts para Debugging
```bash
npm run e2e -- --config responseTimeout=30000,defaultCommandTimeout=15000
```

### 4. Executar em Loop
```bash
npm run test:watch   # Para unit tests
# Não há equivalente para E2E,mas pode-se fechar e abrir o runner
```

## 📚 Mais Informações

- Documentação Unit Tests: [TEST_GUIDE.md](./TEST_GUIDE.md)
- Documentação E2E: [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)
- Cypress Docs: https://docs.cypress.io/

## ✅ Checklist Antes de Rodar Testes

- [ ] Node.js instalado (v18+)
- [ ] Dependências instaladas (`npm install`)
- [ ] `.env.local` configurado
- [ ] Servidor rodando (`npm run dev` em outro terminal)
- [ ] Porta 3000 acessível
- [ ] Banco de dados Supabase configurado
- [ ] Sem outros serviços usando a porta 3000

## 🎯 Próximas Etapas

1. **Rodar testes unit**: `npm test`
2. **Rodar testes E2E**: `npm run e2e:open`
3. **Ver cobertura**: `npm run test:coverage`
4. **Verificar documentação adicional**: [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)

---

**Criado em**: 2026-03-19
**Versão**: 1.0.0
