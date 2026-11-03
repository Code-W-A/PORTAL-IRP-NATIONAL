import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
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
const tokens: string[] = [];
const seededIds: string[] = [];
async function api(request: APIRequestContext, index: number, path = "", method = "GET", data?: unknown) {
  return request.fetch(`/api/ghid-comunicare${path}`, { method, headers: { Authorization: `Bearer ${tokens[index]}` }, ...(data === undefined ? {} : { data }) });
}
async function create(request: APIRequestContext, index = 0, question = "Întrebare de test", answer = "Răspuns verificat", followUps: { question: string; answer: string }[] = []) {
  const response = await api(request, index, "", "POST", { id: randomUUID(), question, answer, followUps });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
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
  await db.recursiveDelete(db.collection("GhidComunicare"));
  for (const user of users) {
    await auth.deleteUser(user.uid).catch(() => {});
    await auth.createUser({ uid: user.uid, email: user.email, password, ...(user.displayName ? { displayName: user.displayName } : {}) });
    if (user.judetId) {
      await db.doc(`users/${user.uid}`).set({ judetId: user.judetId, structuraId: user.structuraId });
      await db.doc(`Judete/${user.judetId}/Structuri/${user.structuraId}`).set({ isAdmin: user.judetId === "DB" });
      await db.doc(`Judete/${user.judetId}/Structuri/${user.structuraId}/Settings/general`).set({ structureDisplay: `ISU ${user.judetId}` });
    }
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password, returnSecureToken: true }),
    });
    const data = await response.json();
    if (!data.idToken) throw new Error("Autentificarea în emulator a eșuat.");
    tokens.push(data.idToken);
  }
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
  await db.terminate();
  await deleteApp(app);
});

test("API: authentication, validation and full-collection search", async ({ request }) => {
  expect((await request.get("/api/ghid-comunicare")).status()).toBe(401);
  expect((await request.get("/api/ghid-comunicare", { headers: { Authorization: "Bearer invalid" } })).status()).toBe(401);
  expect((await api(request, 2)).status()).toBe(403);
  expect((await api(request, 0, "", "POST", { id: randomUUID(), question: " ", answer: "x" })).status()).toBe(400);
  expect((await api(request, 0, "", "POST", { id: randomUUID(), question: "x", answer: "y", followUps: [{ question: "fără răspuns" }] })).status()).toBe(400);
  const first = await (await api(request, 0)).json();
  expect(first.items).toHaveLength(20);
  expect(first.items.some((item: { id: string }) => item.id === seededIds[124])).toBe(false);
  for (const q of ["INTARZIATA", "intarziere", "verificarea informatiilor", "interventia confirmate"]) {
    const response = await api(request, 1, `?q=${encodeURIComponent(q)}`);
    expect(response.status()).toBe(200);
    expect((await response.json()).items.some((item: { id: string }) => item.id === seededIds[124])).toBe(true);
  }
  const seen = new Set(first.items.map((item: { id: string }) => item.id));
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await (await api(request, 0, `?cursor=${encodeURIComponent(cursor)}`)).json();
    for (const item of next.items) { expect(seen.has(item.id)).toBe(false); seen.add(item.id); }
    cursor = next.nextCursor;
  }
  expect(seen.size).toBe(125);
  expect((await api(request, 0, "?cursor=invalid")).status()).toBe(400);
});

test("API: cross-structure collaboration, ownership and retry-safe publication", async ({ request }) => {
  const id = randomUUID();
  const payload = { id, question: "Acces comun", answer: "Text inițial", author: { uid: users[1].uid }, followUps: [] };
  const pair = await Promise.all([api(request, 0, "", "POST", payload), api(request, 0, "", "POST", payload)]);
  expect(pair.every(response => response.status() === 200)).toBe(true);
  const item = await (await api(request, 1, `/${id}`)).json();
  expect(item.author).toEqual({ uid: users[0].uid, name: "Autor test" });
  expect((await api(request, 1, `/${id}`, "PATCH", { question: "atac", answer: "atac" })).status()).toBe(403);
  expect((await api(request, 1, `/${id}`, "DELETE")).status()).toBe(403);
  const completionId = randomUUID();
  const completion = { id: completionId, text: "Observație de la coleg" };
  await Promise.all([api(request, 1, `/${id}/completari`, "POST", completion), api(request, 1, `/${id}/completari`, "POST", completion)]);
  expect((await (await api(request, 0, `/${id}`)).json()).completionCount).toBe(1);
  const comments = await (await api(request, 0, `/${id}/completari`)).json();
  expect(comments.items[0].author.name).toBe("ISU B");
  // The situation's author is an admin structure, but still cannot alter the colleague's text.
  expect((await api(request, 0, `/${id}/completari/${completionId}`, "PATCH", { text: "atac" })).status()).toBe(403);
  expect((await api(request, 0, `/${id}/completari/${completionId}`, "DELETE")).status()).toBe(403);
  expect((await api(request, 1, `/${id}/completari/${completionId}`, "PATCH", { text: "Completare corectată" })).status()).toBe(200);
  expect((await api(request, 0, `/${id}`, "PATCH", { question: "Întrebare actualizată", answer: "Răspuns actualizat" })).status()).toBe(200);
  expect((await api(request, 0, `/${id}`, "DELETE")).status()).toBe(200);
  const retired = await (await api(request, 1, `/${id}`)).json();
  expect(retired).toMatchObject({ status: "withdrawn", question: "", answer: "", followUps: [], completionCount: 1 });
  expect((await db.doc(`GhidComunicare/${id}`).get()).data()?.searchText).toBe("");
  expect((await (await api(request, 1, `/${id}/completari`)).json()).items[0].text).toBe("Completare corectată");
  expect((await api(request, 1, `/${id}/completari`, "POST", { id: randomUUID(), text: "nou" })).status()).toBe(409);
  expect((await api(request, 1, `/${id}/completari/${completionId}`, "PATCH", { text: "Corectată după retragere" })).status()).toBe(200);
  expect((await api(request, 1, `/${id}/completari/${completionId}`, "DELETE")).status()).toBe(200);
  expect((await (await api(request, 0, `/${id}`)).json()).completionCount).toBe(0);
});

test("API: simultaneous completion publication and withdrawal preserves every accepted completion", async ({ request }) => {
  const item = await create(request);
  const id = randomUUID();
  const [published, withdrawn] = await Promise.all([
    api(request, 1, `/${item.id}/completari`, "POST", { id, text: "Completare concurentă" }),
    api(request, 0, `/${item.id}`, "DELETE"),
  ]);
  expect(withdrawn.status()).toBe(200);
  expect([200, 409]).toContain(published.status());
  const result = await (await api(request, 0, `/${item.id}`)).json();
  const comments = await (await api(request, 0, `/${item.id}/completari`)).json();
  expect(result.status).toBe("withdrawn");
  expect(result.completionCount).toBe(comments.items.length);
  expect(comments.items.length).toBe(published.status() === 200 ? 1 : 0);
});

test("Firestore rules: guide and descendants denied to clients; other portal paths retain policy", async () => {
  const root = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
  for (const token of [null, tokens[0], tokens[1]]) {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    for (const path of [`GhidComunicare/${seededIds[0]}`, `GhidComunicare/${seededIds[0]}/Completari/blocked`]) {
      expect((await fetch(`${root}/${path}`, { headers })).status).toBe(403);
      expect((await fetch(`${root}/${path}`, { method: "PATCH", headers, body: JSON.stringify({ fields: { text: { stringValue: "bypass" } } }) })).status).toBe(403);
      expect((await fetch(`${root}/${path}`, { method: "DELETE", headers })).status).toBe(403);
    }
  }
  expect((await fetch(`${root}/users/${users[0].uid}`)).status).toBe(200);
  expect((await fetch(`${root}/GuideRulesProbe/probe`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: {} }) })).status).toBe(403);
  expect((await fetch(`${root}/GuideRulesProbe/probe`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[0]}` }, body: JSON.stringify({ fields: {} }) })).status).toBe(200);
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
  await expect(page.getByRole("link", { name: "Editează", exact: true })).toHaveCount(0);
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

test("mobile: empty search prefill, error retains text, minimal form and follow-up editing", async ({ page, request }) => {
  await login(page);
  await page.getByRole("searchbox").fill("Întrebarea fără rezultat unic");
  await expect(page.getByText("Nu am găsit această situație.")).toBeVisible();
  await page.getByRole("link", { name: "Adaugă o situație", exact: true }).last().click();
  await expect(page.getByLabel("Ce te poate întreba?", { exact: true })).toHaveValue("Întrebarea fără rezultat unic");
  await page.getByLabel("Ce poți răspunde?", { exact: true }).fill("Răspuns scris pe telefon.");
  let posts = 0;
  await page.route("**/api/ghid-comunicare", async route => {
    if (route.request().method() === "POST") { posts++; await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Eroare simulată de salvare." }) }); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Eroare simulată de salvare." })).toHaveText("Eroare simulată de salvare.");
  await expect(page.getByLabel("Ce poți răspunde?", { exact: true })).toHaveValue("Răspuns scris pe telefon.");
  expect(posts).toBe(1);
  await page.unroute("**/api/ghid-comunicare");
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Întrebarea fără rezultat unic", exact: true })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").pop();
  expect((await (await api(request, 0, `/${id}`)).json()).followUps).toEqual([]);
  await page.getByRole("link", { name: "Editează", exact: true }).click();
  await page.getByRole("button", { name: "Adaugă o întrebare suplimentară" }).click();
  await page.getByLabel("Întrebarea suplimentară 1", { exact: true }).fill("Dar mai departe?");
  await page.getByLabel("Răspunsul suplimentar 1", { exact: true }).fill("Continuarea răspunsului.");
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.locator("summary", { hasText: "Dar mai departe?" })).toBeVisible();
});

test("mobile: clipboard failure and withdrawal retain colleagues' contributions", async ({ page, request }) => {
  const item = await create(request, 0, "Situație pentru retragere", "Text care va fi retras");
  const completionId = randomUUID();
  await api(request, 1, `/${item.id}/completari`, "POST", { id: completionId, text: "Completare păstrată după retragere." });
  await login(page);
  await page.goto(`/ghid-comunicare/${item.id}`);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } }); });
  await page.getByRole("button", { name: "Copiază răspunsul", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Nu am putut copia răspunsul.");
  expect(await page.getByText("Text care va fi retras", { exact: true }).evaluate(element => getComputedStyle(element).userSelect)).toBe("text");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Șterge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Situație retrasă de autor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adaugă o completare" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vezi completările (1)", exact: true }).click();
  await expect(page.getByText("Completare păstrată după retragere.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editează", exact: true })).toHaveCount(0);
});
