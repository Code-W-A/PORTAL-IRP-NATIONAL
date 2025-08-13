import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40 },
  header: { alignItems: "center" },
  hSmall: { fontSize: 10, marginVertical: 1, textAlign: "center" },
  hTitle: { fontSize: 18, marginTop: 4, fontWeight: 700, textAlign: "center" },
  meta: { marginTop: 8, fontSize: 11, textAlign: "center" },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 6 },
  tocItem: { fontSize: 11, marginVertical: 2 },
  itemBox: { marginTop: 12 },
  itemMeta: { fontSize: 11, marginBottom: 4 },
  itemTitle: { fontSize: 12, fontWeight: 700 },
  itemContent: { fontSize: 11, marginTop: 4, lineHeight: 1.35, textAlign: "justify" },
  footer: { position: "absolute", left: 40, right: 40, bottom: 28 },
  footerLine: { fontSize: 9, textAlign: "center" },
  signerBox: { marginTop: 24, alignItems: "flex-end" },
  signerLabel: { fontSize: 11, fontWeight: 700 },
  signerName: { fontSize: 11 },
});

export type RevistaSettings = {
  headerLines?: string[];
  unitLabel?: string;
  footerLines?: string[];
  assetBaseUrl?: string;
};

export type RevistaItem = { titlu: string; continut?: string; redactie?: string };

export function RevistaPresaPdf({
  settings,
  data,
}: {
  settings?: RevistaSettings;
  data: {
    numar: string;
    dateLabel: string;
    perioadaLabel: string;
    purtator?: string;
    items: RevistaItem[];
  };
}) {
  if (settings?.assetBaseUrl) {
    const base = settings.assetBaseUrl;
    try {
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Regular.ttf` });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Bold.ttf`, fontWeight: "bold" });
    } catch {}
  }

  const s = settings || {};
  const header = s.headerLines && s.headerLines.length ? s.headerLines : [
    "Inspectoratul pentru Situații de Urgență",
    "Compartiment Informare și Relații Publice",
  ];

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: "NotoSans" }]}>      
        <View style={styles.header}>
          {header.map((l, i) => (
            <Text key={i} style={styles.hSmall}>{l}</Text>
          ))}
          {s.unitLabel ? <Text style={styles.hSmall}>{s.unitLabel}</Text> : null}
          <Text style={styles.hTitle}>Revista presei – {data.perioadaLabel}</Text>
          <Text style={styles.meta}>Nr. {data.numar} / {data.dateLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>Cuprins</Text>
        {data.items.map((it, idx) => (
          <Text key={idx} style={styles.tocItem}>{idx + 1}. {it.titlu}</Text>
        ))}

        <Text style={styles.sectionTitle}>Materiale</Text>
        {data.items.map((it, idx) => (
          <View key={idx} style={styles.itemBox} wrap={false}>
            <Text style={styles.itemMeta}>{idx + 1}. {it.redactie ? `${it.redactie} – ` : ""}{it.titlu}</Text>
            {it.continut ? <Text style={styles.itemContent}>{it.continut}</Text> : null}
          </View>
        ))}

        {data.purtator ? (
          <View style={styles.signerBox}>
            <Text style={styles.signerLabel}>ÎNTOCMIT</Text>
            <Text style={styles.signerName}>{data.purtator}</Text>
          </View>
        ) : null}

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


