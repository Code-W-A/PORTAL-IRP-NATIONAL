import type { JarvisComplianceItem } from "./types";

type ComplianceInput = {
  hasFoiaThisYear: boolean;
  hasComunicateThisMonth: boolean;
  hasMediaToday: boolean;
  upcomingNamed: Array<{ title: string; daysAhead: number }>;
};

export function buildCompliance(input: ComplianceInput): JarvisComplianceItem[] {
  const named = (needle: string) =>
    input.upcomingNamed.find((item) => item.title.toLowerCase().includes(needle));

  const pompieri = named("pompier");
  const scoala = named("școlar") || named("scolar") || named("începutul anului");

  return [
    {
      id: "plan-irp",
      title: "Plan IRP 2026",
      status: "done",
      detail: "Document oficial în Drive — conectare API urmează",
    },
    {
      id: "analiza-s1",
      title: "Analiză S1",
      status: "done",
      detail: "Model existent în evidența IRP",
    },
    {
      id: "registru-544",
      title: "Registru 544",
      status: input.hasFoiaThisYear ? "active" : "missing",
      detail: input.hasFoiaThisYear ? "Activ — se completează din dosare" : "Nicio solicitare înregistrată anul acesta",
      href: "/registru-informatii-publice",
    },
    {
      id: "revista-presa",
      title: "Revista zilnică a presei",
      status: input.hasMediaToday ? "done" : "due-soon",
      detail: input.hasMediaToday ? "Există material de monitorizare astăzi" : "Nu există înregistrare pentru astăzi",
      href: "/monitorizare/revista",
    },
    {
      id: "analiza-imagine",
      title: "Analiza lunară imagine",
      status: "due-soon",
      detail: "Termen procedural: primele zile ale lunii următoare",
      href: "/monitorizare/statistici",
    },
    {
      id: "fisa-art5",
      title: "Fișă verificare art. 5",
      status: "upcoming",
      detail: "Model în Drive — verificare existență efectivă",
    },
    {
      id: "raportare-igsu",
      title: "Raportare IGSU",
      status: "upcoming",
      detail: "Se generează din activități PLANNED vs COMPLETED",
      href: "/dashboard/raportari",
    },
    {
      id: "mapa-comunicate",
      title: "Mapă comunicate lună curentă",
      status: input.hasComunicateThisMonth ? "auto" : "missing",
      detail: input.hasComunicateThisMonth
        ? "Se completează automat din BICP"
        : "Niciun comunicat înregistrat luna aceasta",
      href: "/lista-BICP",
    },
    {
      id: "mapa-evenimente",
      title: "Mapă evenimente",
      status: pompieri ? "upcoming" : scoala ? "upcoming" : "missing",
      detail: pompieri
        ? `${pompieri.title} — peste ${pompieri.daysAhead} zile`
        : scoala
          ? `${scoala.title} — peste ${scoala.daysAhead} zile`
          : "Niciun eveniment public apropiat",
      href: "/calendar-activitati",
    },
  ];
}
