import {
  DRAFT_FOOTER,
  ISU_OPERATIONAL_COMMUNICATION_PROMPT,
} from "./operationalCommunicationPrompt";

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

export async function generateOperationalDraft(
  input: OperationalDraftInput
): Promise<OperationalDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = getOpenAiModel();
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
        { role: "system", content: ISU_OPERATIONAL_COMMUNICATION_PROMPT },
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
