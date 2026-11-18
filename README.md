Portal IRP – BICP & OZU

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Env required in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Routes:
- `/login` (public)
- `/creaza-BICP` (protected)
- `/lista-BICP` (protected, default landing)
- `/panou-principal` (protected)
- `/mape-presa/creeaza` (protected, admin only)
- `/mape-presa/lista` (protected, admin only)

APIs for document generation:
- POST `/api/generate/docx` { title, content }
- POST `/api/generate/pdf` { title, content }
- POST `/api/press-kit` (admin only, `Authorization: Bearer <idToken>`)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Ghid de comunicare

Pagina `/ghid-comunicare`, disponibilă în meniul tuturor conturilor IRP autentificate,
este comună între județe și structuri. Include situații, răspunsuri suplimentare și
completări, categorii comune și favorite sincronizate pe cont. Drepturile de autor se aplică UID-ului contului Firebase; conturile
comune unei structuri au aceeași identitate de autor și aceeași listă de favorite.

Datele sunt în colecția globală `GhidComunicare/{id}` și subcolecția
`Completari/{id}`. Ghidul folosește SDK-ul Firebase din browser și sesiunea
Firebase a utilizatorului. Regulile Firestore verifică profilul IRP, autorul
conținutului și actualizarea contorului în aceeași tranzacție cu publicarea
sau ștergerea unei completări. O situație poate avea până la cinci categorii.
Documentele existente apar la „Fără categorie” până când autorul le încadrează.

### Reguli Firestore înainte de lansare

Integrează regulile dedicate ghidului din `firestore.rules` în regulile active
înainte de a publica aplicația. Exclude `GhidComunicare`, `GhidComunicareCategorii` și
`GhidComunicareFavorite` din regulile generale permisive, inclusiv pentru subcolecții, deoarece o regulă mai largă poate acorda
acces independent de regulile dedicate.

### Verificare locală izolată

Necesită Java, Firebase CLI și Google Chrome disponibile local:

```bash
FIREBASE_EMULATORS_PATH="$PWD/.firebase-emulators" npm run test:guide
npm run build
npx tsc --noEmit
```

Suita pornește Auth (9098), Firestore (8088) și Next.js (3017), exclusiv pentru
proiectul `demo-irp-guide`. Verifică SDK-ul client, regulile, concurența și
interfața pe desktop și la 360 px; datele de test sunt create numai în emulator.
Variabila `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` este destinată exclusiv
acestor teste și necesită un proiect cu prefixul `demo-`.

Căutarea normalizată se execută pe server peste colecția completă, în loturi,
cu rezultate paginate câte 20. Pentru volume mari, acest mecanism implică
citiri proporționale cu documentele parcurse; nu se folosește un serviciu extern
de căutare și nu se aplică un plafon care să elimine rezultate.
