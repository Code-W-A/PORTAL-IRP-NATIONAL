import type { Procedure } from "@/lib/proceduri-lucru/types";

export const procedures: Procedure[] = [
  {
    slug: "decontare-servicii-turistice-2026",
    title: "Decontarea serviciilor turistice – Concediu de odihnă (2026)",
    summary:
      "Condițiile, documentele și termenele pentru decontarea serviciilor turistice aferente concediului de odihnă în anul 2026.",
    category: "Resurse umane",
    status: "active",
    updatedAt: "2026-02-09",
    tags: ["concediu", "turism", "decont", "financiar"],
    contentMarkdown: `## Scop
Prezenta procedură stabilește condițiile, documentele și termenele pentru decontarea serviciilor turistice aferente concediului de odihnă, în anul 2026.

## Eligibilitate
Decontarea se acordă personalului MAI care îndeplinește cumulativ următoarele condiții:
- salariul net / solda netă este de maximum **6.000 lei** în luna prestării serviciilor turistice.

## Plafon
- Decontarea se acordă în limita **800 lei / an**, indiferent de valoarea totală a serviciilor.
- Se aplică plafonul de **33%** prevăzut de Codul fiscal.

## Servicii eligibile
Se pot deconta următoarele servicii:
- cazare (obligatoriu minimum o noapte)
- alimentație publică
- transport
- tratament balnear
- agrement

## Furnizori eligibili
- structuri de primire turistică **clasificate din România**
- agenții de turism **licențiate**

## Restricții
Nu se decontează:
- cheltuieli de transport la și de la concediu
- servicii turistice efectuate în spațiile MAI (ex: Meridian Mamaia, Turist Predeal etc.)

## Documente necesare
- raport de concediu aprobat (din E-pontaj)
- facturi emise pe numele solicitantului
- dovada plății (bon fiscal + chitanță sau extras de cont)
- pentru bonurile de masă: factură obligatorie
- dacă factura este achitată de soț/soție/copil: documente doveditoare (certificat de căsătorie / naștere)

## Termene
- până pe **5** ale lunii: transmiterea documentelor la financiar
- până pe **20**: verificarea și întocmirea decontului
- până la finalul lunii: aprobarea comandantului
- plata se efectuează odată cu salariul

## Observații
Serviciile turistice efectuate în anul 2025 nu se reportează ca drept pentru anul 2026. Acestea pot fi decontate în 2026 doar dacă au fost efectuate în 2025 și există documente justificative.`,
    steps: [
      { id: "verificare-eligibilitate-salariala", title: "Verificarea eligibilității salariale" },
      { id: "colectare-documente-justificative", title: "Colectarea documentelor justificative" },
      { id: "verificare-furnizor", title: "Verificarea furnizorului" },
      { id: "transmitere-documente-data-5", title: "Transmiterea documentelor până pe data de 5" },
      { id: "verificare-financiar", title: "Verificarea de către financiar" },
      { id: "intocmire-decont", title: "Întocmirea decontului" },
      { id: "aprobare-comandant", title: "Aprobarea comandantului" },
      { id: "includere-plata-salariala", title: "Includerea sumei în plata salarială" },
    ],
  },
  {
    slug: "flux-financiar-decont-turism",
    title: "Flux financiar – verificare și aprobare decont servicii turistice",
    summary: "Fluxul financiar pentru verificarea, întocmirea și aprobarea deconturilor de servicii turistice.",
    category: "Financiar",
    status: "active",
    updatedAt: "2026-02-09",
    tags: ["financiar", "decont", "verificare", "aprobare"],
    contentMarkdown: `## Scop
Procedura descrie fluxul financiar de verificare, întocmire și aprobare a deconturilor pentru servicii turistice.

## Actori implicați
- solicitant
- compartiment financiar
- comandantul unității

## Etape ale fluxului
### Depunerea documentelor
Solicitantul transmite documentele complete până la data de 5 a lunii.

### Verificarea financiară
Compartimentul financiar verifică:
- eligibilitatea solicitantului
- corectitudinea documentelor
- respectarea plafonului anual
- furnizorii eligibili

### Întocmirea decontului
Decontul se întocmește până la data de 20 a lunii.

### Aprobarea
Decontul este supus aprobării comandantului până la finalul lunii.

### Plata
Suma aprobată se achită odată cu salariul.

## Situații de respingere
- documente incomplete
- depășirea plafonului
- furnizori neeligibili
- neîndeplinirea condițiilor de eligibilitate`,
    steps: [
      { id: "primire-documente", title: "Primire documente" },
      { id: "verificare-eligibilitate", title: "Verificare eligibilitate" },
      { id: "verificare-plafon", title: "Verificare plafon" },
      { id: "verificare-furnizor", title: "Verificare furnizor" },
      { id: "intocmire-decont", title: "Întocmire decont" },
      { id: "aprobare-comandant", title: "Aprobare comandant" },
      { id: "transmitere-la-plata", title: "Transmitere la plată" },
    ],
  },
  {
    slug: "decontare-taxe-cresa",
    title: "Decontarea taxelor de creșă",
    summary: "Reguli, documente și flux de aprobare pentru decontarea taxelor de creșă.",
    category: "Resurse umane",
    status: "active",
    updatedAt: "2026-02-09",
    tags: ["copii", "cresa", "decont", "beneficii"],
    contentMarkdown: `## Scop
Procedura reglementează decontarea taxelor de creșă, în condițiile legii.

## Condiții generale
- solicitantul trebuie să fie personal MAI
- decontarea se acordă în limita valorică stabilită prin actele normative în vigoare

## Documente necesare
- cerere de decontare
- dovada plății taxei de creșă
- documente privind înscrierea copilului

## Flux de aprobare
- verificare documente
- validare financiară
- aprobare conducere
- includere la plată`,
    steps: [
      { id: "depunere-cerere", title: "Depunere cerere" },
      { id: "verificare-documente", title: "Verificare documente" },
      { id: "verificare-plafon", title: "Verificare plafon" },
      { id: "aprobare", title: "Aprobare" },
      { id: "efectuare-plata", title: "Efectuare plată" },
    ],
  },
  {
    slug: "gestionare-munca-suplimentara",
    title: "Gestionarea muncii suplimentare",
    summary: "Reguli pentru compensarea și evidența muncii suplimentare.",
    category: "Resurse umane",
    status: "active",
    updatedAt: "2026-02-09",
    tags: ["ore suplimentare", "timp liber", "plata"],
    contentMarkdown: `## Principii generale
Munca suplimentară se compensează prioritar cu timp liber corespunzător.

## Plata în bani
Plata muncii suplimentare se face doar:
- cu aprobare scrisă
- în limita a maximum 360 ore/an

## Evidență
Orele suplimentare se evidențiază distinct și se aprobă conform procedurilor interne.`,
    steps: [
      { id: "inregistrare-ore-suplimentare", title: "Înregistrare ore suplimentare" },
      { id: "solicitare-compensare", title: "Solicitare compensare" },
      { id: "aprobare-timp-liber-sau-plata", title: "Aprobare timp liber sau plată" },
      { id: "evidentiere-finala", title: "Evidențiere finală" },
    ],
  },
  {
    slug: "concedii-medicale-2026",
    title: "Gestionarea concediilor medicale – reguli aplicabile din 01.02.2026",
    summary: "Reguli aplicabile din 01.02.2026 pentru concediile medicale ale personalului civil.",
    category: "Resurse umane",
    status: "active",
    updatedAt: "2026-02-09",
    tags: ["medical", "concediu", "reglementari"],
    contentMarkdown: `## Domeniu de aplicare
Prezenta procedură se aplică personalului civil. Nu se aplică polițiștilor și militarilor, care au regim separat.

## Reguli de plată
- plata concediului medical se face cu diminuare de 1 zi
- zilele 2–6 sunt suportate de angajator
- restul perioadei este suportată din bugetul FNUASS

## Observații
Aplicabilitate începând cu data de 01.02.2026.`,
    steps: [
      { id: "depunere-certificat-medical", title: "Depunere certificat medical" },
      { id: "verificare-eligibilitate", title: "Verificare eligibilitate" },
      { id: "calcul-drepturi", title: "Calcul drepturi" },
      { id: "includere-la-plata", title: "Includere la plată" },
    ],
  },
  {
    slug: "comunicare-publica-incendii-potential-litigios",
    title: "Comunicare publică în cazul incendiilor cu potențial litigios",
    summary:
      "Procedură generală pentru comunicarea operativă, fără antepronunțări și fără expunere juridică.",
    category: "Comunicare publică",
    status: "active",
    updatedAt: "2026-02-10",
    tags: ["incendiu", "comunicare", "purtător de cuvânt", "litigios", "ro-alert"],
    contentMarkdown: `## Scop
Procedura asigură informarea corectă a publicului fără afectarea cercetărilor ulterioare, fără antepronunțări și fără expunerea instituției sau a personalului la riscuri juridice.

## Domeniu de aplicare
Se aplică în cazul incendiilor produse la:
- hale industriale
- spații de producție
- depozite
- operatori economici

Se aplică cu prioritate în situații cu:
- pagube materiale semnificative
- intervenții interjudețene
- transmitere RO-ALERT
- suspiciuni de natură penală
- potențial litigios (victime, angajați, asigurări, anchete)

## Principii de bază ale comunicării
Purtătorul de cuvânt comunică exclusiv:
- fapte constatate operativ
- măsuri întreprinse de forțele de intervenție
- informații de interes public imediat

Nu se comunică:
- cauze
- vinovății
- ipoteze
- elemente tehnice ce țin de expertiză
- detalii ce pot influența anchete sau litigii

## Structura standard a comunicatului (obligatorie)
### A. Date factuale minime
- data și ora intervenției
- localitatea și județul
- tipul obiectivului (hală, depozit etc.)

### B. Forțe și mijloace
- numărul de autospeciale de stingere
- menționarea ambulanțelor separat
- alte instituții implicate (fără detalii operative)

Regulă:
- separare clară între autospeciale de stingere, ambulanțe și alte structuri

### C. Situația la sosirea echipajelor
- stadiul incendiului (localizat / generalizat)
- degajări de fum și risc de propagare
- măsuri de protecție pentru zonele învecinate

### D. Măsuri pentru protecția populației
- menționarea RO-ALERT, dacă a fost emis
- recomandări generale de autoprotecție și evitare a zonei

### E. Stadiul intervenției
- "incendiul a fost lichidat" sau
- "se acționează pentru localizare și lichidare"

### F. Victime
- "Nu au fost identificate victime." sau
- date strict medicale confirmate, după caz

## Reguli speciale privind conținutul sensibil
### Materiale, substanțe, produse
Nu se menționează explicit:
- vopsele
- diluanți
- combustibili
- substanțe inflamabile
- gaze
- solvenți
- denumiri comerciale

Se utilizează formularea neutră:
> "au fost identificate materiale combustibile specifice activității desfășurate"

### Cauza incendiului
Sunt interzise formulări de tipul:
- "incendiul a fost provocat de..."
- "a izbucnit din cauza..."
- "se presupune că..."

Formulare corectă:
> "Cauza incendiului urmează a fi stabilită de structurile abilitate."

### Responsabilități și vinovății
Nu se menționează:
- operatorul economic ca vinovat
- sugestii privind nerespectarea normelor
- corelări cu autorizații sau avize

## Corelarea cu investigațiile ulterioare
În situații cu solicitări ulterioare de documente, cereri ale persoanelor implicate sau acțiuni în instanță:
- comunicarea publică nu se completează retroactiv
- comunicatul rămâne act de informare operativă, distinct de documentele tehnice

## Principiul protecției purtătorului de cuvânt
Purtătorul de cuvânt:
- comunică instituțional, nu personal
- se limitează la informații confirmate
- respectă separația dintre informare publică și cercetare tehnică

Această abordare:
- protejează instituția
- protejează purtătorul de cuvânt
- protejează ancheta
- respectă dreptul la informare

## Formulă de siguranță (recomandată)
În caz de dubiu:
> "Pentru informarea publicului, comunicăm datele operative privind intervenția. Aspectele tehnice și cauza incendiului fac obiectul unor proceduri distincte, potrivit legii."`,
    steps: [
      { id: "incadrare-caz-litigios", title: "Încadrarea cazului cu potențial litigios" },
      { id: "colectare-date-factuale-minime", title: "Colectarea datelor factuale minime" },
      { id: "separare-forte-si-mijloace", title: "Separarea clară a forțelor și mijloacelor" },
      { id: "redactare-situatie-operativa", title: "Redactarea situației operative și a măsurilor pentru populație" },
      { id: "validare-fara-cauze-si-vinovatii", title: "Validarea comunicatului fără cauze, ipoteze sau vinovății" },
      { id: "introducere-formulari-standard", title: "Introducerea formulărilor standard pentru stadiu și victime" },
      { id: "publicare-informare-institutionala", title: "Publicarea informării instituționale" },
      { id: "mentinere-fara-completari-retroactive", title: "Menținerea comunicatului fără completări retroactive" },
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
