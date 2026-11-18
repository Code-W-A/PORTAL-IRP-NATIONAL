import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  collection, doc, documentId, getDocFromServer, getDocsFromServer, increment, limit, orderBy, query,
  deleteDoc, onSnapshot, runTransaction, serverTimestamp, startAfter, type DocumentData, type DocumentReference, type Firestore,
} from "firebase/firestore";
import type { Completion, GuideAuthor, GuideCategory, GuidePage, Situation, SituationDraft, SituationSummary } from "./types";
import { UNCATEGORIZED, WITHDRAWN_TITLE } from "./types";
import { categoryName, GuideError, matchesSearch, normalizeSearch, searchText, validateCompletion, validateCreationId, validateId, validateSituation } from "./validation";

export const GUIDE_COLLECTION = "GhidComunicare";
const PAGE_SIZE = 20;
const CATEGORY_COLLECTION = "GhidComunicareCategorii";
const FAVORITES_COLLECTION = "GhidComunicareFavorite";
type Cursor = { date: string; id: string };
function encodeCursor(item: { id: string; updatedAt: string }) {
  return JSON.stringify({ date: item.updatedAt, id: item.id });
}
function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    if (raw.length > 1024) throw new Error();
    const value = JSON.parse(raw);
    validateId(value.id);
    if (typeof value.date !== "string" || value.date.length > 32) throw new Error();
    return value;
  } catch { throw new GuideError(400, "Pagina solicitată nu este validă. Reîncarcă lista."); }
}
function situation(id: string, data: DocumentData): Situation {
  return { id, question: data.question, answer: data.answer, followUps: data.followUps,
    author: data.author, status: data.status, completionCount: data.completionCount,
    createdAt: data.createdAt, updatedAt: data.updatedAt, categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [] };
}
function summarize(item: Situation, search: string, category: string): SituationSummary | null {
  if (item.status === "withdrawn" && item.completionCount === 0) return null;
  if (category === UNCATEGORIZED ? item.categoryIds.length > 0 : category && !item.categoryIds.includes(category)) {
    return null;
  }
  const { followUps, ...summary } = item;
  if (!search.trim()) return summary;
  if (item.status === "withdrawn") return matchesSearch(normalizeSearch(WITHDRAWN_TITLE), search) ? summary : null;
  const main = normalizeSearch(`${item.question} ${item.answer}`);
  if (matchesSearch(main, search)) return summary;
  if (!matchesSearch(searchText(item), search)) return null;
  const match = followUps.find(pair => matchesSearch(normalizeSearch(`${pair.question} ${pair.answer}`), search));
  return match ? { ...summary, matchingQuestion: match.question } : summary;
}

function situationContent(input: SituationDraft) {
  const draft = validateSituation(input);
  const content = { ...draft, searchText: searchText(draft) };
  const encoder = new TextEncoder();
  if (encoder.encode(JSON.stringify(draft)).length > 500_000 ||
      encoder.encode(JSON.stringify(content)).length > 1_000_000) {
    throw new GuideError(413, "Conținutul este prea lung.");
  }
  return content;
}

function assertAuthor(data: DocumentData, uid: string) {
  if (data.author?.uid !== uid) throw new GuideError(403, "Poți modifica doar conținutul publicat de tine.");
}
function isPermissionDenied(error: unknown) {
  return error instanceof FirebaseError && error.code === "permission-denied";
}
async function alreadyPublished(ref: DocumentReference, uid: string) {
  // Rules can reject a concurrent duplicate before Firestore reports the stale transaction read.
  const existing = await getDocFromServer(ref);
  if (!existing.exists()) return false;
  assertAuthor(existing.data(), uid);
  return true;
}
function assertActive(data: DocumentData) {
  if (data.status !== "active") throw new GuideError(409, "Această situație a fost retrasă de autor.");
}
export class GuideService {
  constructor(private db: Firestore, private user: Pick<User, "uid" | "displayName">) {}

  private async author(): Promise<GuideAuthor> {
    const { uid, displayName } = this.user;
    const profile = (await getDocFromServer(doc(this.db, "users", uid))).data();
    const judetId = profile?.judetId;
    const structuraId = profile?.structuraId;
    if ([judetId, structuraId].some(value => typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value))) {
      throw new GuideError(403, "Contul nu are un profil IRP complet.");
    }
    let name = displayName?.trim();
    if (!name) {
      const settings = (await getDocFromServer(doc(this.db, "Judete", judetId, "Structuri", structuraId, "Settings", "general"))).data();
      name = String(settings?.structureDisplay || settings?.unitLabel || `${structuraId} ${judetId}`).trim() || `${structuraId} ${judetId}`;
    }
    return { uid, name: name.slice(0, 300) };
  }
  private ref(id: string) { return doc(this.db, GUIDE_COLLECTION, validateId(id)); }

  watchCategories(onChange: (items: GuideCategory[]) => void, onError: (error: Error) => void) {
    return onSnapshot(collection(this.db, CATEGORY_COLLECTION), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, name: item.data().name as string }));
      onChange(items.sort((left, right) => left.name.localeCompare(right.name, "ro")));
    }, onError);
  }

  async createCategory(value: string): Promise<GuideCategory> {
    const { name, normalized } = categoryName(value);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    const id = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    const ref = doc(this.db, CATEGORY_COLLECTION, id);
    try {
      return await runTransaction(this.db, async tx => {
        const existing = await tx.get(ref);
        if (existing.exists()) return { id, name: existing.data().name as string };
        tx.set(ref, { name, createdBy: this.user.uid });
        return { id, name };
      });
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      const existing = await getDocFromServer(ref);
      if (!existing.exists()) throw error;
      return { id, name: existing.data().name as string };
    }
  }

  private favorites() {
    return collection(this.db, FAVORITES_COLLECTION, this.user.uid, "Situatii");
  }

  watchFavorites(onChange: (ids: string[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(this.favorites(), orderBy("savedAt", "desc")), snapshot => {
      onChange(snapshot.docs.map(item => item.id));
    }, onError);
  }

  async setFavorite(id: string, favorite: boolean) {
    const ref = doc(this.favorites(), validateId(id));
    if (!favorite) {
      await deleteDoc(ref);
      return;
    }
    try {
      await runTransaction(this.db, async tx => {
        if (!(await tx.get(ref)).exists()) tx.set(ref, { savedAt: serverTimestamp() });
      });
    } catch (error) {
      if (!isPermissionDenied(error) || !(await getDocFromServer(ref)).exists()) throw error;
    }
  }

  async listFavorites(ids: readonly string[], search: string, category: string, rawCursor: string | null, signal?: AbortSignal): Promise<GuidePage<SituationSummary>> {
    if (search.length > 1000) throw new GuideError(400, "Căutarea este prea lungă.");
    const items: SituationSummary[] = [];
    let offset = rawCursor === null ? 0 : Number(rawCursor);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > ids.length) {
      throw new GuideError(400, "Pagina solicitată nu este validă. Reîncarcă lista.");
    }
    while (offset < ids.length && items.length < PAGE_SIZE) {
      signal?.throwIfAborted();
      const snapshots = await Promise.all(
        ids.slice(offset, offset + PAGE_SIZE - items.length).map(id => getDocFromServer(this.ref(id))),
      );
      signal?.throwIfAborted();
      offset += snapshots.length;
      for (const snap of snapshots) {
        if (!snap.exists()) continue;
        const item = summarize(situation(snap.id, snap.data()), search, category);
        if (item) items.push(item);
      }
    }
    return { items, nextCursor: offset < ids.length ? String(offset) : null };
  }

  async list(search: string, rawCursor: string | null, signal?: AbortSignal, category = ""): Promise<GuidePage<SituationSummary>> {
    if (search.length > 1000) throw new GuideError(400, "Căutarea este prea lungă.");
    let cursor = decodeCursor(rawCursor);
    const items: SituationSummary[] = [];
    const situations = collection(this.db, GUIDE_COLLECTION);
    const batchSize = search.trim() || category ? 100 : PAGE_SIZE + 1;
    while (items.length <= PAGE_SIZE) {
      signal?.throwIfAborted();
      const batch = await getDocsFromServer(query(situations,
        orderBy("updatedAt", "desc"), orderBy(documentId(), "desc"), limit(batchSize),
        ...(cursor ? [startAfter(cursor.date, cursor.id)] : [])));
      signal?.throwIfAborted();
      for (const doc of batch.docs) {
        const item = summarize(situation(doc.id, doc.data()), search, category);
        if (item) items.push(item);
        if (items.length > PAGE_SIZE) break;
      }
      if (items.length > PAGE_SIZE || batch.size < batchSize) break;
      const last = batch.docs[batch.docs.length - 1];
      cursor = { date: last.data().updatedAt, id: last.id };
    }
    const more = items.length > PAGE_SIZE;
    const visible = items.slice(0, PAGE_SIZE);
    return { items: visible, nextCursor: more ? encodeCursor(visible[visible.length - 1]) : null };
  }

  async get(id: string): Promise<Situation> {
    const snap = await getDocFromServer(this.ref(id));
    if (!snap.exists()) throw new GuideError(404, "Situația nu a fost găsită.");
    return situation(snap.id, snap.data()!);
  }

  async create(input: SituationDraft & { id: string }) {
    const content = situationContent(input);
    const id = validateCreationId(input.id);
    const actor = await this.author();
    const ref = this.ref(id);
    await runTransaction(this.db, async tx => {
      const existing = await tx.get(ref);
      if (existing.exists()) { assertAuthor(existing.data()!, this.user.uid); return; }
      const now = new Date().toISOString();
      tx.set(ref, { ...content, author: actor, status: "active", completionCount: 0, createdAt: now, updatedAt: now });
    }).catch(async error => {
      if (!isPermissionDenied(error) || !(await alreadyPublished(ref, this.user.uid))) throw error;
    });
    return this.get(id);
  }

  async update(id: string, input: SituationDraft) {
    const { categoryIds, ...content } = situationContent(input);
    const ref = this.ref(id);
    await runTransaction(this.db, async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists()) throw new GuideError(404, "Situația nu a fost găsită.");
      assertAuthor(existing.data()!, this.user.uid);
      assertActive(existing.data()!);
      tx.update(ref, {
        ...content,
        ...(input.categoryIds === undefined ? {} : { categoryIds }),
        updatedAt: new Date().toISOString(),
      });
    });
    return this.get(id);
  }

  async withdraw(id: string) {
    const ref = this.ref(id);
    await runTransaction(this.db, async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists()) throw new GuideError(404, "Situația nu a fost găsită.");
      assertAuthor(existing.data()!, this.user.uid);
      if (existing.data()!.status === "withdrawn") return;
      // Keep the parent and all colleagues' contributions, even during concurrent publication.
      tx.update(ref, { status: "withdrawn", question: "", answer: "", followUps: [], searchText: "", updatedAt: new Date().toISOString() });
    });
  }

  async completions(id: string, rawCursor: string | null): Promise<GuidePage<Completion>> {
    await this.get(id);
    const cursor = decodeCursor(rawCursor);
    const result = await getDocsFromServer(query(collection(this.ref(id), "Completari"),
      orderBy("updatedAt", "desc"), orderBy(documentId(), "desc"), limit(PAGE_SIZE + 1),
      ...(cursor ? [startAfter(cursor.date, cursor.id)] : [])));
    const items = result.docs.slice(0, PAGE_SIZE).map(doc => ({ id: doc.id, ...doc.data() }) as Completion);
    return { items, nextCursor: result.size > PAGE_SIZE ? encodeCursor(items[items.length - 1]) : null };
  }

  async createCompletion(id: string, input: { id: string; text: string }) {
    const text = validateCompletion(input);
    const completionId = validateCreationId(input.id);
    const actor = await this.author();
    const parent = this.ref(id);
    const ref = doc(parent, "Completari", completionId);
    await runTransaction(this.db, async tx => {
      const [situationSnap, existing] = await Promise.all([tx.get(parent), tx.get(ref)]);
      if (!situationSnap.exists()) throw new GuideError(404, "Situația nu a fost găsită.");
      if (existing.exists()) { assertAuthor(existing.data()!, this.user.uid); return; }
      assertActive(situationSnap.data()!);
      const now = new Date().toISOString();
      tx.set(ref, { text, author: actor, createdAt: now, updatedAt: now });
      tx.update(parent, { completionCount: increment(1), completionChangeId: completionId });
    }).catch(async error => {
      if (!isPermissionDenied(error)) throw error;
      if (await alreadyPublished(ref, this.user.uid)) return;
      const situation = await getDocFromServer(parent);
      if (situation.exists()) assertActive(situation.data());
      throw error;
    });
    const saved = await getDocFromServer(ref);
    return { id: ref.id, ...saved.data() } as Completion;
  }

  async changeCompletion(id: string, completionId: string, input?: { text: string }) {
    const text = input === undefined ? null : validateCompletion(input);
    const parent = this.ref(id);
    const ref = doc(parent, "Completari", validateId(completionId));
    await runTransaction(this.db, async tx => {
      const [situationSnap, existing] = await Promise.all([tx.get(parent), tx.get(ref)]);
      if (!situationSnap.exists() || !existing.exists()) throw new GuideError(404, "Completarea nu a fost găsită.");
      assertAuthor(existing.data()!, this.user.uid);
      if (text !== null) tx.update(ref, { text, updatedAt: new Date().toISOString() });
      else {
        tx.delete(ref);
        tx.update(parent, { completionCount: increment(-1), completionChangeId: completionId });
      }
    });
  }
}
