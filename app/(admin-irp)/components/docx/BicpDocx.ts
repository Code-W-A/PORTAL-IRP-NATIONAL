import { AlignmentType, Document, Paragraph, Packer, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle } from "docx";
import { DOMParser } from "linkedom";

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
          // Conținut: dacă avem HTML, mapăm taguri de bază (p, strong, em, u, ul/ol/li)
          ...(() => {
            const out: Paragraph[] = [];
            try {
              if (data.continutHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.continutHtml, "text/html");
                const body = doc.body;
                Array.from(body.children).forEach((el, i) => {
                  const tag = el.tagName.toLowerCase();
                  const text = el.textContent || "";
                  if (tag === "p") {
                    const bold = el.querySelector("b, strong") ? true : false;
                    const italic = el.querySelector("i, em") ? true : false;
                    const underline = el.querySelector("u") ? true : false;
                    out.push(new Paragraph({ children: [new TextRun({ text, size: 24, bold, italics: italic, underline: underline ? {} as any : undefined })] }));
                  } else if (tag === "ul" || tag === "ol") {
                    const isOl = tag === "ol";
                    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li");
                    items.forEach((li, idx) => {
                      const t = (li as HTMLElement).textContent || "";
                      out.push(new Paragraph({ children: [new TextRun({ text: `${isOl ? `${idx + 1}. ` : "• "}${t}`, size: 24 })] }));
                    });
                  } else {
                    out.push(new Paragraph({ children: [new TextRun({ text, size: 24 })] }));
                  }
                });
              }
            } catch {}
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


