import { FieldPath, type DocumentData, type Firestore } from "firebase-admin/firestore";
import type { Completion, GuideAuthor, GuidePage, Situation, SituationSummary } from "@/lib/ghid-comunicare/types";
import { WITHDRAWN_TITLE } from "@/lib/ghid-comunicare/types";
import { GuideError, matchesSearch, searchText, validateCompletion, validateCreationId, validateId, validateSituation } from "@/lib/ghid-comunicare/validation";

export const GUIDE_COLLECTION = "GhidComunicare";
const PAGE_SIZE = 20;
type Cursor = { date: string; id: string };
function encodeCursor(item: { id: string; updatedAt: string }) {
  return Buffer.from(JSON.stringify({ date: item.updatedAt, id: item.id })).toString("base64url");
}
function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    if (raw.length > 1024) throw new Error();
    const value = JSON.parse(Buffer.from(raw, "base64url").toString());
    validateId(value.id);
    if (typeof value.date !== "string" || new Date(value.date).toISOString() !== value.date) throw new Error();
    return value;
  } catch { throw new GuideError(400, "Pagina solicitată nu este validă. Reîncarcă lista."); }
}
function situation(id: string, data: DocumentData): Situation {
  return { id, question: data.question, answer: data.answer, followUps: data.followUps,
    author: data.author, status: data.status, completionCount: data.completionCount,
    createdAt: data.createdAt, updatedAt: data.updatedAt };
}
function assertAuthor(data: DocumentData, actor: GuideAuthor) {
  if (data.author?.uid !== actor.uid) throw new GuideError(403, "Poți modifica doar conținutul publicat de tine.");
}
function assertActive(data: DocumentData) {
  if (data.status !== "active") throw new GuideError(409, "Această situație a fost retrasă de autor.");
}
export class GuideService {
  constructor(private db: Firestore) {}
  private ref(id: string) { return this.db.collection(GUIDE_COLLECTION).doc(validateId(id)); }

  async list(query: string, rawCursor: string | null): Promise<GuidePage<SituationSummary>> {
    if (query.length > 1000) throw new GuideError(400, "Căutarea este prea lungă.");
    let cursor = decodeCursor(rawCursor);
    const items: SituationSummary[] = [];
    // Scan on the server, across the complete collection, until 20 + 1 matches or exhaustion.
    // Never restrict search to the rows already displayed or to an arbitrary document cap.
    while (items.length <= PAGE_SIZE) {
      let request = this.db.collection(GUIDE_COLLECTION).orderBy("updatedAt", "desc")
        .orderBy(FieldPath.documentId(), "desc").limit(100);
      if (cursor) request = request.startAfter(cursor.date, cursor.id);
      const batch = await request.get();
      for (const doc of batch.docs) {
        const data = doc.data();
        if (data.status === "withdrawn" && data.completionCount === 0) continue;
        const text = data.status === "withdrawn" ? searchText({ question: WITHDRAWN_TITLE, answer: "", followUps: [] }) : data.searchText;
        if (!matchesSearch(text || "", query)) continue;
        const { followUps: _followUps, ...summary } = situation(doc.id, data);
        items.push({ ...summary, answer: summary.answer.slice(0, 500) });
        if (items.length > PAGE_SIZE) break;
      }
      if (items.length > PAGE_SIZE || batch.size < 100) break;
      const last = batch.docs[batch.docs.length - 1];
      cursor = { date: last.data().updatedAt, id: last.id };
    }
    const more = items.length > PAGE_SIZE;
    const visible = items.slice(0, PAGE_SIZE);
    return { items: visible, nextCursor: more ? encodeCursor(visible[visible.length - 1]) : null };
  }

  async get(id: string): Promise<Situation> {
    const snap = await this.ref(id).get();
    if (!snap.exists) throw new GuideError(404, "Situația nu a fost găsită.");
    return situation(snap.id, snap.data()!);
  }

  async create(actor: GuideAuthor, input: unknown) {
    const draft = validateSituation(input);
    const id = validateCreationId((input as { id?: unknown })?.id);
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) { assertAuthor(existing.data()!, actor); return; }
      const now = new Date().toISOString();
      tx.create(ref, { ...draft, author: actor, status: "active", completionCount: 0,
        searchText: searchText(draft), createdAt: now, updatedAt: now });
    });
    return this.get(id);
  }

  async update(id: string, actor: GuideAuthor, input: unknown) {
    const draft = validateSituation(input);
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists) throw new GuideError(404, "Situația nu a fost găsită.");
      assertAuthor(existing.data()!, actor);
      assertActive(existing.data()!);
      tx.update(ref, { ...draft, searchText: searchText(draft), updatedAt: new Date().toISOString() });
    });
    return this.get(id);
  }

  async withdraw(id: string, actor: GuideAuthor) {
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists) throw new GuideError(404, "Situația nu a fost găsită.");
      assertAuthor(existing.data()!, actor);
      if (existing.data()!.status === "withdrawn") return;
      // Keep the parent and all colleagues' contributions, even during concurrent publication.
      tx.update(ref, { status: "withdrawn", question: "", answer: "", followUps: [], searchText: "", updatedAt: new Date().toISOString() });
    });
  }

  async completions(id: string, rawCursor: string | null): Promise<GuidePage<Completion>> {
    await this.get(id);
    const cursor = decodeCursor(rawCursor);
    let request = this.ref(id).collection("Completari").orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc").limit(PAGE_SIZE + 1);
    if (cursor) request = request.startAfter(cursor.date, cursor.id);
    const result = await request.get();
    const items = result.docs.slice(0, PAGE_SIZE).map(doc => ({ id: doc.id, ...doc.data() }) as Completion);
    return { items, nextCursor: result.size > PAGE_SIZE ? encodeCursor(items[items.length - 1]) : null };
  }

  async createCompletion(id: string, actor: GuideAuthor, input: unknown) {
    const text = validateCompletion(input);
    const completionId = validateCreationId((input as { id?: unknown })?.id);
    const parent = this.ref(id);
    const ref = parent.collection("Completari").doc(completionId);
    await this.db.runTransaction(async tx => {
      const [situationSnap, existing] = await tx.getAll(parent, ref);
      if (!situationSnap.exists) throw new GuideError(404, "Situația nu a fost găsită.");
      if (existing.exists) { assertAuthor(existing.data()!, actor); return; }
      assertActive(situationSnap.data()!);
      const now = new Date().toISOString();
      tx.create(ref, { text, author: actor, createdAt: now, updatedAt: now });
      tx.update(parent, { completionCount: situationSnap.data()!.completionCount + 1 });
    });
    const saved = await ref.get();
    return { id: ref.id, ...saved.data() } as Completion;
  }

  async changeCompletion(id: string, completionId: string, actor: GuideAuthor, input?: unknown) {
    const text = input === undefined ? null : validateCompletion(input);
    const parent = this.ref(id);
    const ref = parent.collection("Completari").doc(validateId(completionId));
    await this.db.runTransaction(async tx => {
      const [situationSnap, existing] = await tx.getAll(parent, ref);
      if (!situationSnap.exists || !existing.exists) throw new GuideError(404, "Completarea nu a fost găsită.");
      assertAuthor(existing.data()!, actor);
      if (text !== null) tx.update(ref, { text, updatedAt: new Date().toISOString() });
      else {
        tx.delete(ref);
        tx.update(parent, { completionCount: Math.max(0, situationSnap.data()!.completionCount - 1) });
      }
    });
  }
}
