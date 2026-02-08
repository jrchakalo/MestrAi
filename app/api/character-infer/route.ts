import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { z } from "zod";
import { pickApiKey } from "../../../lib/ai/keyPool";
import { isRateLimited } from "../../../lib/ai/rateLimit";
import { withModelFallback } from "../../../lib/ai/modelPool";
import { sanitizeAttributes } from "../../../lib/gameRules";
import type { AttributeName, CharacterSheet, InventoryItem } from "../../../types";

const bodySchema = z.object({
  genero: z.string(),
  tom: z.string(),
  magia: z.string(),
  tech: z.string(),
  name: z.string(),
  appearance: z.string(),
  backstory: z.string(),
  profession: z.string().optional(),
});

const characterSchema = z.object({
  profession: z.string().optional(),
  attributes: z.record(z.number()),
  inventory: z.array(z.any()).optional(),
});

const attributeKeys: AttributeName[] = ["VIGOR", "DESTREZA", "MENTE", "PRESENÇA"];

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeAttributes = (attrs: Record<string, any> | undefined) => {
  const base: Record<AttributeName, number> = {
    VIGOR: 0,
    DESTREZA: 0,
    MENTE: 0,
    PRESENÇA: 0,
  };

  attributeKeys.forEach((key) => {
    const raw = attrs?.[key] ?? attrs?.[key.toLowerCase()];
    const coerced = coerceNumber(raw);
    base[key] = coerced === null ? 0 : Math.max(0, Math.min(5, coerced));
  });

  return sanitizeAttributes(base);
};

const normalizeInventory = (value: unknown): InventoryItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          id: crypto.randomUUID(),
          name: entry.trim(),
          type: "equipment" as const,
          quantity: 1,
        };
      }
      if (entry && typeof entry === "object") {
        const name = typeof (entry as any).name === "string" ? (entry as any).name.trim() : "";
        if (!name) return null;
        const type = (entry as any).type === "consumable" ? "consumable" : "equipment";
        const quantity = coerceNumber((entry as any).quantity) ?? 1;
        return {
          id: typeof (entry as any).id === "string" && (entry as any).id.trim()
            ? (entry as any).id
            : crypto.randomUUID(),
          name,
          type,
          quantity: Math.max(0, Math.floor(quantity)),
        };
      }
      return null;
    })
    .filter(Boolean) as InventoryItem[];
};

export async function POST(req: Request) {
  try {
    const userKey = req.headers.get("x-custom-api-key") || undefined;

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const rateKey = `infer:${ip}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let apiKey: string;
    try {
      apiKey = pickApiKey(userKey);
    } catch {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const { genero, tom, magia, tech, name, appearance, backstory, profession } = parsed.data;
    const ai = new Groq({ apiKey });

    const prompt = `Voce esta criando uma ficha para um RPG narrativo deterministico.

Contexto da campanha:
- Genero: ${genero}
- Tom e Letalidade: ${tom}
- Nivel de Magia: ${magia}
- Nivel de Tecnologia: ${tech}

Personagem:
- Nome: ${name}
- Aparencia: ${appearance}
- Backstory: ${backstory}
- Profissao (opcional): ${profession || ""}

Retorne APENAS um JSON valido com o seguinte formato:
{
  "profession": "...",
  "attributes": {
    "VIGOR": 0,
    "DESTREZA": 0,
    "MENTE": 0,
    "PRESENÇA": 0
  },
  "inventory": [
    { "name": "...", "type": "consumable" | "equipment", "quantity": 1 }
  ]
}

REGRAS OBRIGATORIAS:
- A soma dos 4 atributos deve ser exatamente 10.
- Cada atributo deve estar entre 0 e 5.
- Escolha atributos coerentes com a profissao e o backstory.
- Inventario deve ser conciso (3 a 6 itens).
- Responda sem Markdown ou explicacoes.`;

    const result = await withModelFallback(
      (model) =>
        ai.chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6,
        }),
      { key: `infer:${name}` }
    );

    const raw = result.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ character: {}, warnings: ["JSON nao encontrado na resposta."] });
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ character: {}, warnings: ["JSON invalido na resposta."] });
    }

    const candidate = characterSchema.safeParse(parsedJson);
    if (!candidate.success) {
      return NextResponse.json({ character: parsedJson || {}, warnings: ["Ficha incompleta."] });
    }

    const normalizedAttributes = normalizeAttributes(candidate.data.attributes || {});
    const normalizedInventory = normalizeInventory(candidate.data.inventory || []);
    const finalProfession = (profession || candidate.data.profession || "Sem profissao").trim();

    const character: CharacterSheet = {
      name,
      appearance,
      profession: finalProfession,
      backstory,
      attributes: normalizedAttributes,
      health: { tier: "HEALTHY", lightDamageCounter: 0 },
      inventory: normalizedInventory,
    };

    return NextResponse.json({ character, warnings: [] });
  } catch (error) {
    console.error("Character infer error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
