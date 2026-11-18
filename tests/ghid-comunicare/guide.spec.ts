import { test, expect, type Page } from "@playwright/test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { deleteApp as deleteClientApp, initializeApp as initializeClientApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore as getClientFirestore, setDoc, terminate, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import { GuideService } from "../../lib/ghid-comunicare/service";
import { randomUUID } from "node:crypto";
import { UNCATEGORIZED } from "../../lib/ghid-comunicare/types";
import { searchText } from "../../lib/ghid-comunicare/validation";

const PROJECT = "demo-irp-guide";
if (process.env.GCLOUD_PROJECT !== PROJECT || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Testele ghidului sunt permise numai în proiectul demo cu ambele emulatoare active.");
}
const app = initializeApp({ projectId: PROJECT }, "guide-tests");
const auth = getAuth(app);
const db = getFirestore(app);
const password = "Guide-test-123!";
const users = [
  { uid: "guide-author", email: "author@example.test", displayName: "Autor test", judetId: "DB", structuraId: "ISU" },
  { uid: "guide-colleague", email: "colleague@example.test", displayName: "", judetId: "B", structuraId: "ISU" },
  { uid: "guide-no-profile", email: "noprofile@example.test", displayName: "", judetId: "", structuraId: "" },
];
const clients: { app: FirebaseApp; db: Firestore; guide?: GuideService }[] = [];
const seededIds: string[] = [];
async function makeClient(index?: number) {
  const clientApp = initializeClientApp({ projectId: PROJECT, apiKey: "demo-api-key" }, `guide-client-${index}`);
  const clientAuth = getClientAuth(clientApp);
  connectAuthEmulator(clientAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const clientDb = getClientFirestore(clientApp);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  connectFirestoreEmulator(clientDb, host, Number(port));
  const user = index === undefined ? null : (await signInWithEmailAndPassword(clientAuth, users[index].email, password)).user;
  clients.push({ app: clientApp, db: clientDb, guide: user ? new GuideService(clientDb, user) : undefined });
}
const create = (index = 0, question = "Întrebare de test", answer = "Răspuns verificat") =>
  clients[index].guide!.create({ id: randomUUID(), question, answer, followUps: [] });
async function login(page: Page, index = 0) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(users[index].email);
  await page.getByLabel("Parolă", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Intră", exact: true }).click();
  await page.waitForURL("**/lista-BICP");
  await page.goto("/ghid-comunicare");
  await expect(page.getByRole("heading", { name: "Ghid de comunicare", exact: true })).toBeVisible();
  await expect(page.getByText("Se încarcă situațiile…")).toHaveCount(0);
}

test.beforeAll(async () => {
  await Promise.all(["GhidComunicare", "GhidComunicareCategorii", "GhidComunicareFavorite"]
    .map(name => db.recursiveDelete(db.collection(name))));
  for (const user of users) {
    await auth.deleteUser(user.uid).catch(() => {});
    await auth.createUser({ uid: user.uid, email: user.email, password, ...(user.displayName ? { displayName: user.displayName } : {}) });
    if (user.judetId) {
      await db.doc(`users/${user.uid}`).set({ judetId: user.judetId, structuraId: user.structuraId });
      await db.doc(`Judete/${user.judetId}/Structuri/${user.structuraId}`).set({ isAdmin: user.judetId === "DB" });
      await db.doc(`Judete/${user.judetId}/Structuri/${user.structuraId}/Settings/general`).set({ structureDisplay: `ISU ${user.judetId}` });
    }
    await makeClient(users.indexOf(user));
  }
  await makeClient();
  const batch = db.batch();
  for (let i = 0; i < 125; i++) {
    const id = randomUUID(); seededIds.push(id);
    const draft = { question: `Situație mobilă ${String(i).padStart(3, "0")}`, answer: i === 124 ? "Informații confirmate despre intervenția întârziată." : `Răspuns principal ${i}.\nDoar informații confirmate.`,
      followUps: i === 124 ? [{ question: "Dar despre întârziere ce știți?", answer: "Revenim după verificarea informațiilor." }] : [] };
    const now = new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString();
    batch.set(db.collection("GhidComunicare").doc(id), { ...draft, author: { uid: users[0].uid, name: "Autor test" },
      status: "active", completionCount: 0, createdAt: now, updatedAt: now, searchText: searchText(draft) });
  }
  // Put the diacritic/continuation match beyond the first complete scan batch.
  batch.update(db.collection("GhidComunicare").doc(seededIds[124]), { updatedAt: "2024-01-01T00:00:00.000Z" });
  await batch.commit();
});

test.afterAll(async () => {
  await Promise.all(clients.map(async client => { await terminate(client.db); await deleteClientApp(client.app); }));
  await db.terminate();
  await deleteApp(app);
});

test("SDK: validation, pagination and full-collection search", async () => {
  const author = clients[0].guide!;
  const colleague = clients[1].guide!;
  await expect(author.create({ id: randomUUID(), question: " ", answer: "x", followUps: [] })).rejects.toMatchObject({ status: 400 });
  await expect(author.create({ id: randomUUID(), question: "x", answer: "y", followUps: [{ question: "fără răspuns", answer: "" }] })).rejects.toMatchObject({ status: 400 });
  const first = await author.list("", null);
  expect(first.items).toHaveLength(20);
  expect(first.items.some(item => item.id === seededIds[124])).toBe(false);
  for (const q of ["INTARZIATA", "intarziere", "verificarea informatiilor", "interventia confirmate"]) {
    const result = await colleague.list(q, null);
    expect(result.items.some(item => item.id === seededIds[124])).toBe(true);
  }
  const seen = new Set(first.items.map(item => item.id));
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await author.list("", cursor);
    for (const item of next.items) { expect(seen.has(item.id)).toBe(false); seen.add(item.id); }
    cursor = next.nextCursor;
  }
  expect(seen.size).toBe(125);
  await expect(author.list("", "invalid")).rejects.toMatchObject({ status: 400 });
});

test("SDK: cross-structure collaboration, ownership and retry-safe publication", async () => {
  const author = clients[0].guide!;
  const colleague = clients[1].guide!;
  const id = randomUUID();
  const payload = { id, question: "Acces comun", answer: "Text inițial", followUps: [] };
  const pair = await Promise.all([author.create(payload), author.create(payload)]);
  expect(pair.map(item => item.id)).toEqual([id, id]);
  expect((await colleague.get(id)).author).toEqual({ uid: users[0].uid, name: "Autor test" });
  await expect(colleague.update(id, payload)).rejects.toMatchObject({ status: 403 });
  await expect(colleague.withdraw(id)).rejects.toMatchObject({ status: 403 });
  const completionId = randomUUID();
  const completion = { id: completionId, text: "Observație de la coleg" };
  await Promise.all([colleague.createCompletion(id, completion), colleague.createCompletion(id, completion)]);
  expect((await author.get(id)).completionCount).toBe(1);
  expect((await author.completions(id, null)).items[0].author.name).toBe("ISU B");
  const authorCompletion = { id: randomUUID(), text: "Completarea autorului" };
  const colleagueCompletion = { id: randomUUID(), text: "A doua completare a colegului" };
  await Promise.all([author.createCompletion(id, authorCompletion), colleague.createCompletion(id, colleagueCompletion)]);
  expect((await author.get(id)).completionCount).toBe(3);
  await Promise.all([author.changeCompletion(id, authorCompletion.id), colleague.changeCompletion(id, colleagueCompletion.id)]);
  expect((await author.get(id)).completionCount).toBe(1);
  await expect(author.changeCompletion(id, completionId, { text: "text modificat" })).rejects.toMatchObject({ status: 403 });
  await expect(author.changeCompletion(id, completionId)).rejects.toMatchObject({ status: 403 });
  await colleague.changeCompletion(id, completionId, { text: "Completare corectată" });
  const followUps = Array.from({ length: 30 }, (_, index) => ({ question: `Întrebarea ${index}`, answer: "Răspuns" }));
  const edited = await author.update(id, { ...payload, question: "Întrebare actualizată", followUps });
  expect(edited.followUps).toEqual(followUps);
  await author.withdraw(id);
  expect(await colleague.get(id)).toMatchObject({ status: "withdrawn", question: "", answer: "", followUps: [], completionCount: 1 });
  expect((await db.doc(`GhidComunicare/${id}`).get()).data()?.searchText).toBe("");
  expect((await colleague.completions(id, null)).items[0].text).toBe("Completare corectată");
  await expect(colleague.createCompletion(id, { id: randomUUID(), text: "nou" })).rejects.toMatchObject({ status: 409 });
  await colleague.changeCompletion(id, completionId, { text: "Corectată după retragere" });
  await colleague.changeCompletion(id, completionId);
  expect((await author.get(id)).completionCount).toBe(0);
});

test("SDK: simultaneous completion publication and withdrawal preserves every accepted completion", async () => {
  const author = clients[0].guide!;
  const colleague = clients[1].guide!;
  const item = await create();
  const [published, withdrawn] = await Promise.allSettled([
    colleague.createCompletion(item.id, { id: randomUUID(), text: "Completare concurentă" }),
    author.withdraw(item.id),
  ]);
  expect(withdrawn.status).toBe("fulfilled");
  if (published.status === "rejected") expect(published.reason).toMatchObject({ status: 409 });
  const result = await author.get(item.id);
  const comments = await author.completions(item.id, null);
  expect(result.status).toBe("withdrawn");
  expect(result.completionCount).toBe(comments.items.length);
  expect(comments.items.length).toBe(published.status === "fulfilled" ? 1 : 0);
});

test("Firestore rules: direct access follows profile and ownership and keeps the count atomic", async () => {
  const [author, colleague, noProfile, anonymous] = clients.map(client => client.db);
  const id = seededIds[0];
  const situationRef = (client: Firestore) => doc(client, "GhidComunicare", id);
  const completionId = randomUUID();
  const now = new Date().toISOString();
  const completion = { text: "Completare", author: { uid: users[1].uid, name: "ISU B" }, createdAt: now, updatedAt: now };
  for (const client of [noProfile, anonymous]) {
    await expect(getDocFromServer(situationRef(client))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(getDocFromServer(doc(situationRef(client), "Completari", completionId))).rejects.toMatchObject({ code: "permission-denied" });
  }
  expect((await getDocFromServer(situationRef(colleague))).exists()).toBe(true);
  await expect(updateDoc(situationRef(colleague), { question: "Modificare nepermisă" })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(updateDoc(situationRef(author), { "author.uid": users[1].uid })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(updateDoc(situationRef(author), { followUps: [{ question: "Lipsește răspunsul" }] })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(updateDoc(situationRef(author), { completionCount: 1, completionChangeId: completionId })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(setDoc(doc(situationRef(colleague), "Completari", completionId), completion)).rejects.toMatchObject({ code: "permission-denied" });

  const folded = writeBatch(colleague);
  folded.update(situationRef(colleague), { completionCount: 1, completionChangeId: completionId });
  folded.set(doc(situationRef(colleague), "Completari", completionId), { ...completion, author: { uid: users[0].uid, name: "Alt autor" } });
  await expect(folded.commit()).rejects.toMatchObject({ code: "permission-denied" });

  await clients[1].guide!.createCompletion(id, { id: completionId, text: completion.text });
  const authorCompletionRef = doc(situationRef(author), "Completari", completionId);
  await expect(updateDoc(authorCompletionRef, { text: "Modificare nepermisă" })).rejects.toMatchObject({ code: "permission-denied" });
  await clients[1].guide!.changeCompletion(id, completionId);

  expect((await getDocFromServer(doc(anonymous, "users", users[0].uid))).exists()).toBe(true);
  await expect(setDoc(doc(anonymous, "GuideRulesProbe", "probe"), {})).rejects.toMatchObject({ code: "permission-denied" });
  await expect(setDoc(doc(author, "GuideRulesProbe", "probe"), {})).resolves.toBeUndefined();
});

test("SDK: shared categories, private favorites and composed filters", async () => {
  const author = clients[0].guide!;
  const colleague = clients[1].guide!;
  const [category, duplicate] = await Promise.all([
    author.createCategory("  Comunicare   Operativă "),
    colleague.createCategory("comunicare operativa"),
  ]);
  expect(duplicate).toEqual(category);
  const other = await colleague.createCategory("Informare locală");
  const id = randomUUID();
  const draft = { id, question: "Întrebare încadrată", answer: "Răspuns comun", followUps: [], categoryIds: [category.id, other.id] };
  const saved = await author.create(draft);
  expect(saved.categoryIds).toEqual(draft.categoryIds);
  expect((await colleague.list("încadrată", null, undefined, other.id)).items.map(item => item.id)).toEqual([id]);
  expect((await colleague.list("încadrată", null, undefined, UNCATEGORIZED)).items).toEqual([]);
  expect((await colleague.get(seededIds[0])).categoryIds).toEqual([]);

  const categoryRef = doc(clients[0].db, "GhidComunicareCategorii", category.id);
  await expect(updateDoc(categoryRef, { name: "Redenumire" })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(getDocFromServer(doc(clients[3].db, categoryRef.path))).rejects.toMatchObject({ code: "permission-denied" });
  await expect(author.update(id, { ...draft, categoryIds: ["0".repeat(64)] })).rejects.toMatchObject({ code: "permission-denied" });
  await expect(updateDoc(doc(clients[1].db, "GhidComunicare", id), { categoryIds: [] })).rejects.toMatchObject({ code: "permission-denied" });
  const extra = await Promise.all(["Convocări", "Evenimente", "Anunțuri"].map(name => author.createCategory(name)));
  const allIds = [...draft.categoryIds, ...extra.map(item => item.id)];
  const largestDraft = { ...draft, categoryIds: allIds, followUps: Array.from({ length: 30 }, () => ({ question: "Întrebare", answer: "Răspuns" })) };
  await expect(author.create({ ...largestDraft, id: randomUUID() })).resolves.toMatchObject({ categoryIds: allIds });
  await expect(author.update(id, { ...largestDraft, categoryIds: [other.id] })).resolves.toMatchObject({ categoryIds: [other.id] });

  await Promise.all([author.setFavorite(id, true), author.setFavorite(id, true)]);
  const privatePath = `GhidComunicareFavorite/${users[0].uid}/Situatii/${id}`;
  expect((await getDocFromServer(doc(clients[0].db, privatePath))).exists()).toBe(true);
  await expect(getDocFromServer(doc(clients[1].db, privatePath))).rejects.toMatchObject({ code: "permission-denied" });
  await expect(setDoc(doc(clients[1].db, privatePath), {})).rejects.toMatchObject({ code: "permission-denied" });
  expect((await author.listFavorites([id], "încadrată", other.id, null)).items.map(item => item.id)).toEqual([id]);
  await author.setFavorite(id, false);
  expect((await getDocFromServer(doc(clients[0].db, privatePath))).exists()).toBe(false);
});

test("desktop: split view, complete clipboard, category filters and account favorite sync", async ({ page, context, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const author = clients[0].guide!;
  const category = await author.createCategory("Mesaje publice");
  const answer = "Răspuns confirmat. ".repeat(45).trim();
  const record = await author.create({
    id: randomUUID(), question: "Mesaj pentru presă", answer, categoryIds: [category.id],
    followUps: [{ question: "Ce urmează mâine?", answer: "Așteptăm confirmarea." }],
  });
  await login(page);
  await page.getByLabel("Filtrează după categorie").selectOption(category.id);
  const search = page.getByRole("searchbox", { name: "Ce te-a întrebat?" });
  await search.fill("urmează mâine");
  const card = page.getByRole("article").filter({ has: page.getByRole("link", { name: /Mesaj pentru presă/ }) });
  await expect(card.getByText(/Întrebare suplimentară.*Ce urmează mâine/)).toBeVisible();
  await card.getByRole("button", { name: "Copiază răspunsul" }).click();
  await expect(card.getByRole("button", { name: "Copiat", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(answer);
  await card.getByRole("link", { name: /Mesaj pentru presă/ }).click();
  await expect(page.getByLabel("Situația selectată")).toBeVisible();
  await expect(search).toHaveValue("urmează mâine");
  expect(new URL(page.url()).pathname).toBe("/ghid-comunicare");
  expect(new URL(page.url()).searchParams.get("situatie")).toBe(record.id);
  await expect(page.getByRole("button", { name: /Vezi completările/ })).toHaveCount(0);

  const otherContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
  try {
    const otherPage = await otherContext.newPage();
    await login(otherPage);
    await otherPage.getByRole("button", { name: "Favoritele mele" }).click();
    await expect(otherPage.getByText("Nu ai încă situații favorite.")).toBeVisible();
    await card.getByRole("button", { name: "Adaugă la favorite" }).click();
    await expect(otherPage.getByRole("link", { name: /Mesaj pentru presă/ })).toBeVisible();
    await page.getByRole("button", { name: "Favoritele mele" }).click();
    await expect(card).toBeVisible();
    await page.getByLabel("Filtrează după categorie").selectOption(UNCATEGORIZED);
    await expect(page.getByRole("button", { name: "Favoritele mele" })).toHaveAttribute("aria-pressed", "true");
    await expect(card).toHaveCount(0);
    await page.getByLabel("Filtrează după categorie").selectOption(category.id);
    await expect(card).toBeVisible();
    await otherPage.getByRole("button", { name: "Scoate din favorite" }).click();
    await expect(card).toHaveCount(0);
  } finally {
    await otherContext.close();
  }

  await page.getByRole("button", { name: "Toate situațiile" }).click();
  await card.getByRole("link", { name: /Mesaj pentru presă/ }).click();
  await expect(page.getByLabel("Situația selectată").getByText("Ce urmează mâine?")).toBeVisible();
  await page.screenshot({ path: "test-results/guide-desktop.png", fullPage: true });
});

test("mobile: menu, search beyond first page, main and follow-up copy, colleague contribution", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, 1);
  await page.getByRole("button", { name: "Deschide meniul" }).click();
  await expect(page.getByRole("link", { name: "Ghid de comunicare", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ghid de comunicare", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Ce te-a întrebat?" });
  await expect(input).not.toBeFocused();
  await input.fill("INTARZIERE");
  await page.getByRole("link", { name: /Situație mobilă 124/ }).click();
  await expect(page.getByText("Informații confirmate despre intervenția întârziată.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opțiuni situație" })).toHaveCount(0);
  await page.getByRole("button", { name: "Copiază răspunsul", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Răspuns copiat");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Informații confirmate despre intervenția întârziată.");
  await page.locator("summary", { hasText: "Dar despre întârziere" }).click();
  await page.getByRole("button", { name: "Copiază răspunsul", exact: true }).nth(1).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Revenim după verificarea informațiilor.");
  await page.getByRole("button", { name: "Adaugă o completare" }).click();
  await page.getByLabel("Ce ai adăuga?", { exact: true }).fill("Completare introdusă de pe telefon.");
  await page.getByRole("button", { name: "Publică completarea" }).click();
  await expect(page.getByText("Completare introdusă de pe telefon.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Completările colegilor (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editează", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/guide-mobile-detail.png", fullPage: true });
  await page.getByRole("link", { name: "← Înapoi" }).click();
  await expect(input).toHaveValue("INTARZIERE");
  expect(new URL(page.url()).searchParams.get("q")).toBe("INTARZIERE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile: restore loaded rows and scroll after opening a situation", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Arată mai multe", exact: true }).click();
  const card = page.getByRole("link", { name: /Situație mobilă 090/ });
  await card.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(100);
  await card.click();
  await expect(page.getByRole("heading", { name: "Situație mobilă 090" })).toBeVisible();
  await page.getByRole("link", { name: "← Înapoi" }).click();
  await expect(card).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore - 100);
});

test("mobile: empty search prefill, error retains text, minimal form and follow-up editing", async ({ page }) => {
  await login(page);
  await page.getByRole("searchbox").fill("Întrebarea fără rezultat unic");
  await expect(page.getByText("Nu am găsit această situație.")).toBeVisible();
  await page.getByRole("link", { name: "Adaugă o situație", exact: true }).last().click();
  await expect(page.getByLabel("Întrebarea", { exact: true })).toHaveValue("Întrebarea fără rezultat unic");
  const answerField = page.getByLabel("Răspunsul propus", { exact: true });
  const initialHeight = await answerField.evaluate(input => input.clientHeight);
  await answerField.fill("Răspuns scris pe telefon.\n".repeat(8));
  await expect.poll(() => answerField.evaluate(input => input.clientHeight)).toBeGreaterThan(initialHeight);
  await answerField.fill("Răspuns scris pe telefon.");
  await page.locator("summary", { hasText: "Categorii" }).click();
  const categories = page.getByRole("searchbox", { name: "Caută sau creează o categorie" });
  await categories.fill("Mesaje operative");
  await page.getByRole("button", { name: /Creează „Mesaje operative”/ }).click();
  await expect(page.getByRole("checkbox", { name: "Mesaje operative" })).toBeChecked();
  await categories.fill("Informare preventivă");
  await page.getByRole("button", { name: /Creează „Informare preventivă”/ }).click();
  await expect(page.getByRole("checkbox", { name: "Informare preventivă" })).toBeChecked();
  const transactionRead = "**/*:batchGet*";
  await page.route(transactionRead, route => route.fulfill({
    status: 403, json: { error: { code: 403, status: "PERMISSION_DENIED", message: "Test" } },
  }));
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Contul nu are acces" })).toBeVisible();
  await expect(page.getByLabel("Răspunsul propus", { exact: true })).toHaveValue("Răspuns scris pe telefon.");
  await expect(page.getByRole("button", { name: "Elimină categoria Mesaje operative" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Elimină categoria Informare preventivă" })).toBeVisible();
  await page.unroute(transactionRead);
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Întrebarea fără rezultat unic", exact: true })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").pop();
  const saved = await clients[0].guide!.get(id!);
  expect(saved.followUps).toEqual([]);
  expect(saved.categoryIds).toHaveLength(2);
  await page.getByRole("button", { name: "Opțiuni situație" }).click();
  await page.getByRole("button", { name: "Editează", exact: true }).click();
  await page.getByRole("button", { name: "Adaugă o întrebare suplimentară" }).click();
  await expect(page.getByLabel("Întrebarea suplimentară 1", { exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Salvează", exact: true })).toBeInViewport();
  await page.getByLabel("Întrebarea suplimentară 1", { exact: true }).fill("Dar mai departe?");
  await page.getByLabel("Răspunsul suplimentar 1", { exact: true }).fill("Continuarea răspunsului.");
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.locator("summary", { hasText: "Dar mai departe?" })).toBeVisible();
});

test("mobile: clipboard failure and withdrawal retain colleagues' contributions", async ({ page }) => {
  const item = await create(0, "Situație pentru retragere", "Text care va fi retras");
  const completionId = randomUUID();
  await clients[1].guide!.createCompletion(item.id, { id: completionId, text: "Completare păstrată după retragere." });
  await login(page);
  await page.goto(`/ghid-comunicare/${item.id}`);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } }); });
  await page.getByRole("button", { name: "Copiază răspunsul", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Nu am putut copia răspunsul.");
  expect(await page.getByText("Text care va fi retras", { exact: true }).evaluate(element => getComputedStyle(element).userSelect)).toBe("text");
  await page.getByRole("button", { name: "Opțiuni situație" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Retrage situația", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Situație retrasă de autor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adaugă o completare" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vezi completările (1)", exact: true }).click();
  await expect(page.getByText("Completare păstrată după retragere.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editează", exact: true })).toHaveCount(0);
});
