import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { pickApiKey } from '../../../lib/ai/keyPool';
import { RPG_SYSTEMS, normalizeSystemName, SKILLS_BY_SYSTEM, CLASSES_BY_SYSTEM } from '../../../constants';
import { isRateLimited } from '../../../lib/ai/rateLimit';
import { withModelFallback } from '../../../lib/ai/modelPool';

const bodySchema = z.object({
  systemName: z.string(),
  name: z.string(),
  appearance: z.string(),
  backstory: z.string(),
  profession: z.string().optional(),
});

const characterSchema = z.object({
  class_or_role: z.string(),
  profession: z.string().optional(),
  attributes: z.record(z.number()),
  skills: z.union([z.array(z.string()), z.string(), z.record(z.any())]),
  hp: z.union([z.number(), z.string()]),
  inventory: z.union([z.array(z.string()), z.string()]),
  notes: z.string().optional(),
  // System-specific optional fields
  sanity: z.number().optional(),
  luck: z.number().optional(),
  humanity: z.number().optional(),
  blood_pool: z.number().optional(),
  emp: z.number().optional(),
  reputation: z.number().optional(),
  mana: z.number().optional(),
  stamina: z.number().optional(),
  focus: z.number().optional(),
  alignment: z.string().optional(),
  force_sensitive: z.boolean().optional(),
  force_rating: z.number().optional(),
  grit: z.number().optional(),
  corruption: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const userKey = req.headers.get('x-custom-api-key') || undefined;

    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const rateKey = `infer:${ip}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { systemName, name, appearance, backstory, profession } = parsed.data;
    const normalizedSystem = normalizeSystemName(systemName);
    const rules = RPG_SYSTEMS[normalizedSystem] || RPG_SYSTEMS['Narrativo'];
    const skillsReference = SKILLS_BY_SYSTEM[normalizedSystem] || [];
    const classOptions = CLASSES_BY_SYSTEM[normalizedSystem] || [];

    let apiKey: string;
    try {
      apiKey = pickApiKey(userKey);
    } catch {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }
    const ai = new Groq({ apiKey });

    const systemHint = (() => {
      switch (normalizedSystem) {
        case 'D&D 5e':
          return 'Use atributos em português: força, destreza, constituição, inteligência, sabedoria, carisma. Valores 8-18. Inclua class_or_role e hp coerentes com o backstory.';
        case 'Ordem Paranormal':
          return 'Use atributos em português: força, agilidade, intelecto, presença, vigor. Valores 1-5 (padrão), coerentes com o backstory. Inclua class_or_role e hp coerentes.';
        case 'Call of Cthulhu':
          return 'Use atributos em português: força, constituição, destreza, inteligência, poder, aparência, educação, tamanho. Valores 20-90. Inclua sanity e luck como números (0-99).';
        default:
          return 'Inclua apenas campos relevantes e coerentes com o backstory.';
      }
    })();

    const promptBase = `Sistema: ${normalizedSystem}. Regras resumidas: ${rules}

Crie uma ficha JSON para o personagem usando os dados:
 Nome: ${name}
 Aparência: ${appearance}
 Backstory: ${backstory}
 Profissão/Ocupação (opcional): ${profession || 'não informada'}

${systemHint}

Lista de perícias permitidas (use apenas essas como referência):
${skillsReference.map((s) => `- ${s}`).join('\n')}

Classes/roles permitidas (escolha UMA):
${classOptions.map((c) => `- ${c}`).join('\n')}

  REGRAS CRÍTICAS:
  - SEMPRE preencha: class_or_role, attributes, skills, hp, inventory.
  - As perícias DEVEM ser inferidas a partir do backstory (profissão, passado, traumas, treinamento, experiências).
  - Classe/role, HP, atributos e inventário também DEVEM ser inferidos a partir do backstory.
  - Respeite estritamente as classes/roles permitidas para o sistema.
  - Se o texto estiver genérico, INFERIR valores plausíveis com base no gênero e sistema.
  - Se o backstory for raso, use total criatividade para preencher tudo com coerência.
  - Nunca deixe atributos vazios; se faltar, preencha com valores padrão coerentes.
  - Responda APENAS com um JSON válido (sem markdown, sem explicações).

Responda APENAS com um JSON válido e conciso, sem Markdown.`;

    const warnings: string[] = [];

    const generate = async (extra: string) => {
      const prompt = `${promptBase}\n\n${extra}`.trim();
      return withModelFallback(
        (model) =>
          ai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.6,
          }),
        { key: `infer:${systemName}` }
      );
    };

    const attempts = [
      'Gere valores completos e coerentes.',
      'Se algo estiver faltando, complete com valores padrão do sistema.',
      'Reenvie um JSON válido com todos os campos obrigatórios preenchidos.',
    ];

    let parsedJson: any = null;
    let parsedObj: any = null;

    for (const extra of attempts) {
      const result = await generate(extra);
      const raw = result.choices?.[0]?.message?.content || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch (e) {
        continue;
      }
      const candidate = characterSchema.safeParse(parsedJson);
      if (candidate.success) {
        parsedObj = candidate;
        break;
      }
    }

    if (!parsedObj?.success) {
      warnings.push('Ficha incompleta. Não foi possível concluir.');
      return NextResponse.json({ character: parsedJson || {}, warnings });
    }

    const obj = parsedObj.data as any;

    const normalizeString = (value: any) => {
      if (typeof value === 'string') return value.trim();
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    const coerceNumber = (value: any) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const randomInRange = (min: number, max: number, step = 1) => {
      const steps = Math.floor((max - min) / step) + 1;
      return min + step * Math.floor(Math.random() * steps);
    };

    const pickBase = (values: number[], count: number) => {
      const shuffled = [...values].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    const normalizeAttributes = (
      attrs: Record<string, any> | undefined,
      keys: string[],
      min: number,
      max: number,
      baseValues?: number[]
    ) => {
      const result: Record<string, any> = { ...(attrs || {}) };
      const base = baseValues ? pickBase(baseValues, keys.length) : [];
      keys.forEach((key, index) => {
        const raw = result[key] ?? result[key.toLowerCase()];
        const coerced = coerceNumber(raw);
        const value = coerced === null
          ? (baseValues ? base[index] : randomInRange(min, max))
          : coerced;
        result[key] = clamp(value, min, max);
      });
      return result;
    };

    const normalizeSkills = (value: any) => {
      if (Array.isArray(value)) {
        return value.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).map((s) => s.trim()).filter(Boolean);
      }
      return [] as string[];
    };

    const normalizeInventory = (value: any) => {
      if (Array.isArray(value)) {
        return value.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [] as string[];
    };

    const normalizeClass = (value: any) => {
      const raw = normalizeString(value);
      if (!classOptions.length || normalizedSystem === 'Narrativo') {
        return raw || (classOptions[0] || 'Aventureiro');
      }
      const match = classOptions.find((c) => c.toLowerCase() === raw.toLowerCase());
      if (match) return match;
      const fuzzy = classOptions.find((c) => raw && c.toLowerCase().includes(raw.toLowerCase()));
      return fuzzy || classOptions[0];
    };

    const pickSkills = (source: string[], min: number, max: number) => {
      if (source.length === 0) return [] as string[];
      const count = Math.max(min, Math.min(max, Math.floor(Math.random() * (max - min + 1)) + min));
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    const limitSkills = (skills: string[], min: number, max: number) => {
      if (skills.length <= max) return skills;
      const shuffled = [...skills].sort(() => Math.random() - 0.5);
      const count = Math.max(min, Math.min(max, shuffled.length));
      return shuffled.slice(0, count);
    };

    const ensureNumber = (value: any, label: string, min?: number, max?: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        warnings.push(`${label} inválido`);
        return;
      }
      if (min !== undefined && value < min) warnings.push(`${label} abaixo do mínimo (${min})`);
      if (max !== undefined && value > max) warnings.push(`${label} acima do máximo (${max})`);
    };

    const ensureAttributesRange = (keys: string[], min: number, max: number) => {
      if (!obj.attributes || typeof obj.attributes !== 'object') {
        warnings.push('Atributos inválidos');
        return;
      }
      keys.forEach((key) => {
        const value = obj.attributes[key];
        ensureNumber(value, `Atributo ${key}`, min, max);
      });
    };

    if (normalizedSystem === 'D&D 5e') {
      obj.attributes = normalizeAttributes(
        obj.attributes,
        ['força', 'destreza', 'constituição', 'inteligência', 'sabedoria', 'carisma'],
        1,
        20,
        [15, 14, 13, 12, 10, 8]
      );
      ensureAttributesRange(
        ['força', 'destreza', 'constituição', 'inteligência', 'sabedoria', 'carisma'],
        1,
        20
      );
    }

    if (normalizedSystem === 'Ordem Paranormal') {
      obj.attributes = normalizeAttributes(
        obj.attributes,
        ['força', 'agilidade', 'intelecto', 'presença', 'vigor'],
        1,
        5,
        [4, 3, 3, 2, 2]
      );
      ensureAttributesRange(['força', 'agilidade', 'intelecto', 'presença', 'vigor'], 1, 5);
    }

    if (normalizedSystem === 'Call of Cthulhu') {
      obj.attributes = normalizeAttributes(
        obj.attributes,
        ['força', 'constituição', 'destreza', 'inteligência', 'poder', 'aparência', 'educação', 'tamanho'],
        1,
        100,
        [70, 60, 60, 50, 50, 40, 40, 30]
      );
      ensureNumber(obj.sanity, 'SAN', 0, 99);
      ensureNumber(obj.luck, 'Luck', 0, 99);
      ensureAttributesRange(
        ['força', 'constituição', 'destreza', 'inteligência', 'poder', 'aparência', 'educação', 'tamanho'],
        1,
        100
      );
    }

    obj.class_or_role = normalizeClass(obj.class_or_role);
    obj.profession = normalizeString(obj.profession || profession);

    const normalizedSkills = normalizeSkills(obj.skills);
    if (normalizedSkills.length === 0) {
      const defaults = pickSkills(
        skillsReference,
        normalizedSystem === 'Call of Cthulhu' ? 5 : 4,
        normalizedSystem === 'Ordem Paranormal' ? 6 : 5
      );
      obj.skills = defaults;
    } else {
      const filtered = skillsReference.length
        ? normalizedSkills.filter((s) => skillsReference.some((ref) => ref.toLowerCase() === s.toLowerCase()))
        : normalizedSkills;
      const base = filtered.length > 0 ? filtered : normalizedSkills;
      const limited = limitSkills(
        base,
        normalizedSystem === 'Call of Cthulhu' ? 6 : 4,
        normalizedSystem === 'Ordem Paranormal' ? 7 : 6
      );
      obj.skills = limited;
    }

    obj.inventory = normalizeInventory(obj.inventory);
    obj.hp = coerceNumber(obj.hp) ?? obj.hp;

    return NextResponse.json({ character: obj, warnings });
  } catch (error: any) {
    console.error('Character inference error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
