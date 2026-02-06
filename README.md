<div align="center">
   <h1>MestrAi</h1>
   <p>
      <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js" />
      <img src="https://img.shields.io/badge/React-18-61dafb" alt="React" />
      <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6" alt="TypeScript" />
      <img src="https://img.shields.io/badge/Supabase-2.39-3ecf8e" alt="Supabase" />
      <img src="https://img.shields.io/badge/TailwindCSS-3.4-38bdf8" alt="TailwindCSS" />
      <img src="https://img.shields.io/badge/Groq-API-000000" alt="Groq" />
   </p>
</div>

## Sobre
MestrAi é um VTT (Virtual Tabletop) narrado por IA com suporte a multiplayer, turnos e geração de imagens. Cada jogador usa sua própria chave da IA, mantendo custos e controle individual.

## Funcionalidades
- Campanhas com criação guiada (mundo, estilo visual e personagem).
- Multiplayer com aprovação de entrada e atualizações em tempo real.
- Turnos baseados na Destreza (independente do sistema).
- Narrativa com IA e geração de imagens.
- Persistência completa de mensagens e eventos.

## Stack
- Next.js (App Router)
- React + TypeScript
- Supabase (Auth, Realtime, DB)
- Tailwind CSS
- Groq API

## Requisitos
- Node.js 18+
- Projeto Supabase configurado
- Chave Groq por jogador (BYOK)

## Variáveis de ambiente
Crie um arquivo .env com:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- POLLINATIONS_KEY (opcional)

## Como obter a chave Groq
1. Acesse https://console.groq.com/keys
2. Clique em "Create API Key".
3. Copie a chave gerada e configure no app (cada jogador usa sua própria chave).

## Modelos Groq usados
- llama-3.3-70b-versatile
- qwen-2.5-72b-instruct
- llama-3.1-8b-instant

## Rate limits
Os limites variam por modelo e plano. Em caso de limite atingido, a API responde com HTTP 429 e pode incluir o header `retry-after`, além de `x-ratelimit-*`.
Referência: https://console.groq.com/docs/rate-limits

## Como rodar localmente
1. Instale as dependências: npm install
2. Configure o .env
3. Execute: npm run dev

## Scripts
- npm run dev
- npm run build
- npm run start

## Deploy (Vercel + Supabase)
1. Configure as variáveis de ambiente na Vercel.
2. Aplique o schema do Supabase (RLS, RPCs, índices).
3. Faça deploy na Vercel.

## Licença
Este projeto está sob a licença MIT. Veja a [LICENSE](LICENSE).

## Autor
[<img src="https://avatars.githubusercontent.com/jrchakalo?v=4" width=115><br><sub>Júnior Silva</sub>](https://github.com/jrchakalo)
