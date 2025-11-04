import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 120, height: 120, marginRight: 16 },
  headerCol: { flex: 1, alignItems: "center" },
  headerLine: { fontSize: 12, marginVertical: 2, textAlign: "center" },
  unit: { fontSize: 11, marginTop: 6, fontStyle: "italic" },
  numar: { fontSize: 11, marginTop: 4 },
  title: { marginTop: 24, fontSize: 26, color: "#1d4ed8", textAlign: "center", letterSpacing: 4, fontWeight: 700 },
  paragraph: { marginTop: 12, fontSize: 12, lineHeight: 1.5, textAlign: "justify" },
  name: { color: "#1d4ed8", fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 8 },
  footerTop: { marginTop: 28, fontSize: 9, textAlign: "center" },
  footer: { position: "absolute", left: 40, right: 40, bottom: 28 },
  footerLine: { fontSize: 9, textAlign: "center" },
});

export type AcreditarePdfSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  unitLabel?: string;
  city?: string;
  phone?: string;
  footerLines?: string[];
  assetBaseUrl?: string;
};

export type AcreditarePdfData = {
  numar: string;
  dateLabel: string; // DD/MM/YYYY
  nume: string; // Nume jurnalist
  legit: string; // legitimatia de presa
  redactie: string; // redactia
};

export function AcreditarePdfDoc({ settings, data }: { settings?: AcreditarePdfSettings; data: AcreditarePdfData }) {
  if (settings?.assetBaseUrl) {
    const base = settings.assetBaseUrl;
    try {
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Regular.ttf` });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Bold.ttf`, fontWeight: "bold" });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Italic.ttf`, fontStyle: "italic" });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-BoldItalic.ttf`, fontStyle: "italic", fontWeight: "bold" });
    } catch (e) {}
  }

  const s = settings || {};
  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : [
    "Inspectoratul pentru Situații de Urgență",
    "al Județului",
  ];

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: "NotoSans" }]}>      
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

        <Text style={styles.paragraph}>În conformitate cu prevederile art. 18 din Legea nr.544/2001 se acreditează:</Text>
        <Text style={styles.name}>{data.nume}</Text>
        <Text style={styles.paragraph}>legitimație de presă {data.legit}, eliberată de {data.redactie}, în vederea prezentării activităților instituției.</Text>

        <Text style={styles.paragraph}>Ziaristul acreditat trebuie să poarte la vedere, pe tot timpul prezenței în cadrul instituției, legitimația de jurnalist prezentată la acreditare care îi permite accesul.</Text>
        <Text style={styles.paragraph}>Ziaristul este obligat să țină seama și să aplice principiile deontologice și prevederile legale în vigoare; este interzisă intervenția în desfășurarea activităților instituției.</Text>

        <Text style={styles.footerTop}>Prezentul document conține date cu caracter personal prelucrate și protejate în conformitate cu prevederile legale.</Text>

        {!!(s.footerLines && s.footerLines.length) && (
          <View style={styles.footer} fixed>
            {s.footerLines!.map((l, i) => (
              <Text key={i} style={styles.footerLine}>{l}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}


