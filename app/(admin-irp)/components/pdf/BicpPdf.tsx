import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { getTenantContext } from "@/lib/tenant";
import { JUDETE } from "@/lib/judete";

export const styles = StyleSheet.create({
  page: { padding: 72, paddingTop: 210, paddingBottom: 110 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  headerCol: { flex: 7, alignItems: "center" },
  metaCol: { flex: 3, alignItems: "flex-end", paddingRight: 8 },
  headerLine: { fontSize: 9, marginVertical: 1, fontFamily: "NotoSerif", textAlign: "center" },
  logo: { height: 70, marginVertical: 8 },
  secrecy: { fontSize: 9, fontWeight: 700, fontFamily: "NotoSerif" },
  meta: { fontSize: 9, marginVertical: 1, textAlign: "right", fontFamily: "NotoSerif" },
  metaLeft: { fontSize: 9, marginVertical: 1, textAlign: "left", fontFamily: "NotoSerif" },
  type: { marginTop: 28, fontSize: 16, fontStyle: "italic", fontWeight: 700, fontFamily: "NotoSerif", textAlign: "center" },
  title: { fontSize: 14, fontWeight: 600, marginTop: 4, fontFamily: "NotoSerif", textAlign: "center" },
  content: { fontSize: 12, lineHeight: 1.35, marginTop: 12, fontFamily: "NotoSerif", textAlign: "justify" },
  approveRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  approveBox: { alignItems: "center", width: 160, marginRight: 0 },
  approveTitle: { fontSize: 10, fontWeight: 700, fontFamily: "NotoSerif" },
  approveLine: { fontSize: 10, marginTop: 2, textAlign: "center", fontFamily: "NotoSerif" },
  footer: { position: "absolute", left: 72, right: 72, bottom: 16 },
  footerLine: { fontSize: 9, textAlign: "center", fontFamily: "NotoSerif" },
  unitInline: { fontSize: 14, fontWeight: 600, marginTop: 28, textAlign: "left" },
  spokespersonBlock: { marginTop: 28 },
  spLabel: { fontSize: 11, fontWeight: 700, fontFamily: "NotoSerif" },
  spLine: { fontSize: 10, marginTop: 2, fontFamily: "NotoSerif", fontWeight: 700 },
  // Tricolor bars
  tricolorFooter: { position: "absolute", left: 72, right: 72, bottom: 40, height: 6, flexDirection: "row" },
  triBlue: { flex: 1, backgroundColor: "#002B7F" },
  triYellow: { flex: 1, backgroundColor: "#FCD116" },
  triRed: { flex: 1, backgroundColor: "#CE1126" },
  headerAccent: { marginTop: 6, width: 140, height: 6, flexDirection: "row" },
  headerTriFull: { marginTop: 6, width: "100%", height: 8, flexDirection: "row" },
  headerTriTopFixed: { position: "absolute", left: 72, right: 72, top: 220, height: 8, flexDirection: "row" },
  // Info strap under crest
  strapRow: { marginTop: 8, width: "100%", flexDirection: "row", alignItems: "stretch" },
  contactBlock: { marginTop: 6, width: "100%" },
  strapLeftTitle: { fontSize: 11, fontWeight: 700, color: "#000000", fontFamily: "NotoSerif" },
  strapLeftLine: { fontSize: 10, color: "#000000", marginTop: 2, fontFamily: "NotoSerif" },
  strapRight: { flex: 1, flexDirection: "row", height: 8, alignSelf: "center" },
  fixedHeaderContainer: { position: "absolute", left: 72, right: 72, top: 32 },
});

export type BicpPdfSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  secrecyLabel?: string;
  city?: string;
  email?: string;
  phone?: string;
  footerLines?: string[];
  unitLabel?: string;
  assetBaseUrl?: string; // absolute origin for server-side font/logo fetching
  showTricolorFooter?: boolean;
  showHeaderTricolor?: boolean;
  spokespersonGrade?: string; // ex: "Sergent-major"
  showSpokespersonBlock?: boolean; // default true
  structureDisplay?: string; // ex: "ISU Sibiu"
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
  const footerLinesCount = Array.isArray(s.footerLines) ? s.footerLines.length : 0;
  // Move tricolor higher when there are more footer lines to avoid overlap
  const tricolorBottom = 40 + Math.max(0, footerLinesCount - 1) * 12; // base 40 + ~12pt per extra line
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
    "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
  ];
  return (
    <Page size="A4" style={[styles.page, { fontFamily: "NotoSerif" }]}> 
      {/* Fixed header block (repeats on all pages) */}
      <View style={styles.fixedHeaderContainer} fixed>
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
          </View>
        </View>
        {(s.showHeaderTricolor !== false) && (
          <View style={styles.headerTriFull}>
            <View style={styles.triBlue} />
            <View style={styles.triYellow} />
            <View style={styles.triRed} />
          </View>
        )}
      </View>

      {/* Spacer removed; top padding on page ensures content never overlaps header on any page */}
      {/* First-page only contact block placed in flow so it appears once at top of content */}
      <View>
        <Text style={styles.strapLeftTitle}>{s.unitLabel || "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE"}</Text>
        {!!s.phone && <Text style={styles.strapLeftLine}>Telefon: {s.phone}</Text>}
        {!!s.email && <Text style={styles.strapLeftLine}>E-mail: {s.email}</Text>}
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

      {(s.showSpokespersonBlock !== false) && (
        <View style={styles.spokespersonBlock}>
          {!!data.purtator && <Text style={styles.spLine}>{data.purtator}</Text>}
          <Text style={styles.spLine}>Purtător de cuvânt {s.structureDisplay || s.unitLabel || ""}</Text>
        </View>
      )}

      {(s.showTricolorFooter !== false) && (
        <View style={[styles.tricolorFooter, { bottom: tricolorBottom }]} fixed>
          <View style={styles.triBlue} />
          <View style={styles.triYellow} />
          <View style={styles.triRed} />
        </View>
      )}

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
  // Derive structure display if not provided
  let derivedStructureDisplay = s.structureDisplay;
  try {
    const { judetId, structuraId } = getTenantContext();
    const judName = JUDETE.find((j) => j.id === judetId)?.name || judetId;
    if (!derivedStructureDisplay) derivedStructureDisplay = `${structuraId} ${judName}`;
  } catch {}
  const s2: BicpPdfSettings = { ...s, structureDisplay: derivedStructureDisplay };
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
    "INSPECTORATUL GENERAL PENTRU SITUAȚII DE URGENȚĂ",
  ];

  return (
    <Document>
      {createBicpPage({ data, settings: s2, variant })}
      {/* Page template for subsequent pages (only full-width tricolor on top) could be handled by content spill; 
          to enforce, consumers can split content. Keeping single page factory to avoid duplication. */}
    </Document>
  );
}


