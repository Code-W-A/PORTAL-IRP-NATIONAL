import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import JSZip from "jszip";
import sharp from "sharp";
import { buildBicpDocx } from "../../app/(admin-irp)/components/docx/BicpDocx";
import * as variants from "../../lib/bicp/docxVariants";
import * as signatures from "../../lib/pdf/purtatorSignatures";

// Exercise the real GET handler and generator with an in-memory Firestore boundary.
// No Firebase accounts, live records or Storage assets are modified.
const source = readFileSync(resolve("app/(admin-irp)/api/comunicate/[id]/docx/route.ts"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const recordPath = "Judete/TEST/Structuri/ISU/Comunicate/example";
const structurePath = "Judete/TEST/Structuri/ISU";
const record = {
  judetId: "TEST", structuraId: "ISU", numarRegistru: "R-99", numarComunicat: 42,
  data: "2026-11-17", titlu: "Test ș ț / document", nume: "Comunicat",
  comunicat: "Primul paragraf\nAl doilea paragraf", "purtator-cuvant": "Purtător test",
  pentru: "Pentru", functia: "Inspector șef", grad: "Colonel", numeSemnatar: "Semnatar test",
};

function handler(records: Record<string, unknown>, asset?: ArrayBuffer, failAssets = false) {
  const calls: string[] = [];
  const fetches: string[] = [];
  const reference = (...args: unknown[]) => ({ path: args.slice((args[0] as { path?: string }).path ? 0 : 1)
    .map((item) => typeof item === "string" ? item : (item as { path: string }).path).join("/") });
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "firebase/firestore": {
      doc: reference,
      getDoc: async (ref: { path: string }) => {
        calls.push(ref.path);
        return { ref, exists: () => ref.path in records, data: () => records[ref.path] };
      },
      collectionGroup: () => ({}), documentId: () => ({}), query: () => ({}), where: () => ({}), limit: () => ({}),
      getDocs: async () => ({ empty: true, docs: [] }),
    },
    "@/lib/firebase": { initFirebase: () => ({ db: {} }) },
    "@/lib/tenant": { getTenantContext: () => ({ judetId: "TEST", structuraId: "ISU" }) },
    "@/lib/judete": { JUDETE: [{ id: "TEST", name: "Test" }] },
    "@/app/(admin-irp)/components/docx/BicpDocx": { buildBicpDocx },
    "@/lib/bicp/docxVariants": variants,
    "@/lib/pdf/purtatorSignatures": signatures,
  };
  const exports: { GET?: (req: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
  vm.runInNewContext(code, {
    exports, require: (name: string) => {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
    Response, Request, URL, Uint8Array, AbortSignal, process: { env: { NODE_ENV: "production" } },
    console: { error: () => {}, log: () => {} },
    fetch: async (url: string) => {
      fetches.push(url);
      return new Response(failAssets ? null : asset, { status: failAssets ? 503 : 200 });
    },
  });
  return { calls, fetches, get: (variant?: string) => exports.GET!(new Request(
    `https://portal.example.invalid/api/comunicate/example/docx?judetId=TEST&structuraId=ISU${variant === undefined ? "" : `&variant=${variant}`}`,
  ), { params: Promise.resolve({ id: "example" }) }) };
}
async function docText(response: Response) {
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  return { body: await zip.file("word/document.xml")!.async("string"), header: await zip.file("word/header1.xml")?.async("string") || "" };
}

test("invalid variants fail before any database reads; missing documents return 404", async () => {
  const route = handler({});
  assert.equal((await route.get("invalid")).status, 400);
  assert.equal(route.calls.length, 0);
  assert.equal((await route.get()).status, 404);
});

test("all variants produce DOCX attachments with distinct filenames and PDF-compatible numbers", async () => {
  for (const variant of ["simple", "public", "signed", undefined]) {
    const route = handler({ [recordPath]: record, [structurePath]: { isAdmin: false } });
    const response = await route.get(variant);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const suffix = variant === "simple" ? "simplu" : variant === "public" ? "fara_semnaturi" : "cu_semnaturi";
    assert.ok(response.headers.get("Content-Disposition")?.endsWith(`_${suffix}.docx"`));
    const xml = await docText(response);
    if (variant === "simple") {
      assert.equal(xml.header, "");
      assert.ok(!route.calls.includes(structurePath));
    } else {
      assert.ok(xml.header.includes(variant === "public" ? "Nr. 42" : "Nr. R-99"));
      assert.ok(xml.header.includes("17.11.2026"));
    }
  }
});

test("signature images are requested only for signed exports of eligible structures", async () => {
  const buffer = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#123456" } }).png().toBuffer();
  const asset = Uint8Array.from(buffer).buffer;
  for (const eligible of [false, true]) {
    for (const variant of ["simple", "public", "signed"]) {
      const route = handler({ [recordPath]: record, [structurePath]: { isAdmin: eligible } }, asset);
      const response = await route.get(variant);
      assert.equal(response.status, 200);
      assert.equal(route.fetches.length, eligible && variant === "signed" ? 1 : 0);
      if (route.fetches.length) assert.ok(route.fetches[0].endsWith("/SEMNATURI/RADU.png"));
    }
  }
});

test("failed assets return a visible generation error, while simple export remains independent of them", async () => {
  const records = { [recordPath]: record, [structurePath]: { isAdmin: true },
    [`${structurePath}/Settings/general`]: { logoUrlPublic: "/sigla.png" } };
  const route = handler(records, undefined, true);
  const response = await route.get("public");
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error.includes("DOCX"));
  const simple = await route.get("simple");
  assert.equal(simple.status, 200);
  assert.equal(route.fetches.length, 1);
});
