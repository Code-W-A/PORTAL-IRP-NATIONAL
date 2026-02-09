import type { Procedure } from "@/lib/proceduri-lucru/types";

export const procedures: Procedure[] = [
  {
    slug: "comunicarea-interventiilor-cu-impact-mediatic-negativ",
    title: "Comunicarea intervențiilor cu impact mediatic negativ",
    summary:
      "Ghid operațional pentru gestionarea comunicării publice în intervenții cu potențial de criză.",
    category: "Comunicare",
    status: "active",
    updatedAt: "2026-01-12",
    owner: "Coordonator IRP",
    tags: ["criza", "media", "interventii", "urgenta"],
    contentMarkdown: `## Scop
Asigurarea unei comunicări rapide, coerente și transparente în situații cu impact mediatic negativ, cu protejarea investigațiilor și a datelor sensibile.

## Regula de timp
Primul comunicat se transmite în maximum 30 de minute, cu date preliminare confirmate.

## Ce conține
- fapte confirmate și delimitate clar
- măsuri luate și echipe implicate
- recomandări pentru populație, dacă este cazul
- ora următoarei actualizări

## Ce nu se comunică
- identitatea persoanelor implicate
- ipoteze neverificate sau cauze nedeterminate
- detalii care pot afecta ancheta

## Flux recomandat
### Mesaj inițial
Un mesaj scurt, factual, cu accent pe acțiuni și siguranță publică.

### Actualizări
Actualizări la intervale regulate, după verificarea datelor.`,
    steps: [
      { id: "confirmare-date", title: "Confirmă datele inițiale", details: "Verifică sursele operative și delimitarea faptelor.", mustDo: true },
      { id: "definire-mesaj", title: "Definește mesajul-cheie", details: "Stabilește 2-3 idei principale, fără speculații.", mustDo: true },
      { id: "aprobare", title: "Obține aprobarea de comunicare", details: "Confirmă cu factorul decizional.", mustDo: true },
      { id: "publicare", title: "Publică mesajul inițial", details: "Canale oficiale + presă.", mustDo: true },
      { id: "monitorizare", title: "Monitorizează reacțiile", details: "Urmărește feedback și corectează rapid erorile." },
      { id: "actualizare", title: "Transmite actualizări", details: "Actualizează la intervale anunțate." },
      { id: "arhivare", title: "Arhivează comunicarea", details: "Salvează cronologia și materialele." },
    ],
  },
  {
    slug: "publicare-informare-standard",
    title: "Publicare informare standard",
    summary: "Șablon simplu pentru informări uzuale fără risc reputațional.",
    category: "Comunicare",
    status: "active",
    updatedAt: "2025-11-02",
    owner: "Ofițer IRP",
    tags: ["informare", "standard"],
    contentMarkdown: `## Scop
Publicarea rapidă a informărilor curente, cu risc redus și impact limitat.

## Structură recomandată
- titlu clar și concis
- 3-5 paragrafe scurte
- informații practice (cine, ce, unde, când)

## Note
Evitați supraîncărcarea cu detalii tehnice. Publicul are nevoie de claritate.`,
    steps: [
      { id: "draft", title: "Redactează draftul", details: "Folosește șablonul standard." },
      { id: "verificare", title: "Verifică datele", details: "Confirmă ora și locația." },
      { id: "publicare", title: "Publică informarea", details: "Website și social media." },
    ],
  },
  {
    slug: "flux-aprobare-continut",
    title: "Flux aprobare conținut",
    summary: "Pași pentru validarea conținutului înainte de publicare.",
    category: "Administrativ",
    status: "draft",
    updatedAt: "2025-08-18",
    owner: "Șef compartiment",
    tags: ["aprobare", "workflow"],
    contentMarkdown: `## Scop
Stabilirea unei succesiuni clare de validare pentru materiale publice.

## Roluri implicate
- autor conținut
- revizor
- aprobator final

## Reguli
Orice schimbare după aprobare necesită revalidare.`,
    steps: [
      { id: "redactare", title: "Redactare inițială", mustDo: true },
      { id: "revizie", title: "Revizie și corecții", mustDo: true },
      { id: "aprobare", title: "Aprobare finală", mustDo: true },
      { id: "publicare", title: "Publicare", mustDo: true },
    ],
  },
];

export function getAllProcedures() {
  return procedures;
}

export function getProceduresSortedByUpdatedAtDesc() {
  return [...procedures].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getProcedureBySlug(slug: string) {
  return procedures.find((procedure) => procedure.slug === slug);
}

