import { AlignmentType, Document, Paragraph, Packer, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle } from "docx";

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

    type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];
    const pushParagraph = (text: string, opts?: { bold?: boolean; italics?: boolean; underline?: boolean; alignment?: AlignmentValue }) => {
      const run = new TextRun({
        text,
        size: 24, // 12pt
        bold: opts?.bold,
        italics: opts?.italics,
        underline: opts?.underline ? ({} as any) : undefined,
      });
      paragraphs.push(
        new Paragraph({
          children: [run],
          alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
          spacing: { after: 120 },
        })
      );
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
        if (text) pushParagraph(text, { bold: hasBold, italics: hasItalic, underline: hasUnderline, alignment: AlignmentType.JUSTIFIED });
      } else if (b.tag === "ul" || b.tag === "ol") {
        const isOl = b.tag === "ol";
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m: RegExpExecArray | null;
        let idx = 0;
        while ((m = liRegex.exec(b.inner)) !== null) {
          const liText = (m[1] || "").replace(/<[^>]+>/g, "").trim();
          if (!liText) continue;
          const prefix = isOl ? `${++idx}. ` : "• ";
          pushParagraph(prefix + liText, { alignment: AlignmentType.LEFT });
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

  const headerChildren: Paragraph[] = [];
  // Header lines first (like PDF)
  headerChildren.push(
    ...headerLines.map(
      (l) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: l, size: 18, font: "Noto Serif" })],
        })
    )
  );
  // Then logo under header lines (like PDF)
  if (settings.logoArrayBuffer) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: new Uint8Array(settings.logoArrayBuffer),
            transformation: { width: 140, height: 70 },
            type: "png",
          }),
        ],
      })
    );
  }

  const headerCol = new TableCell({
    children: headerChildren,
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
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: settings.secrecyLabel || "NESECRET", bold: true, size: 18, font: "Noto Serif" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Exemplar unic", size: 18, font: "Noto Serif" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Nr. ${data.numar || "____"}`, size: 18, font: "Noto Serif" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${settings.city ? settings.city + ", " : ""}${data.dateLabel}`, size: 18, font: "Noto Serif" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: data.purtator || "", size: 18, font: "Noto Serif" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: settings.phone || "", size: 18, font: "Noto Serif" })] }),
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

  const headerTricolor = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "002B7F" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "FCD116" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "CE1126" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
        ],
      }),
    ],
  });

  const footerTricolor = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "002B7F" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "FCD116" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            shading: { fill: "CE1126" },
            children: [new Paragraph({})],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              left: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
              right: { style: BorderStyle.NONE, size: 0, color: "ffffff" },
            },
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Noto Serif",
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          table,
          headerTricolor,
          // Contact block under header (like PDF)
          new Paragraph({
            children: [new TextRun({ text: settings.unitLabel || "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE", bold: true, size: 22, font: "Noto Serif" })],
            spacing: { before: 120, after: 60 },
          }),
          ...(settings.phone ? [new Paragraph({ children: [new TextRun({ text: `Telefon: ${settings.phone}`, size: 20, font: "Noto Serif" })] })] : []),
          ...(settings.email ? [new Paragraph({ children: [new TextRun({ text: `E-mail: ${settings.email}`, size: 20, font: "Noto Serif" })] })] : []),
          new Paragraph({ spacing: { after: 160 } }),
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
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "APROB", bold: true, size: 20, font: "Noto Serif" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.pentru, size: 20, font: "Noto Serif" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.functia, size: 20, font: "Noto Serif" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.grad, size: 20, font: "Noto Serif" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.semnatar.nume, size: 20, font: "Noto Serif" })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ 
            children: [new TextRun({ text: (data.tipDocument || "").toUpperCase(), bold: true, size: 32, font: "Noto Serif" })],
            spacing: { before: 280, after: 80 },
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ 
            children: [new TextRun({ text: data.titlu, bold: true, size: 28, font: "Noto Serif" })],
            spacing: { after: 160 },
            alignment: AlignmentType.CENTER,
          }),
          // Conținut: dacă avem HTML, mapăm taguri de bază (p, strong, em, u, ul/ol/li) fără DOMParser
          ...(() => {
            const out: Paragraph[] = data.continutHtml ? parseHtmlToParagraphs(data.continutHtml) : [];
            if (out.length === 0) {
              out.push(new Paragraph({ children: [new TextRun({ text: data.continut, size: 24, font: "Noto Serif" })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } }));
            }
            return out;
          })(),
          // Bloc purtător de cuvânt (opțional) similar PDF
          ...(() => {
            if (settings.showSpokespersonBlock === false) return [];
            const lines: Paragraph[] = [];
            if (data.purtator) {
              lines.push(new Paragraph({ children: [new TextRun({ text: data.purtator, size: 20, bold: true, font: "Noto Serif" })], spacing: { before: 200 } }));
            }
            const disp = settings.structureDisplay || settings.unitLabel || "";
            if (disp) {
              lines.push(new Paragraph({ children: [new TextRun({ text: `Purtător de cuvânt ${disp}`, size: 20, bold: true, font: "Noto Serif" })] }));
            }
            return lines;
          })(),
          // Footer lines (opțional)
          ...(() => {
            const fl = settings.footerLines || [];
            if (!fl.length) return [];
            return fl.map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 18, font: "Noto Serif" })], alignment: AlignmentType.CENTER }));
          })(),
          ...(settings.footerLines && settings.footerLines.length ? [new Paragraph({ spacing: { before: 80 } })] : []),
          footerTricolor,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}


