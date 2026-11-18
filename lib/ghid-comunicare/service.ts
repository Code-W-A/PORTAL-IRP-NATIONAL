import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  collection, doc, documentId, getDocFromServer, getDocsFromServer, increment, limit, orderBy, query,
  runTransaction, startAfter, type DocumentData, type DocumentReference, type Firestore,
} from "firebase/firestore";
import type { Completion, GuideAuthor, GuidePage, Situation, SituationDraft, SituationSummary } from "./types";
import { WITHDRAWN_TITLE } from "./types";
import { GuideError, matchesSearch, normalizeSearch, searchText, validateCompletion, validateCreationId, validateId, validateSituation } from "./validation";

export const GUIDE_COLLECTION = "GhidComunicare";
const PAGE_SIZE = 20;
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
    createdAt: data.createdAt, updatedAt: data.updatedAt };
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

  async list(search: string, rawCursor: string | null, signal?: AbortSignal): Promise<GuidePage<SituationSummary>> {
    if (search.length > 1000) throw new GuideError(400, "Căutarea este prea lungă.");
    let cursor = decodeCursor(rawCursor);
    const items: SituationSummary[] = [];
    const situations = collection(this.db, GUIDE_COLLECTION);
    const hasSearch = search.trim().length > 0;
    const batchSize = hasSearch ? 100 : PAGE_SIZE + 1;
    while (items.length <= PAGE_SIZE) {
      signal?.throwIfAborted();
      const batch = await getDocsFromServer(query(situations,
        orderBy("updatedAt", "desc"), orderBy(documentId(), "desc"), limit(batchSize),
        ...(cursor ? [startAfter(cursor.date, cursor.id)] : [])));
      signal?.throwIfAborted();
      for (const doc of batch.docs) {
        const data = doc.data();
        if (data.status === "withdrawn" && data.completionCount === 0) continue;
        const item = situation(doc.id, data);
        if (hasSearch) {
          const text = item.status === "withdrawn" ? normalizeSearch(WITHDRAWN_TITLE) : searchText(item);
          if (!matchesSearch(text, search)) continue;
        }
        const { followUps: _followUps, ...summary } = item;
        items.push({ ...summary, answer: summary.answer.slice(0, 500) });
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
    const content = situationContent(input);
    const ref = this.ref(id);
    await runTransaction(this.db, async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists()) throw new GuideError(404, "Situația nu a fost găsită.");
      assertAuthor(existing.data()!, this.user.uid);
      assertActive(existing.data()!);
      tx.update(ref, { ...content, updatedAt: new Date().toISOString() });
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
