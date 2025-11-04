import { AlignmentType, Document, Paragraph, Packer, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle } from "docx";

export type DocxSettings = {
  headerLines?: string[];
  logoArrayBuffer?: ArrayBuffer | null;
  secrecyLabel?: string;
  city?: string;
  phone?: string;
  unitLabel?: string;
};

export type DocxData = {
  numar: string;
  dateLabel: string;
  purtator: string;
  tipDocument: string;
  titlu: string;
  continut: string;
  continutHtml?: string;
  semnatar: { pentru: string; functia: string; grad: string; nume: string };
};

function parseHtmlToParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  try {
    const normalized = html
      .replace(/<br\s*\/?>(\r?\n)?/gi, "\n")
      .replace(/\r\n|\r/g, "\n");

    const blockRegex = /<(p|ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    const blocks: { tag: string; inner: string }[] = [];
    while ((match = blockRegex.exec(normalized)) !== null) {
      blocks.push({ tag: match[1].toLowerCase(), inner: match[2] });
    }

    const pushParagraph = (text: string, opts?: { bold?: boolean; italics?: boolean; underline?: boolean }) => {
      const run = new TextRun({ text, size: 24, bold: opts?.bold, italics: opts?.italics, underline: opts?.underline ? ({} as any) : undefined });
      paragraphs.push(new Paragraph({ children: [run] }));
    };

    if (blocks.length === 0) {
      // Fallback: treat as plain text
      const plain = normalized.replace(/<[^>]+>/g, "").trim();
      if (plain) pushParagraph(plain);
      return paragraphs;
    }

    for (const b of blocks) {
      if (b.tag === "p") {
        const hasBold = /<(b|strong)[^>]*>/i.test(b.inner);
        const hasItalic = /<(i|em)[^>]*>/i.test(b.inner);
        const hasUnderline = /<u[^>]*>/i.test(b.inner);
        const text = b.inner.replace(/<[^>]+>/g, "").trim();
        if (text) pushParagraph(text, { bold: hasBold, italics: hasItalic, underline: hasUnderline });
      } else if (b.tag === "ul" || b.tag === "ol") {
        const isOl = b.tag === "ol";
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m: RegExpExecArray | null;
        let idx = 0;
        while ((m = liRegex.exec(b.inner)) !== null) {
          const liText = (m[1] || "").replace(/<[^>]+>/g, "").trim();
          if (!liText) continue;
          const prefix = isOl ? `${++idx}. ` : "• ";
          pushParagraph(prefix + liText);
        }
      }
    }
  } catch {}
  return paragraphs;
}

export async function buildBicpDocx(settings: DocxSettings, data: DocxData) {
  const headerLines = settings.headerLines && settings.headerLines.length ? settings.headerLines : [
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
    "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
  ];

  const headerCol = new TableCell({
    children: headerLines.map((l) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, size: 18 })] })),
    width: { size: 70, type: WidthType.PERCENTAGE },
    margins: { left: 80 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
    },
  });

  const meta = [
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: settings.secrecyLabel || "NESECRET", bold: true, size: 18, font: "DejaVu Sans" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Exemplar unic", size: 18, font: "DejaVu Sans" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Nr. ${data.numar || "____"}`, size: 18, font: "DejaVu Sans" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${settings.city ? settings.city + ", " : ""}${data.dateLabel}`, size: 18, font: "DejaVu Sans" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: data.purtator || "", size: 18, font: "DejaVu Sans" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: settings.phone || "", size: 18, font: "DejaVu Sans" })] }),
  ];

  const metaCol = new TableCell({ 
    children: meta, 
    width: { size: 30, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
    },
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
    },
    rows: [new TableRow({ children: [headerCol, metaCol] })],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "DejaVu Sans",
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          table,
          // APROB pe rând separat, aliniat la dreapta (dar centrat în box)
          new Paragraph({}),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: "none", size: 0, color: "ffffff" },
              bottom: { style: "none", size: 0, color: "ffffff" },
              left: { style: "none", size: 0, color: "ffffff" },
              right: { style: "none", size: 0, color: "ffffff" },
              insideHorizontal: { style: "none", size: 0, color: "ffffff" },
              insideVertical: { style: "none", size: 0, color: "ffffff" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ 
                    children: [new Paragraph("")], 
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: "none", size: 0, color: "ffffff" },
                      bottom: { style: "none", size: 0, color: "ffffff" },
                      left: { style: "none", size: 0, color: "ffffff" },
                      right: { style: "none", size: 0, color: "ffffff" },
                    }
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: "none", size: 0, color: "ffffff" },
                      bottom: { style: "none", size: 0, color: "ffffff" },
                      left: { style: "none", size: 0, color: "ffffff" },
                      right: { style: "none", size: 0, color: "ffffff" },
                    },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "APROB", bold: true, size: 18, font: "DejaVu Sans" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.pentru, size: 18, font: "DejaVu Sans" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.functia, size: 18, font: "DejaVu Sans" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.grad, size: 18, font: "DejaVu Sans" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.nume, size: 18, font: "DejaVu Sans" })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Spațiu + unitate jos stânga (semibold ~600)
          new Paragraph({ spacing: { after: 200 } }),
          ...(settings.unitLabel
            ? [
                new Paragraph({
                  children: [new TextRun({ text: settings.unitLabel, bold: true, size: 28 })],
                }),
              ]
            : []),
          new Paragraph({ 
            children: [new TextRun({ text: data.tipDocument, italics: true, bold: true, size: 22 })],
            spacing: { before: 400, after: 100 }
          }),
          new Paragraph({ 
            children: [new TextRun({ text: data.titlu, bold: true, size: 30 })],
            spacing: { after: 200 }
          }),
          // Conținut: dacă avem HTML, mapăm taguri de bază (p, strong, em, u, ul/ol/li) fără DOMParser
          ...(() => {
            const out: Paragraph[] = data.continutHtml ? parseHtmlToParagraphs(data.continutHtml) : [];
            if (out.length === 0) {
              out.push(new Paragraph({ children: [new TextRun({ text: data.continut, size: 24 })] }));
            }
            return out;
          })(),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}


