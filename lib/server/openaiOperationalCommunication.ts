import {
  DRAFT_FOOTER,
  ISU_OPERATIONAL_COMMUNICATION_PROMPT,
} from "./operationalCommunicationPrompt";

export type PromptConfigInput = {
  generalInstructions?: string;
  template?: {
    id: string;
    title: string;
    structureInstructions: string;
    exampleText?: string;
  };
};

export type OperationalDraftInput = {
  rawMessages: Array<{ sender: string; body: string; receivedAt: string }>;
  extractedData: Record<string, unknown>;
  status: string;
  type: string;
  location: string;
  area?: string;
  initialTime: string;
  warnings?: Array<{ type: string; message: string; severity: string }>;
  needsHumanReview?: boolean;
  promptConfig?: PromptConfigInput | null;
};

export type OperationalDraftResult = {
  draft: string;
  model: string;
};

function getOpenAiModel(): string {
  return process.env.OPENAI_OPERATIONAL_MODEL || "gpt-4.1-mini";
}

function ensureDraftFooter(text: string): string {
  const trimmed = text.trim();
  if (trimmed.includes(DRAFT_FOOTER)) return trimmed;
  return `${trimmed}\n\n${DRAFT_FOOTER}`;
}

const SAFETY_FLOOR = `
Constrângeri obligatorii (nu le ignora niciodată):
- Nu inventa date, victime, cauze, vârste, suprafețe, mijloace sau finalizarea intervenției.
- Nu menționa cauza probabilă dacă nu apare explicit în SMS.
- Nu menționa victime dacă nu apar explicit în SMS.
- Dacă needsHumanReview este true sau există warnings de tip contradiction, redactează conservator.
- La final adaugă exact: "${DRAFT_FOOTER}"
- Returnează doar textul comunicatului, fără titluri sau markdown.
`.trim();

export function buildSystemPrompt(promptConfig?: PromptConfigInput | null): string {
  const general = promptConfig?.generalInstructions?.trim() || ISU_OPERATIONAL_COMMUNICATION_PROMPT;
  const parts = [general.trim()];

  if (promptConfig?.template) {
    parts.push(`
Model selectat: "${promptConfig.template.title}" (id: ${promptConfig.template.id})
Instrucțiuni structură pentru acest model:
${promptConfig.template.structureInstructions.trim()}`);
    if (promptConfig.template.exampleText?.trim()) {
      parts.push(`
Exemplu de referință (stil și structură — nu copia datele dacă nu sunt în SMS):
${promptConfig.template.exampleText.trim()}`);
    }
  }

  parts.push(SAFETY_FLOOR);
  return parts.join("\n\n");
}

export async function generateOperationalDraft(
  input: OperationalDraftInput
): Promise<OperationalDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = getOpenAiModel();
  const systemPrompt = buildSystemPrompt(input.promptConfig);
  const userPayload = {
    incident: {
      type: input.type,
      location: input.location,
      area: input.area || "",
      initialTime: input.initialTime,
      status: input.status,
      needsHumanReview: input.needsHumanReview ?? false,
      extractedData: input.extractedData,
      warnings: input.warnings || [],
    },
    smsMessages: input.rawMessages.map((m, index) => ({
      order: index + 1,
      sender: m.sender,
      receivedAt: m.receivedAt,
      body: m.body,
    })),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(userPayload, null, 2),
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${res.status} ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned empty draft");
  }

  return {
    draft: ensureDraftFooter(content),
    model,
  };
}
