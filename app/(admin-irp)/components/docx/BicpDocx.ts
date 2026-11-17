import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header,
  HeightRule, ImageRun, LevelFormat, LineRuleType, Packer, Paragraph,
  Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
  type INumberingOptions, type IParagraphOptions, type IRunOptions, type ParagraphChild,
} from "docx";
import { parseHTML } from "linkedom";
import sharp from "sharp";
import type { BicpDocxVariant } from "@/lib/bicp/docxVariants";

export type DocxSettings = {
  headerLines?: string[];
  logoArrayBuffer?: ArrayBuffer | null;
  secrecyLabel?: string;
  city?: string;
  phone?: string;
  unitLabel?: string;
  email?: string;
  footerLines?: string[];
  structureDisplay?: string;
  showSpokespersonBlock?: boolean;
  showHeaderTricolor?: boolean;
  showTricolorFooter?: boolean;
};

export type DocxData = {
  numar: string;
  dateLabel: string;
  purtator: string;
  purtatorSignatureArrayBuffer?: ArrayBuffer | null;
  tipDocument: string;
  titlu: string;
  continut: string;
  continutHtml?: string;
  semnatar: { pentru: string; functia: string; grad: string; nume: string };
};

const FONT = "Noto Serif";
const PAGE_WIDTH = 11906; // A4, twips (20 twips = 1 pt).
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 1440; // 72 pt, as in the PDF.
const CONTENT_WIDTH = PAGE_WIDTH - SIDE_MARGIN * 2;
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const TABLE_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};
const COMPACT_SPACING = { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO };

function paragraph(text: string, size = 24, options: IParagraphOptions = {}, run: IRunOptions = {}) {
  return new Paragraph({
    spacing: COMPACT_SPACING, widowControl: true, ...options,
    children: [new TextRun({ text, font: FONT, size, ...run })],
  });
}

type InlineStyle = Pick<IRunOptions, "bold" | "italics" | "underline" | "size">;
type ContentOptions = Pick<IParagraphOptions, "alignment" | "numbering" | "indent" | "keepNext">;

function elementStyle(el: Element, inherited: InlineStyle): InlineStyle {
  const style = { ...inherited };
  const tag = el.tagName.toLowerCase();
  const css = (el.getAttribute("style") || "").toLowerCase();
  if (["b", "strong", "h2", "h3"].includes(tag) || /font-weight\s*:\s*(bold|[6-9]00)/.test(css)) style.bold = true;
  if (["i", "em"].includes(tag) || /font-style\s*:\s*italic/.test(css)) style.italics = true;
  if (tag === "u" || /text-decoration(?:-line)?\s*:[^;]*underline/.test(css)) style.underline = {};
  if (tag === "h2") style.size = 28;
  if (tag === "h3") style.size = 26;
  return style;
}

function alignmentOf(el: Element, fallback: IParagraphOptions["alignment"] = AlignmentType.JUSTIFIED) {
  const css = el.getAttribute("style") || "";
  const value = (css.match(/(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\b/i)?.[1]
    || el.getAttribute("align") || "").toLowerCase();
  return ({ left: AlignmentType.LEFT, right: AlignmentType.RIGHT, center: AlignmentType.CENTER,
    justify: AlignmentType.JUSTIFIED } as Record<string, IParagraphOptions["alignment"]>)[value] || fallback;
}

/** Parse saved editor HTML on the server, preserving inline runs and paragraph boundaries. */
function buildContent(data: DocxData) {
  const paragraphs: Paragraph[] = [];
  const numbering: INumberingOptions["config"][number][] = [];
  const push = (children: ParagraphChild[], options: ContentOptions = {}) => {
    paragraphs.push(new Paragraph({ children, alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 120, line: 324, lineRule: LineRuleType.AUTO },
      widowControl: true, ...options,
    }));
  };
  if (data.continutHtml?.trim()) {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>${data.continutHtml}</body></html>`);
    const blocked = new Set(["script", "style", "head", "iframe", "object", "noscript"]);
    const blocks = new Set(["p", "div", "h1", "h2", "h3", "h4", "blockquote", "section", "article"]);
    const inline = (node: Node, style: InlineStyle): ParagraphChild[] => {
      if (node.nodeType === 3) return [new TextRun({
        text: (node.textContent || "").replace(/[\t\r\n ]+/g, " "), font: FONT, size: 24, ...style,
      })];
      if (node.nodeType !== 1) return [];
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (blocked.has(tag)) return [];
      if (tag === "br") return [new TextRun({ break: 1 })];
      const next = elementStyle(el, style);
      const children = Array.from(el.childNodes).flatMap((child) => inline(child, next));
      const href = el.getAttribute("href") || "";
      if (tag === "a" && /^(https?:|mailto:)/i.test(href)) return [new ExternalHyperlink({ link: href, children })];
      return children;
    };
    const walk = (parent: Element, style: InlineStyle = {}, options: ContentOptions = {}, depth = 0) => {
      let pending: ParagraphChild[] = [];
      let pendingHasContent = false;
      let emitted = false;
      const flush = (force = false) => {
        if (pendingHasContent || force) {
          push(pending, { ...options, numbering: emitted ? undefined : options.numbering });
          emitted = true;
        }
        pending = [];
        pendingHasContent = false;
      };
      for (const node of Array.from(parent.childNodes)) {
        const el = node.nodeType === 1 ? node as Element : null;
        const tag = el?.tagName.toLowerCase();
        if (tag && blocked.has(tag)) continue;
        if (el && (tag === "ul" || tag === "ol")) {
          flush();
          const reference = `bicp-list-${numbering.length}`;
          const ordered = tag === "ol";
          numbering.push({ reference, levels: [{
            level: 0, format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: ordered ? "%1." : "•", start: Math.max(1, Number(el.getAttribute("start")) || 1),
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360 * (depth + 1), hanging: 240 } }, run: { font: FONT } },
          }] });
          for (const li of Array.from(el.children).filter((child) => child.tagName.toLowerCase() === "li")) {
            walk(li, elementStyle(li, style), {
              alignment: alignmentOf(li, AlignmentType.LEFT), numbering: { reference, level: 0 },
              indent: { left: 360 * (depth + 1), hanging: 240 },
            }, depth + 1);
          }
          emitted = true;
        } else if (el && tag && blocks.has(tag)) {
          flush();
          walk(el, elementStyle(el, style), {
            ...options, numbering: emitted ? undefined : options.numbering,
            alignment: alignmentOf(el, options.alignment), keepNext: /^h[1-4]$/.test(tag),
          }, depth);
          emitted = true;
        } else {
          pending.push(...inline(node, style));
          pendingHasContent ||= !!node.textContent?.trim() || tag === "br";
        }
      }
      flush(!emitted && parent.tagName.toLowerCase() !== "body");
    };
    // An empty/stale HTML field should not hide a nonempty plain-text document.
    if (document.body.textContent?.trim()) walk(document.body);
  }
  if (!paragraphs.length) {
    for (const line of data.continut.replace(/\r\n?/g, "\n").split("\n")) {
      push([new TextRun({ text: line, font: FONT, size: 24 })]);
    }
  }
  return { paragraphs, numbering };
}

function tableCell(children: Paragraph[], width: number) {
  return new TableCell({ children, width: { size: width, type: WidthType.DXA }, borders: TABLE_BORDERS,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}

function tableRow(cells: TableCell[], widths: number[]) {
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths,
    layout: TableLayoutType.FIXED, borders: TABLE_BORDERS,
    rows: [new TableRow({ children: cells, cantSplit: true })],
  });
}

function tricolor() {
  const widths = [3008, 3009, 3009];
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths,
    layout: TableLayoutType.FIXED, borders: TABLE_BORDERS,
    rows: [new TableRow({ height: { value: 120, rule: HeightRule.EXACT }, cantSplit: true,
      children: ["002B7F", "FCD116", "CE1126"].map((fill, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA }, shading: { fill }, borders: TABLE_BORDERS,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [paragraph("", 2, { spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT } })],
      })),
    })],
  });
}

async function image(buffer: ArrayBuffer, maxWidthPt: number, maxHeightPt: number) {
  const { data, info } = await sharp(Buffer.from(buffer)).rotate().png().toBuffer({ resolveWithObject: true });
  const scale = Math.min(maxWidthPt * 4 / 3 / info.width, maxHeightPt * 4 / 3 / info.height);
  return new ImageRun({ data, type: "png", transformation: {
    width: info.width * scale, height: info.height * scale,
  } });
}

export async function buildBicpDocx(settings: DocxSettings, data: DocxData, variant: BicpDocxVariant = "signed") {
  const simple = variant === "simple";
  const signed = variant === "signed";
  const content = buildContent(data);
  const children: (Paragraph | Table)[] = [];
  let header: Header | undefined;
  let footer: Footer | undefined;
  let topMargin = SIDE_MARGIN;
  let bottomMargin = SIDE_MARGIN;

  if (!simple) {
    const headerLines = settings.headerLines?.length ? settings.headerLines : [
      "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
      "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
    ];
    const leftWidth = Math.round(CONTENT_WIDTH * 0.7);
    const rightWidth = CONTENT_WIDTH - leftWidth;
    const headerChildren = headerLines.map((line) => paragraph(line, 18, { alignment: AlignmentType.CENTER }));
    if (settings.logoArrayBuffer) headerChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 160, after: 160 },
      children: [await image(settings.logoArrayBuffer, leftWidth / 20, 70)],
    }));
    const meta = [
      ...(signed ? [paragraph(settings.secrecyLabel || "NESECRET", 18, { alignment: AlignmentType.RIGHT }, { bold: true }),
        paragraph("Exemplar unic", 18, { alignment: AlignmentType.RIGHT })] : []),
      paragraph(`Nr. ${data.numar || "____"}`, 18, { alignment: AlignmentType.RIGHT }),
      paragraph(`${settings.city ? settings.city + ", " : ""}${data.dateLabel}`, 18, { alignment: AlignmentType.RIGHT }),
    ];
    header = new Header({ children: [
      tableRow([tableCell(headerChildren, leftWidth), tableCell(meta, rightWidth)], [leftWidth, rightWidth]),
      ...(settings.showHeaderTricolor === false ? [] : [tricolor()]), paragraph("", 2),
    ] });
    const footerLines = settings.footerLines || [];
    footer = new Footer({ children: [
      ...(settings.showTricolorFooter === false ? [] : [tricolor()]),
      paragraph("", 2, { spacing: { before: 0, after: 80 } }),
      ...footerLines.map((line) => paragraph(line, 18, { alignment: AlignmentType.CENTER })),
    ] });
    // Reserve room for wrapped custom headers and multiline footers on every page.
    const estimatedHeaderLines = headerLines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 54)), 0);
    topMargin = Math.max(4200, 640 + estimatedHeaderLines * 240 + (settings.logoArrayBuffer ? 1800 : 0) + 600);
    bottomMargin = Math.max(2200, 320 + footerLines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 85)), 0) * 240 + 600);
    children.push(paragraph(settings.unitLabel || "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE", 22,
      { keepNext: true }, { bold: true }));
    if (settings.phone) children.push(paragraph(`Telefon: ${settings.phone}`, 20, { keepNext: true }));
    if (settings.email) children.push(paragraph(`E-mail: ${settings.email}`, 20, { keepNext: true }));
    if (signed) {
      const approvalWidth = 3200;
      const lines = ["APROB", data.semnatar.pentru, data.semnatar.functia, data.semnatar.grad, data.semnatar.nume].filter(Boolean);
      children.push(paragraph("", 2, { spacing: { before: 0, after: 160 }, keepNext: true }));
      children.push(tableRow([
        tableCell([paragraph("")], CONTENT_WIDTH - approvalWidth),
        tableCell(lines.map((line, i) => paragraph(line, 20,
          { alignment: AlignmentType.CENTER, keepNext: i < lines.length - 1, keepLines: true }, { bold: i === 0 })), approvalWidth),
      ], [CONTENT_WIDTH - approvalWidth, approvalWidth]));
    }
    children.push(paragraph(data.tipDocument.toUpperCase(), 32, {
      alignment: AlignmentType.CENTER, spacing: { before: 560, after: 80 }, keepNext: true, keepLines: true,
    }, { bold: true }));
  }
  children.push(paragraph(data.titlu, 28, {
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 }, keepNext: true, keepLines: true,
  }, { bold: true }), ...content.paragraphs);
  if (!simple && settings.showSpokespersonBlock !== false) {
    const display = settings.structureDisplay || settings.unitLabel || "";
    if (data.purtator) children.push(paragraph(data.purtator, 20,
      { spacing: { before: 560, after: 40 }, keepNext: true }, { bold: true }));
    children.push(paragraph(`Purtător de cuvânt ${display}`.trim(), 20,
      { keepNext: signed && !!data.purtatorSignatureArrayBuffer }, { bold: true }));
    if (signed && data.purtatorSignatureArrayBuffer) children.push(new Paragraph({
      spacing: COMPACT_SPACING, children: [await image(data.purtatorSignatureArrayBuffer, 190, 92)],
    }));
  }
  return Packer.toBuffer(new Document({ title: data.titlu,
    compatibility: { doNotExpandShiftReturn: true },
    styles: { default: { document: {
      run: { font: FONT, size: 24, language: { value: "ro-RO" } }, paragraph: { spacing: COMPACT_SPACING },
    } } },
    numbering: { config: content.numbering },
    sections: [{ properties: { page: {
      size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      margin: { top: topMargin, bottom: bottomMargin, left: SIDE_MARGIN, right: SIDE_MARGIN, header: 640, footer: 320 },
    } },
      ...(header ? { headers: { default: header } } : {}),
      ...(footer ? { footers: { default: footer } } : {}), children,
    }],
  }));
}
