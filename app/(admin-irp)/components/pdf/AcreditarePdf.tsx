import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Prevent awkward word splitting (hyphenation) in Romanian headers/text.
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Font as any).registerHyphenationCallback?.((word: string) => [word]);
} catch {}

const styles = StyleSheet.create({
  // Align with BICP PDFs (margins + footer spacing)
  page: { padding: 78, paddingTop: 54, paddingBottom: 110 },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 84, height: 84, marginRight: 12 },
  headerCol: { flex: 1, alignItems: "center" },
  headerLine: { fontSize: 11.5, marginVertical: 1.5, textAlign: "center", fontWeight: 700 },
  unit: { fontSize: 10.5, marginTop: 6, fontStyle: "italic", textAlign: "center", fontWeight: 700 },
  numar: { fontSize: 11, marginTop: 6, textAlign: "center", fontWeight: 700 },
  title: { marginTop: 24, fontSize: 28, color: "#2563eb", textAlign: "center", letterSpacing: 6, fontWeight: 700 },
  paragraph: { marginTop: 10, fontSize: 11.2, lineHeight: 1.45, textAlign: "justify" },
  name: { color: "#2563eb", fontSize: 13.5, fontWeight: 700, textAlign: "center", marginTop: 10 },
  bold: { fontWeight: 700 },
  center: { textAlign: "center" },
  // Flow layout (no absolute positioning) so it can move to the next page if needed
  signArea: { marginTop: 22, flexDirection: "row", justifyContent: "space-between" },
  signCol: { width: "48%", alignItems: "center" },
  signTitle: { fontSize: 10.5, fontWeight: 700, textAlign: "center" },
  signSub: { fontSize: 9.5, fontWeight: 700, textAlign: "center", marginTop: 2 },
  signGrad: { fontSize: 9.5, fontStyle: "italic", fontWeight: 700, textAlign: "center", marginTop: 8 },
  signName: { fontSize: 10.2, fontStyle: "italic", fontWeight: 700, textAlign: "center", marginTop: 3 },
  // Footer aligned with BICP PDFs
  footer: { position: "absolute", left: 78, right: 78, bottom: 16 },
  footerLine: { fontSize: 9, textAlign: "center" },
  // Tricolor bar above footer (same as BICP)
  tricolorFooter: { position: "absolute", left: 78, right: 78, height: 6, flexDirection: "row" },
  triBlue: { flex: 1, backgroundColor: "#002B7F" },
  triYellow: { flex: 1, backgroundColor: "#FCD116" },
  triRed: { flex: 1, backgroundColor: "#CE1126" },
});

export type AcreditareSemnatar = {
  functia?: string; // poate conține \n pentru mai multe linii
  grad?: string;
  nume?: string;
};

export type AcreditarePdfSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  unitLabel?: string;
  city?: string;
  phone?: string;
  footerLines?: string[];
  assetBaseUrl?: string;
  acreditareSemnatarStanga?: AcreditareSemnatar;
  acreditareSemnatarDreapta?: AcreditareSemnatar;
  acreditareSemnatarStangaImg?: string;
  acreditareSemnatarDreaptaImg?: string;
};

export type AcreditarePdfVariant = "signed" | "public";

export type AcreditarePdfData = {
  numar: string;
  dateLabel: string; // DD/MM/YYYY
  nume: string; // Nume jurnalist
  legit: string; // legitimatia de presa
  redactie: string; // redactia
  sex?: "F" | "M"; // pentru "doamna/domnul"
};

export function AcreditarePdfDoc({
  settings,
  data,
  variant = "signed",
}: {
  settings?: AcreditarePdfSettings;
  data: AcreditarePdfData;
  variant?: AcreditarePdfVariant;
}) {
  // Use same font as BICP PDFs
  try {
    const base = settings?.assetBaseUrl || "";
    const makeUrl = (p: string) => {
      if (p.startsWith("http://") || p.startsWith("https://")) return p;
      return base ? new URL(p, base).toString() : p;
    };
    Font.register({ family: "NotoSerif", src: makeUrl("/fonts/NotoSerif-Regular.ttf") });
    Font.register({ family: "NotoSerif", src: makeUrl("/fonts/NotoSerif-Bold.ttf"), fontWeight: "bold" });
    Font.register({ family: "NotoSerif", src: makeUrl("/fonts/NotoSerif-Italic.ttf"), fontStyle: "italic" });
    Font.register({ family: "NotoSerif", src: makeUrl("/fonts/NotoSerif-BoldItalic.ttf"), fontStyle: "italic", fontWeight: "bold" });
  } catch {}

  const s = settings || {};
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "Inspectoratul pentru Situații de Urgență",
    "al Județului",
  ];

  function linesOf(v?: string): string[] {
    const raw = String(v || "").trim();
    if (!raw) return [];
    return raw.split("\n").map((x) => x.trim()).filter(Boolean);
  }

  const st = s.acreditareSemnatarStanga || {};
  const dr = s.acreditareSemnatarDreapta || {};
  const stImg = s.acreditareSemnatarStangaImg;
  const drImg = s.acreditareSemnatarDreaptaImg;
  const footerLines = Array.isArray(s.footerLines) ? s.footerLines : [];
  const footerLinesCount = footerLines.length;
  // keep tricolor above footer even when there are many footer lines (same logic as BICP)
  const tricolorBottom = 40 + Math.max(0, footerLinesCount - 1) * 12;
  // Reserve space for the fixed footer/tricolor so flowing content never overlaps it
  const contentPaddingBottom = Math.max(110, tricolorBottom + 26);

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: "NotoSerif", paddingBottom: contentPaddingBottom }]}>
        <View style={styles.headerRow}>
          {s.logoUrlPublic ? <Image src={s.logoUrlPublic} style={styles.logo} /> : null}
          <View style={styles.headerCol}>
            {headerLines.map((l, i) => (
              <Text key={i} style={styles.headerLine}>{l}</Text>
            ))}
            {s.unitLabel ? <Text style={styles.unit}>{s.unitLabel}</Text> : null}
            <Text style={styles.numar}>Nr. {data.numar} din {data.dateLabel}</Text>
          </View>
        </View>

        <Text style={styles.title}>ACREDITARE</Text>

        {(() => {
          const sx = String((data as any)?.sex || "").toUpperCase();
          const apelativ = sx === "M" ? "domnul" : sx === "F" ? "doamna" : "doamna/domnul";
          return (
            <Text style={styles.paragraph}>
              În conformitate cu prevederile art. 18 din <Text style={styles.bold}>Legea nr. 544/2001</Text> se acreditează {apelativ}:
            </Text>
          );
        })()}
        <Text style={styles.name}>{String(data.nume || "").toUpperCase()}</Text>
        <Text style={styles.paragraph}>
          legitimație de presă nr. <Text style={styles.bold}>{data.legit}</Text>, eliberată de redacția <Text style={styles.bold}>{data.redactie}</Text>, în vederea
          prezentării activităților instituției.
        </Text>

        <Text style={styles.paragraph}>
          Ziaristul acreditat trebuie să poarte la vedere, pe tot timpul prezenței, legitimația de jurnalist prezentată la acreditare care îi permite accesul.
        </Text>
        <Text style={styles.paragraph}>
          Ziaristul este obligat să țină seama și să aplice principiile deontologice cuprinse în{" "}
          <Text style={styles.bold}>Rezoluția nr. 1003(1993)</Text> și <Text style={styles.bold}>nr. 1215(1993)</Text> ale Adunării Parlamentare a Consiliului{" "}
          Europei, având în vedere deosebita responsabilitate ce le revine în evoluția democrației și dezvoltarea vieții democratice, pentru informarea corectă a opiniei publice
          și respectarea valorilor morale și a drepturilor cetățenești.
        </Text>
        <Text style={styles.paragraph}>
          Ziaristul acreditat la inspectorat are acces la Compartimentul de Informare și Relații Publice, în sala de desfășurare a conferințelor de presă și în alte spații
          unde se desfășoară activități ce fac interesul prezenței ziariștilor, însoțit de un reprezentant al inspectoratului.
        </Text>
        <Text style={styles.paragraph}>
          Ziaristul acreditat nu poate interveni, sub nicio formă, în desfășurarea activităților instituției. Nerespectarea acestor prevederi atrage după sine anularea acreditării.
        </Text>

        {variant === "signed" && (
          <>
            {/* Push signatures towards the bottom when there's room; if not, they'll naturally flow onto the next page */}
            <View style={{ flexGrow: 1 }} />
            <View style={styles.signArea}>
            <View style={styles.signCol}>
              {stImg ? <Image src={stImg} style={{ width: 140, height: 70, objectFit: "contain" }} /> : null}
              {linesOf(st.functia).length ? (
                <>
                  {linesOf(st.functia).map((l, i) => (
                    <Text key={i} style={i === 0 ? styles.signTitle : styles.signSub}>{l}</Text>
                  ))}
                </>
              ) : (
                <Text style={styles.signTitle} />
              )}
              {st.grad ? <Text style={styles.signGrad}>{st.grad}</Text> : <Text style={styles.signGrad} />}
              {st.nume ? <Text style={styles.signName}>{st.nume}</Text> : <Text style={styles.signName} />}
            </View>

            <View style={styles.signCol}>
              {drImg ? <Image src={drImg} style={{ width: 140, height: 70, objectFit: "contain" }} /> : null}
              {linesOf(dr.functia).length ? (
                <>
                  {linesOf(dr.functia).map((l, i) => (
                    <Text key={i} style={i === 0 ? styles.signTitle : styles.signSub}>{l}</Text>
                  ))}
                </>
              ) : (
                <Text style={styles.signTitle} />
              )}
              {dr.grad ? <Text style={styles.signGrad}>{dr.grad}</Text> : <Text style={styles.signGrad} />}
              {dr.nume ? <Text style={styles.signName}>{dr.nume}</Text> : <Text style={styles.signName} />}
            </View>
            </View>
          </>
        )}

        {/* Tricolor bar + footer (same pattern as Communicate/Buletine) */}
        <View style={[styles.tricolorFooter, { bottom: tricolorBottom }]} fixed>
          <View style={styles.triBlue} />
          <View style={styles.triYellow} />
          <View style={styles.triRed} />
        </View>

        {!!footerLinesCount && (
          <View style={styles.footer} fixed>
            {footerLines.map((l, i) => (
              <Text key={i} style={styles.footerLine}>{l}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

