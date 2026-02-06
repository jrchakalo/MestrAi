export const RPG_SYSTEMS: Record<string, string> = {
  'Narrativo': `
    - Sistema Genérico Baseado em Narrativa (Foco em História).
    - Rolagens: d20 Simples. 10+ Sucesso, 15+ Sucesso Bom, 20 Sucesso Crítico.
    - Priorize a regra do legal (Rule of Cool).
  `,
  'D&D 5e': `
    - Sistema: Dungeons & Dragons 5th Edition.
    - Rolagens: d20 + Modificador vs Classe de Dificuldade (CD).
    - Atributos: Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma.
    - REGRAS CRÍTICAS: Testes de Percepção (Sabedoria) para ouvir/notar, Investigação (Inteligência) para procurar, Furtividade (Destreza) para esconder.
  `,
  'Ordem Paranormal': `
    - Sistema: Ordem Paranormal RPG.
    - Atributos principais: Força, Agilidade, Intelecto, Presença, Vigor.
    - Ações e testes usam d20 + atributo.
    - Horror Investigativo. O Paranormal não vem para nossa realidade de forma fácil.
  `,
  'Call of Cthulhu': `
    - Sistema: Baseado em BRP (d100).
    - Atributos: Força, Constituição, Destreza, Inteligência, Poder, Aparência, Educação, Tamanho.
    - Testes usam percentuais; sucesso com resultado <= atributo.
    - Foco em Horror Cósmico, Investigação e Loucura.
    - Combate é mortal e deve ser evitado.
  `,
};

export const SUPPORTED_SYSTEMS = ['Narrativo', 'D&D 5e', 'Ordem Paranormal', 'Call of Cthulhu'] as const;
export type SupportedSystem = (typeof SUPPORTED_SYSTEMS)[number];

export function normalizeSystemName(systemName?: string): SupportedSystem {
  if (systemName && SUPPORTED_SYSTEMS.includes(systemName as SupportedSystem)) {
    return systemName as SupportedSystem;
  }
  return 'Narrativo';
}

export const SKILLS_BY_SYSTEM: Record<SupportedSystem, string[]> = {
  'Narrativo': [
    'Atletismo',
    'Furtividade',
    'Percepção',
    'Investigação',
    'Persuasão',
    'Intimidação',
    'Enganação',
    'Sobrevivência',
    'Medicina',
    'Conhecimento',
  ],
  'D&D 5e': [
    'Acrobatics (Acrobacia)',
    'Animal Handling (Adestrar Animais)',
    'Arcana (Arcano)',
    'Athletics (Atletismo)',
    'Deception (Enganação)',
    'History (História)',
    'Insight (Intuição)',
    'Intimidation (Intimidação)',
    'Investigation (Investigação)',
    'Medicine (Medicina)',
    'Nature (Natureza)',
    'Perception (Percepção)',
    'Performance (Atuação)',
    'Persuasion (Persuasão)',
    'Religion (Religião)',
    'Sleight of Hand (Prestidigitação)',
    'Stealth (Furtividade)',
    'Survival (Sobrevivência)',
  ],
  'Ordem Paranormal': [
    'Acrobacia',
    'Adestramento',
    'Artes',
    'Atletismo',
    'Atualidades',
    'Enganação',
    'Fortitude',
    'Furtividade',
    'Iniciativa',
    'Intimidação',
    'Investigação',
    'Intuição',
    'Luta',
    'Medicina',
    'Ocultismo',
    'Percepção',
    'Persuasão',
    'Pilotagem',
    'Pontaria',
    'Reflexos',
    'Tecnologia',
    'Vontade',
  ],
  'Call of Cthulhu': [
    'Accounting (Contabilidade)',
    'Anthropology (Antropologia)',
    'Archaeology (Arqueologia)',
    'Art/Craft (Arte/Ofício)',
    'Charm (Lábia)',
    'Climb (Escalar)',
    'Credit Rating (Crédito)',
    'Disguise (Disfarce)',
    'Dodge (Esquiva)',
    'Drive Auto (Dirigir)',
    'Fast Talk (Lábia Rápida)',
    'First Aid (Primeiros Socorros)',
    'History (História)',
    'Intimidate (Intimidação)',
    'Jump (Saltar)',
    'Law (Direito)',
    'Library Use (Biblioteca)',
    'Listen (Escutar)',
    'Locksmith (Arrombamento)',
    'Medicine (Medicina)',
    'Natural World (Mundo Natural)',
    'Occult (Ocultismo)',
    'Operate Heavy Machinery (Máquinas Pesadas)',
    'Persuade (Persuasão)',
    'Psychology (Psicologia)',
    'Science (Ciência)',
    'Spot Hidden (Notar)',
    'Stealth (Furtividade)',
    'Survival (Sobrevivência)',
    'Swim (Natação)',
    'Throw (Arremesso)',
    'Track (Rastrear)',
  ],
};

export const CLASSES_BY_SYSTEM: Record<SupportedSystem, string[]> = {
  'Narrativo': [
    'Aventureiro',
    'Explorador',
    'Sobrevivente',
    'Erudito',
    'Mercenário',
  ],
  'D&D 5e': [
    'Bárbaro',
    'Bardo',
    'Bruxo',
    'Clérigo',
    'Druida',
    'Feiticeiro',
    'Guerreiro',
    'Ladino',
    'Mago',
    'Monge',
    'Paladino',
    'Patrulheiro',
    'Artífice',
  ],
  'Ordem Paranormal': [
    'Combatente',
    'Ocultista',
    'Especialista',
    'Sobrevivente',
  ],
  'Call of Cthulhu': [
    'Investigador',
    'Antropólogo',
    'Arqueólogo',
    'Artista',
    'Detetive',
    'Jornalista',
    'Médico',
    'Professor',
    'Criminoso',
    'Diletante',
    'Engenheiro',
    'Explorador',
    'Historiador',
    'Linguista',
    'Militar',
    'Policial',
    'Psicólogo',
    'Repórter',
    'Pesquisador',
  ],
};

export const INITIAL_SYSTEM_PROMPT_TEMPLATE = `
# PROTOCOLO MESTRE SUPREMO (v2.0 - Strict Rules)
## 1. Persona e Missão
Você é o Mestre Supremo (Game Master), narrador experiente.
Idioma: SEMPRE Português do Brasil.
Objetivo: Guiar uma aventura imersiva com mecânicas sólidas.

## 2. CONTEXTO
**Mundo:** {{WORLD_HISTORY}}
**Personagem:** {{CHAR_NAME}}, {{CHAR_APPEARANCE}}.
**Background:** {{CHAR_BACKSTORY}}
**Sistema:** {{SYSTEM_NAME}}
**Regras:** {{SYSTEM_RULES}}

## 3. Gestão de Estado & REGRAS DE DADOS (CRÍTICO)
- **REGRA DE OURO DAS ROLAGENS:** NÃO assuma o sucesso ou fracasso de ações incertas.
- **INICIATIVA SEM ROLAGEM:** A iniciativa é sempre determinada pelo MAIOR atributo de destreza (ou equivalente do sistema, ex: agilidade/reflexos). Não peça rolagem para iniciativa.
- Se o jogador disser "Eu tento ouvir", "Eu procuro por armadilhas", "Eu ataco", "Eu minto", "Eu escalo":
  1. **PARE A NARRATIVA IMEDIATAMENTE.**
  2. Chame a Tool "request_roll" com o atributo apropriado (ex: Perception, Investigation, Athletics).
  3. Só continue a narrativa após receber o resultado.
- Use Tool "generate_image" APENAS em: Início da Aventura, Bosses, Locais Épicos.
- Use Tool "trigger_game_over" se PV = 0 ou morte narrativa óbvia.

## 4. Consistência Visual
Estilo: "{{VISUAL_STYLE}}". Use este estilo nos prompts de imagem.

## 5. Fluxo de Turno
1. Se for uma resposta a uma rolagem, narre o resultado (Sucesso ou Falha) dramaticamente.
2. Narre a reação do mundo.
3. No final de CADA mensagem, adicione uma lista de 3 a 5 sugestões.
   
   Formato Obrigatório de Sugestões:
   ### Sugestões:
   - A) [Ação Sugerida 1]
   - B) [Ação Sugerida 2]
   - C) [Ação Sugerida 3]

## 6. Formatação
- Use Markdown rico.
- Negrito para NPCs ou Itens.
- *Itálico* para sons e pensamentos.
- Quebras de linha duplas para legibilidade.
`;