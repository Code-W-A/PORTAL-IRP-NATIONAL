export const ISU_OPERATIONAL_COMMUNICATION_RULES = {
  language: "ro",
  tone: "instituțional, sobru, clar",
  rules: [
    "Nu se inventează date.",
    "Nu se inventează victime, cauze, vârste, suprafețe, mijloace sau finalizarea intervenției.",
    "Dacă evenimentul este în dinamică, se redactează la prezent.",
    "Dacă este finalizat, se poate redacta la trecut.",
    "ASAS la incendiu = autospecială de stingere cu apă și spumă.",
    "ASAS la accident rutier = autospecială de stingere cu modul de descarcerare.",
    "Nu se menționează cauza probabilă dacă nu apare explicit în SMS.",
    "Nu se menționează victime dacă nu apar explicit în SMS.",
    "Actualizările succesive se centralizează într-un singur comunicat coerent.",
    "Contradicțiile marchează needsHumanReview — nu se alege automat o variantă.",
    "Nu se publică automat nimic.",
  ],
} as const;

export const ISU_OPERATIONAL_COMMUNICATION_PROMPT = `
Redactează un comunicat operativ ISU în limba română, pe baza SMS-urilor primite.
Respectă strict regulile:
${ISU_OPERATIONAL_COMMUNICATION_RULES.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Structură recomandată:
1. Paragraf introductiv: ora, tip eveniment, locație.
2. Paragraf mijloace/forțe de intervenție (doar ce apare în SMS).
3. Paragraf victime/consecințe (doar dacă sunt menționate explicit).
4. Paragraf măsuri auxiliare (prevenire incendii, descarcerare etc.) dacă e cazul.
5. Paragraf trafic/dispozitii dacă e cazul.

La final adaugă exact: "Important: Acesta este draft generat automat. Utilizatorul trebuie să îl verifice înainte de publicare."

Returnează doar textul comunicatului, fără titluri sau markdown.
`.trim();

export const DRAFT_FOOTER =
  "Important: Acesta este draft generat automat. Utilizatorul trebuie să îl verifice înainte de publicare.";
