/**
 * Test: npx tsx scripts/test-moroeni-draft.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generateOperationalDraft } from "../lib/server/openaiOperationalCommunication";

function loadEnvKey(name: string): string | undefined {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    const line = readFileSync(p, "utf8")
      .split("\n")
      .find((l) => l.trimStart().startsWith(`${name}=`) || l.trimStart().startsWith(`${name} =`));
    if (line) {
      const val = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (val) return val;
    }
  }
  return process.env[name];
}

const SMS = [
  "18.30 Accident rutier in com. Moroeni, sat Glod, DN 71, 2 autoturisme implicate. Intervine GI Fieni cu 1 ASAS si 1 SMURD si det. Tgv cu 1 Desc Grea. ISUDB",
  "18.45 La acc. rutier din com. Moroeni sunt 2 victime constiente. Nu sunt persoane incarcerate. Traficul se desf. pe un sens. ISUDB",
  "18.50 La acc. rutier din com. Moroeni cele 2 victime sunt asistate medical de echipajele SMURD Fieni si Pucioasa. ISUDB",
  "19.00 Cele 2 victime de la accidentul din com. Moroeni au inceput deplasarea catre spital cu echipajele SMURD Pucioasa si Fieni. ISUDB",
];

async function main() {
  const apiKey = loadEnvKey("OPENAI_API_KEY");
  if (!apiKey) {
    console.log("SKIP OpenAI test: OPENAI_API_KEY not set");
    process.exit(0);
  }
  process.env.OPENAI_API_KEY = apiKey;

  try {
    const result = await generateOperationalDraft({
    type: "accident_rutier",
    location: "comuna Moroeni, sat Glod",
    area: "pe DN 71",
    initialTime: "18:30",
    status: "in_progress",
    needsHumanReview: false,
    extractedData: {
      eventType: "accident_rutier",
      vehicles: "două autoturisme implicate",
      victims: "două victime",
    },
    rawMessages: SMS.map((body, i) => ({
      sender: "ISUDB",
      body,
      receivedAt: new Date(Date.now() + i * 60000).toISOString(),
    })),
  });

  console.log("Model:", result.model);
  console.log("--- DRAFT ---");
  console.log(result.draft);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("invalid_api_key")) {
      console.log("SKIP OpenAI test: cheie API invalidă (401). Verifică OPENAI_API_KEY în .env.local");
      process.exit(0);
    }
    throw err;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
