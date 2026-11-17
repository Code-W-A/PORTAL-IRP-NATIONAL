import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOMParser } from "linkedom";
import JSZip from "jszip";
import sharp from "sharp";
import { buildBicpDocx, type DocxData, type DocxSettings } from "../../app/(admin-irp)/components/docx/BicpDocx";
import { BICP_DOCX_VARIANTS, parseBicpDocxVariant } from "../../lib/bicp/docxVariants";

const settings: DocxSettings = {
  headerLines: ["DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ", "INSPECTORATUL PENTRU SITUAȚII DE URGENȚĂ"],
  secrecyLabel: "NESECRET", city: "București", phone: "021 000 0000", email: "test@example.invalid",
  unitLabel: "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE", structureDisplay: "ISU Test",
  footerLines: ["Adresă instituție - document de verificare", "www.example.invalid"],
};
const data: DocxData = {
  numar: "42", dateLabel: "17.11.2026", purtator: "Nume purtător test", tipDocument: "Comunicat de presă",
  titlu: "Intervenție pentru protejarea comunității",
  continut: "Text alternativ păstrat pentru documente vechi.",
  continutHtml: '<p>În această dimineață, <strong>pompierii</strong> au intervenit pentru <em>protejarea</em> comunității &amp; a bunurilor.</p><p style="text-align:center">Text centrat cu <u>subliniere</u>.</p><p>Primul rând<br>Al doilea rând</p><ol start="3"><li>Primul punct</li><li>Al doilea punct<ul><li>Punct imbricat</li></ul></li></ol><h2>Recomandări pentru cetățeni</h2><p>Mai multe <a href="https://example.invalid">informații</a>.</p>',
  semnatar: { pentru: "Pentru", functia: "Inspector șef", grad: "Colonel", nume: "Nume semnatar test" },
};
const xmlDoc = (xml: string) => new DOMParser().parseFromString(xml, "text/xml");
const elements = (xml: string, tag: string) => Array.from(xmlDoc(xml).getElementsByTagName(tag));
async function parts(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const document = await zip.file("word/document.xml")!.async("string");
  const header = await zip.file("word/header1.xml")?.async("string") || "";
  const footer = await zip.file("word/footer1.xml")?.async("string") || "";
  return { zip, document, header, footer };
}
async function imageBuffer() {
  const buffer = await sharp({ create: { width: 400, height: 100, channels: 4, background: "#315c86" } }).png().toBuffer();
  return Uint8Array.from(buffer).buffer;
}

test("variants default to signed and reject unknown or empty values", () => {
  assert.equal(parseBicpDocxVariant(null), "signed");
  for (const item of BICP_DOCX_VARIANTS) assert.equal(parseBicpDocxVariant(item.value), item.value);
  assert.equal(parseBicpDocxVariant("doc"), null);
  assert.equal(parseBicpDocxVariant(""), null);
});

test("simple contains only title and body, with no letterhead, signatures or document type", async () => {
  const asset = await imageBuffer();
  const result = await parts(await buildBicpDocx({ ...settings, logoArrayBuffer: asset }, {
    ...data, purtatorSignatureArrayBuffer: asset,
  }, "simple"));
  assert.equal(result.header, "");
  assert.equal(result.footer, "");
  const text = xmlDoc(result.document).documentElement.textContent!;
  assert.ok(text.includes(data.titlu));
  assert.ok(text.includes("pompierii"));
  for (const excluded of [data.tipDocument, data.purtator, data.semnatar.nume, "APROB", "NESECRET", "Nr. 42", settings.phone!]) {
    assert.ok(!text.includes(excluded), excluded);
  }
  assert.equal(Object.keys(result.zip.files).filter((name) => /^word\/media\/.+/.test(name)).length, 0);
  assert.equal(elements(result.document, "w:headerReference").length, 0);
  assert.equal(elements(result.document, "w:footerReference").length, 0);
});

test("full variants use real repeating header/footer, A4, centered title and appropriate approval metadata", async () => {
  const asset = await imageBuffer();
  for (const variant of ["public", "signed"] as const) {
    const result = await parts(await buildBicpDocx({ ...settings, logoArrayBuffer: asset }, {
      ...data, purtatorSignatureArrayBuffer: asset,
    }, variant));
    assert.ok(result.header.includes("Nr. 42"));
    assert.ok(result.footer.includes(settings.footerLines![0]));
    assert.ok(!result.document.includes(settings.footerLines![0]));
    assert.equal(elements(result.document, "w:headerReference").length, 1);
    assert.equal(elements(result.document, "w:footerReference").length, 1);
    assert.equal(elements(result.document, "w:pgSz")[0].getAttribute("w:w"), "11906");
    assert.equal(elements(result.document, "w:pgSz")[0].getAttribute("w:h"), "16838");
    const title = elements(result.document, "w:p").find((p) => p.textContent === data.titlu)!;
    assert.equal(title.getElementsByTagName("w:jc")[0].getAttribute("w:val"), "center");
    assert.equal(result.document.includes("APROB"), variant === "signed");
    assert.equal(result.header.includes("NESECRET"), variant === "signed");
    assert.equal(elements(result.document, "w:drawing").length, variant === "signed" ? 1 : 0);
    const extent = elements(result.header, "wp:extent")[0];
    assert.equal(Number(extent.getAttribute("cx")) / Number(extent.getAttribute("cy")), 4);
  }
});

test("HTML preserves inline marks, entities, explicit alignment, line breaks, list numbering and headings", async () => {
  const { document, zip } = await parts(await buildBicpDocx(settings, data, "simple"));
  const runs = elements(document, "w:r");
  const bold = runs.find((run) => run.textContent === "pompierii")!;
  assert.equal(bold.getElementsByTagName("w:b").length, 1);
  const normal = runs.find((run) => run.textContent?.includes("În această dimineață"))!;
  assert.equal(normal.getElementsByTagName("w:b").length, 0);
  assert.ok(xmlDoc(document).documentElement.textContent!.includes("comunității & a bunurilor"));
  assert.equal(elements(document, "w:br").length, 1);
  assert.ok((await zip.file("word/settings.xml")!.async("string")).includes("w:doNotExpandShiftReturn"));
  const centered = elements(document, "w:p").find((p) => p.textContent?.startsWith("Text centrat"))!;
  assert.equal(centered.getElementsByTagName("w:jc")[0].getAttribute("w:val"), "center");
  assert.equal(elements(document, "w:numPr").length, 3);
  const numbering = await zip.file("word/numbering.xml")!.async("string");
  assert.ok(numbering.includes('w:start w:val="3"'));
  assert.ok(numbering.includes('w:numFmt w:val="bullet"'));
  assert.ok(document.includes("Recomandări pentru cetățeni"));
  assert.equal(elements(document, "w:hyperlink").length, 1);
  assert.ok(!xmlDoc(document).documentElement.textContent!.includes("Text alternativ"));
});

test("legacy text preserves paragraphs and empty lines; blank HTML falls back to legacy content", async () => {
  for (const html of [undefined, "<p><br></p>"]) {
    const { document } = await parts(await buildBicpDocx(settings, {
      ...data, continut: "Primul paragraf\r\n\r\nAl doilea paragraf\nUltimul rând", continutHtml: html,
    }, "simple"));
    const paragraphs = elements(document, "w:body")[0].getElementsByTagName("w:p");
    assert.deepEqual((Array.from(paragraphs) as Element[]).map((p) => p.textContent), [data.titlu, "Primul paragraf", "", "Al doilea paragraf", "Ultimul rând"]);
  }
});

test("spokesperson and decorative settings are respected, unsafe HTML does not become document content", async () => {
  const { document, header, footer } = await parts(await buildBicpDocx({
    ...settings, showSpokespersonBlock: false, showHeaderTricolor: false, showTricolorFooter: false,
  }, { ...data, continutHtml: '<p>Text sigur</p><script>secret-script</script><style>secret-style</style>' }, "signed"));
  assert.ok(!document.includes(data.purtator));
  assert.ok(!document.includes("secret-script"));
  assert.ok(!document.includes("secret-style"));
  assert.ok(!header.includes("002B7F"));
  assert.ok(!footer.includes("002B7F"));
});

test("generate short and multipage artifacts for visual inspection when requested", async () => {
  const output = process.env.BICP_DOCX_ARTIFACT_DIR;
  if (!output) return;
  await mkdir(output, { recursive: true });
  const logo = await imageBuffer();
  const longContent = Array.from({ length: 30 }, (_, i) => `<p>Paragraful ${i + 1}. Pompierii au intervenit pentru protejarea comunității. Echipajele au acționat pentru limitarea efectelor și acordarea ajutorului necesar. Recomandăm cetățenilor să respecte indicațiile autorităților și să păstreze căile de acces libere.</p>`).join("");
  for (const { value } of BICP_DOCX_VARIANTS) {
    for (const long of [false, true]) {
      await writeFile(join(output, `${value}${long ? "-long" : ""}.docx`), await buildBicpDocx({ ...settings, logoArrayBuffer: logo }, {
        ...data, purtatorSignatureArrayBuffer: logo, ...(long ? { continutHtml: longContent } : {}),
      }, value));
    }
  }
});
