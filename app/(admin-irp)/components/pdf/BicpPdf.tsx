import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 100 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  headerCol: { flex: 7, alignItems: "center", marginLeft: -50 },
  metaCol: { flex: 3, alignItems: "flex-end", paddingRight: 8 },
  headerLine: { fontSize: 9, marginVertical: 1, fontFamily: "NotoSerif" },
  logo: { height: 84, marginVertical: 6 },
  secrecy: { fontSize: 9, fontWeight: 700, fontFamily: "NotoSerif" },
  meta: { fontSize: 9, marginVertical: 1, textAlign: "right", fontFamily: "NotoSerif" },
  type: { marginTop: 28, fontSize: 16, fontStyle: "italic", fontWeight: 700, fontFamily: "NotoSerif" },
  title: { fontSize: 14, fontWeight: 600, marginTop: 4, fontFamily: "NotoSerif" },
  content: { fontSize: 12, lineHeight: 1.35, marginTop: 12, fontFamily: "NotoSerif" },
  approveRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 28 },
  approveBox: { alignItems: "center", width: 160, marginRight: 88 },
  approveTitle: { fontSize: 10, fontWeight: 700, fontFamily: "NotoSerif" },
  approveLine: { fontSize: 10, marginTop: 2, textAlign: "center", fontFamily: "NotoSerif" },
  footer: { position: "absolute", left: 32, right: 32, bottom: 24 },
  footerLine: { fontSize: 9, textAlign: "center", fontFamily: "NotoSerif" },
  unitInline: { fontSize: 14, fontWeight: 600, marginTop: 28, textAlign: "left" },
});

export type BicpPdfSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  secrecyLabel?: string;
  city?: string;
  phone?: string;
  footerLines?: string[];
  unitLabel?: string;
  assetBaseUrl?: string; // absolute origin for server-side font/logo fetching
};

export type BicpPdfData = {
  numar: string;
  dateLabel: string; // DD/MM/YYYY sau similar
  purtator: string;
  tipDocument: string;
  titlu: string;
  continut: string;
  continutHtml?: string;
  semnatar: { pentru: string; functia: string; grad: string; nume: string };
};

export type BicpPdfVariant = "signed" | "public";

function registerNoto(assetBaseUrl?: string) {
  try {
    const makeUrl = (p: string) => {
      if (p.startsWith("http://") || p.startsWith("https://")) return p;
      const base = assetBaseUrl || "";
      return base ? new URL(p, base).toString() : p;
    };
    const nserRegular = makeUrl("/fonts/NotoSerif-Regular.ttf");
    const nserBold = makeUrl("/fonts/NotoSerif-Bold.ttf");
    const nserItalic = makeUrl("/fonts/NotoSerif-Italic.ttf");
    const nserBoldItalic = makeUrl("/fonts/NotoSerif-BoldItalic.ttf");
    Font.register({ family: "NotoSerif", src: nserRegular });
    Font.register({ family: "NotoSerif", src: nserBold, fontWeight: "bold" });
    Font.register({ family: "NotoSerif", src: nserItalic, fontStyle: "italic" });
    Font.register({ family: "NotoSerif", src: nserBoldItalic, fontStyle: "italic", fontWeight: "bold" });
  } catch {}
}

function renderHtmlContent(html: string) {
    if (typeof window === "undefined") return null;
    try {
      // Use browser's DOMParser only on client to avoid bundling node polyfills
      const parser: any = new (window as any).DOMParser();
      const doc: any = parser.parseFromString(html, "text/html");
      const body: any = doc.body;
      const elements: React.ReactNode[] = [];

      function renderChildren(node: any, inheritedStyle: any = {}): React.ReactNode[] {
        const out: React.ReactNode[] = [];
        node.childNodes.forEach((child: any, idx: number) => {
          if (child.nodeType === 3) {
            const text = child.textContent || "";
            if (text) out.push(<Text key={`t-${idx}`} style={inheritedStyle}>{text}</Text>);
            return;
          }
          if (child.nodeType === 1) {
            const el: any = child as any;
            const tag = String(el.tagName || "").toLowerCase();
            const nextStyle = { ...inheritedStyle } as any;
            if (tag === "strong" || tag === "b") nextStyle.fontWeight = 700;
            if (tag === "em" || tag === "i") nextStyle.fontStyle = "italic";
            if (tag === "u") nextStyle.textDecoration = "underline";
            if (tag === "br") {
              out.push(<Text key={`br-${idx}`}>{"\n"}</Text>);
              return;
            }
            if (tag === "a") {
              // just render text content for now
              out.push(...renderChildren(child, nextStyle));
              return;
            }
            // inline container or others
            out.push(<Text key={`in-${idx}`} style={nextStyle}>{renderChildren(child, nextStyle)}</Text>);
          }
        });
        return out;
      }

      Array.from(body.children as any).forEach((el: any, i: number) => {
        const tag = String(el.tagName || "").toLowerCase();
        if (tag === "p") {
          elements.push(
            <Text key={`p-${i}`} style={styles.content}>
              {renderChildren(el)}
              {"\n"}
            </Text>
          );
        } else if (tag === "ul" || tag === "ol") {
          const isOl = tag === "ol";
          const items = Array.from(el.children as any).filter((c: any) => String(c.tagName || "").toLowerCase() === "li");
          items.forEach((li: any, idx: number) => {
            elements.push(
              <Text key={`li-${i}-${idx}`} style={styles.content}>
                {isOl ? `${idx + 1}. ` : "• "}
                {renderChildren(li)}
                {"\n"}
              </Text>
            );
          });
        } else {
          // fallback treat as paragraph
          elements.push(
            <Text key={`x-${i}`} style={styles.content}>
              {renderChildren(el)}
              {"\n"}
            </Text>
          );
        }
      });
      return <>{elements}</>;
    } catch {
      return null;
    }
  }

export function createBicpPage({ data, settings, variant = "signed" }: { data: BicpPdfData; settings?: BicpPdfSettings; variant?: BicpPdfVariant }) {
  registerNoto(settings?.assetBaseUrl);
  const s = settings || {};
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
    "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
  ];
  return (
    <Page size="A4" style={[styles.page, { fontFamily: "NotoSerif" }]}> 
      <View style={styles.row}>
        <View style={styles.headerCol}>
          {headerLines.map((l, idx) => (
            <Text key={idx} style={styles.headerLine}>{l}</Text>
          ))}
          {s.logoUrlPublic ? <Image src={s.logoUrlPublic} style={styles.logo} /> : null}
        </View>
        <View style={styles.metaCol}>
          {variant === "signed" && (
            <>
              <Text style={styles.secrecy}>{s.secrecyLabel || "NESECRET"}</Text>
              <Text style={styles.meta}>Exemplar unic</Text>
            </>
          )}
          <Text style={styles.meta}>Nr. {data.numar || "____"}</Text>
          <Text style={styles.meta}>{(s.city ? s.city + ", " : "") + (data.dateLabel || "")}</Text>
          <Text style={styles.meta}>{data.purtator || ""}</Text>
          {variant === "signed" && (
            <Text style={styles.meta}>{s.phone || ""}</Text>
          )}
        </View>
      </View>

      {variant === "signed" && (
        <View style={styles.approveRow}>
          <View style={styles.approveBox}>
            <Text style={styles.approveTitle}>APROB</Text>
            <Text style={styles.approveLine}>{data.semnatar.pentru}</Text>
            <Text style={styles.approveLine}>{data.semnatar.functia}</Text>
            <Text style={styles.approveLine}>{data.semnatar.grad}</Text>
            <Text style={styles.approveLine}>{data.semnatar.nume}</Text>
          </View>
        </View>
      )}

      <Text style={styles.type}>{data.tipDocument}</Text>
      <Text style={styles.title}>{data.titlu}</Text>
      {data.continutHtml ? (
        <View>{renderHtmlContent(data.continutHtml) || <Text style={styles.content}>{data.continut}</Text>}</View>
      ) : (
        <Text style={styles.content}>{data.continut}</Text>
      )}

      {s.unitLabel ? (
        <Text style={[styles.unitInline]}>{s.unitLabel}</Text>
      ) : null}

      {s.footerLines && s.footerLines.length > 0 ? (
        <View style={styles.footer} fixed>
          {s.footerLines.map((l, i) => (
            <Text key={i} style={styles.footerLine}>{l}</Text>
          ))}
        </View>
      ) : null}
    </Page>
  );
}

export function BicpPdfDoc({ data, settings, variant = "signed" }: { data: BicpPdfData; settings?: BicpPdfSettings; variant?: BicpPdfVariant }) {
  registerNoto(settings?.assetBaseUrl);
  const s = settings || {};
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
    "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
  ];

  return (
    <Document>
      {createBicpPage({ data, settings, variant })}
    </Document>
  );
}


