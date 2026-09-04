import { foldRo } from "./format";
import type { JarvisChatMessage, JarvisSnapshot } from "./types";

function createId() {
  return `jarvis_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function lines(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join("\n\n");
}

function upcomingList(snapshot: JarvisSnapshot, limit = 5) {
  if (!snapshot.upcoming.length) return "Nu am găsit activități în următoarele 45 de zile.";
  return snapshot.upcoming
    .slice(0, limit)
    .map((item) => `• ${item.dateLabel} — ${item.title}`)
    .join("\n");
}

function foiaList(snapshot: JarvisSnapshot) {
  if (!snapshot.foia.length) return "Nicio solicitare 544 deschisă.";
  return snapshot.foia
    .map((item) => {
      const term =
        item.overdue
          ? `depășit (${item.deadlineLabel})`
          : item.daysLeft === 0
            ? "expiră astăzi"
            : `termen ${item.deadlineLabel} (${item.daysLeft} zile)`;
      return `• ${item.requestNumber} — ${item.requesterName} — ${term}`;
    })
    .join("\n");
}

function preparePack(title: string, dateLabel: string) {
  return lines([
    `Pregătire pentru ${dateLabel} — ${title}.`,
    "Am pregătit pachetul de lucru. Nimic nu se publică fără aprobare:",
    [
      "• draft postare Facebook",
      "• draft comunicat",
      "• structură material site",
      "• design Canva (master Zi marcată) — draft",
      "• checklist foto/video",
      "• eveniment în Calendar activități",
    ].join("\n"),
    "Următorul pas: deschizi activitatea, verifici textele, apoi APROBĂ.",
  ]);
}

export function answerJarvis(question: string, snapshot: JarvisSnapshot): JarvisChatMessage {
  const q = foldRo(question);

  if (!q) {
    return {
      id: createId(),
      role: "assistant",
      text: "Scrie ce vrei: ce ai azi, ce e restant, ce 544 expiră, sau „pregătește 13 septembrie”.",
    };
  }

  if (/(ce am azi|astazi|azi\b|ce am de facut azi)/.test(q)) {
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        `${snapshot.dateLong}.`,
        snapshot.dots.map((dot) => `• ${dot.label}`).join("\n"),
        snapshot.upcoming[0] ? `Urmează: ${snapshot.upcoming[0].dateLabel} — ${snapshot.upcoming[0].title}` : null,
      ]),
      actions: [
        { label: "Calendar", href: "/calendar-activitati" },
        { label: "Registru 544", href: "/registru-informatii-publice" },
      ],
    };
  }

  if (/(saptamana viitoare|urmatoarea saptamana|ce am de facut)/.test(q)) {
    const week = snapshot.upcoming.filter((item) => item.daysAhead <= 7);
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        week.length
          ? `Ai ${week.length} ${week.length === 1 ? "activitate" : "activități"} în următoarele 7 zile.`
          : "Nu am activități în următoarele 7 zile.",
        week.length ? week.map((item) => `• ${item.dateLabel} — ${item.title}`).join("\n") : upcomingList(snapshot, 4),
        snapshot.foia[0]
          ? `544: ${snapshot.foia[0].requestNumber} — ${snapshot.foia[0].requesterName}, termen ${snapshot.foia[0].deadlineLabel}.`
          : "Nicio solicitare 544 cu termen imediat.",
        snapshot.counts.comunicateMonth
          ? `Comunicate luna aceasta: ${snapshot.counts.comunicateMonth}.`
          : null,
      ]),
      actions: [{ label: "Deschide calendarul", href: "/calendar-activitati" }],
    };
  }

  if (/(restant|intarziat|depasit|nu am la zi|ce nu e gata)/.test(q)) {
    const lateDocs = snapshot.compliance.filter((item) => item.status === "missing" || item.status === "due-soon");
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        snapshot.counts.foiaOverdue
          ? `${snapshot.counts.foiaOverdue} solicitări 544 depășite.`
          : "Nicio solicitare 544 depășită.",
        lateDocs.length
          ? `Documente de urmărit:\n${lateDocs.map((item) => `• ${item.title} — ${item.detail}`).join("\n")}`
          : "Evidența documentelor obligatorii nu semnalează restanțe critice.",
        snapshot.counts.mediaToday ? null : "Revista presei de astăzi nu este încă bifatată.",
      ]),
      actions: [
        { label: "Documente", href: "/jarvis?tab=documente" },
        { label: "544", href: "/registru-informatii-publice" },
      ],
    };
  }

  if (/(544|foia|informatii publice|expira)/.test(q)) {
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        `Solicitări 544 deschise: ${snapshot.counts.foiaOpen}.`,
        foiaList(snapshot),
        "Răspunsul final rămâne cu aprobare umană. AI-ul poate doar extrage, calcula termenul și propune draft din baza legală.",
      ]),
      actions: [{ label: "Deschide registrul 544", href: "/registru-informatii-publice" }],
    };
  }

  if (/(cate comunicate|comunicate luna|luna aceasta|indicator)/.test(q)) {
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        `Pentru ${snapshot.monthLabel} am în bază:`,
        [
          `• Comunicate BICP: ${snapshot.counts.comunicateMonth}`,
          `• Comunicate astăzi: ${snapshot.counts.comunicateToday}`,
          `• Solicitări 544 deschise: ${snapshot.counts.foiaOpen}`,
          `• Activități următoarele 14 zile: ${snapshot.counts.activitiesNext14}`,
          `• Apariții media negative: ${snapshot.counts.mediaNegative}`,
        ].join("\n"),
        "Raportarea se generează din aceste înregistrări — nu se mai numără manual.",
      ]),
      actions: [
        { label: "Lista BICP", href: "/lista-BICP" },
        { label: "Raportări", href: "/dashboard/raportari" },
      ],
    };
  }

  if (/(raport|raportare|septembrie|august|igsu|genereaza raport)/.test(q)) {
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        `Raportarea pentru ${snapshot.monthLabel} poate porni din datele deja acumulate.`,
        [
          `Comunicate: ${snapshot.counts.comunicateMonth}`,
          `544 deschise: ${snapshot.counts.foiaOpen}`,
          `Activități programate (14 zile): ${snapshot.counts.activitiesNext14}`,
        ].join("\n"),
        "Nu completez template-ul oficial până nu există stările PLANNED / PUBLISHED / COMPLETED pe fiecare activitate. Acum te duc la motorul de raportări.",
      ]),
      actions: [{ label: "Generează din raportări", href: "/dashboard/raportari" }],
    };
  }

  if (/(documente obligatorii|drive|evidenta|conformitate)/.test(q)) {
    const missing = snapshot.compliance.filter((item) => item.status === "missing" || item.status === "due-soon");
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        "Conformitate IRP — din evidența existentă, nu din memorie:",
        snapshot.compliance.map((item) => `• ${item.title}: ${item.detail}`).join("\n"),
        missing.length ? "Prioritare sunt cele marcate lipsă sau cu termen apropiat." : "Nu am găsit goluri critice în checklist.",
      ]),
      actions: [{ label: "Vezi documentele", href: "/jarvis?tab=documente" }],
    };
  }

  if (/(pregateste|pregatire|ziua pompierilor|13 sept|iosif|anului scolar|canva)/.test(q)) {
    const hit =
      snapshot.upcoming.find((item) => foldRo(item.title).includes("pompier")) ||
      snapshot.upcoming.find((item) => foldRo(question).split(/\s+/).some((word) => word.length > 4 && foldRo(item.title).includes(word))) ||
      snapshot.upcoming[0];

    if (!hit) {
      return {
        id: createId(),
        role: "assistant",
        text: "Nu am o activitate calendaristică pe care să o pregătesc. Importă întâi Calendarul IGSU (ISU DB) în Calendar activități.",
        actions: [{ label: "Calendar activități", href: "/calendar-activitati" }],
      };
    }

    return {
      id: createId(),
      role: "assistant",
      text: preparePack(hit.title, hit.dateLabel),
      actions: [
        { label: "Deschide activitatea", href: "/calendar-activitati" },
        { label: "Creează BICP", href: "/creaza-BICP" },
      ],
    };
  }

  if (/(monitorizare|presa|negativ|alerta)/.test(q)) {
    const negatives = snapshot.media.filter((item) => item.sentiment === "defavorabil");
    return {
      id: createId(),
      role: "assistant",
      text: lines([
        snapshot.counts.mediaToday
          ? "Monitorizarea de astăzi are înregistrări."
          : "Nu am găsit revista presei pentru astăzi.",
        negatives.length
          ? `Alerte:\n${negatives.map((item) => `• ${item.title}`).join("\n")}`
          : "Nicio apariție negativă în ultimele înregistrări încărcate.",
      ]),
      actions: [{ label: "Monitorizare", href: "/monitorizare/lista" }],
    };
  }

  return {
    id: createId(),
    role: "assistant",
    text: lines([
      "Citesc doar datele din Portal IRP, nu inventez termene sau articole.",
      upcomingList(snapshot, 3),
      snapshot.counts.foiaOpen ? `544 deschise: ${snapshot.counts.foiaOpen}.` : null,
      "Poți întreba: „Ce am azi?”, „Ce e restant?”, „Ce 544 expiră?”, „Câte comunicate am luna aceasta?”, „Pregătește 13 septembrie”.",
    ]),
  };
}
