import type { IntakeKind } from "./types";

export const INTAKE_OPTIONS: Array<{
  kind: IntakeKind;
  emoji: string;
  title: string;
  detail: string;
  href: string;
}> = [
  {
    kind: "incident",
    emoji: "🚒",
    title: "Intervenție",
    detail: "SMS / eveniment operativ. Draft comunicat — publicare doar după APROBĂ.",
    href: "/creaza-BICP",
  },
  {
    kind: "activity",
    emoji: "📢",
    title: "Activitate",
    detail: "Activitate publică sau campanie. Produce calendar, postare, Canva, raport.",
    href: "/calendar-activitati",
  },
  {
    kind: "press",
    emoji: "📰",
    title: "Solicitare presă",
    detail: "Întrebare jurnalist. Se leagă de comunicat și de mapa de presă.",
    href: "/creaza-BICP",
  },
  {
    kind: "foia",
    emoji: "📄",
    title: "Solicitare 544",
    detail: "Creează dosar, calculează termen, actualizează registrul.",
    href: "/registru-informatii-publice",
  },
  {
    kind: "event",
    emoji: "📅",
    title: "Eveniment",
    detail: "Zi marcată sau eveniment local. Sursa oficială rămâne Calendarul IGSU.",
    href: "/calendar-activitati",
  },
  {
    kind: "report",
    emoji: "📊",
    title: "Raportare",
    detail: "Săptămânal / lunar / IGSU — din date deja existente.",
    href: "/dashboard/raportari",
  },
];
