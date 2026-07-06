/** Test buildSystemPrompt cu promptConfig. Run: npx tsx scripts/test-build-system-prompt.ts */
import { buildSystemPrompt } from "../lib/server/openaiOperationalCommunication";

const prompt = buildSystemPrompt({
  generalInstructions: "Redactează sobru în română.",
  template: {
    id: "tpl_accident_victime",
    title: "Accident rutier — cu victime",
    structureInstructions: "Include paragraf victime dacă apar în SMS.",
    exampleText: "Exemplu comunicat...",
  },
});

if (!prompt.includes("Redactează sobru")) {
  console.error("FAIL: lipsește instrucțiuni generale");
  process.exit(1);
}
if (!prompt.includes("Accident rutier — cu victime")) {
  console.error("FAIL: lipsește model selectat");
  process.exit(1);
}
if (!prompt.includes("Nu inventa date")) {
  console.error("FAIL: lipsește safety floor");
  process.exit(1);
}

console.log("OK: buildSystemPrompt combină general + model + safety");
console.log("Length:", prompt.length);
