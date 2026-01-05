import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36 },
  header: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 700, textAlign: "center" },
  subtitle: { fontSize: 10, textAlign: "center", marginTop: 4, color: "#475569" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  meta: { fontSize: 9, color: "#334155" },
  section: { marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10 },
  sectionHeader: { padding: 8, backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" },
  sectionHeaderText: { fontSize: 10, fontWeight: 700, color: "#0f172a" },
  sectionBody: { padding: 10 },
  row: { flexDirection: "row", gap: 10, marginBottom: 6 },
  col: { flex: 1 },
  label: { fontSize: 8, color: "#64748b" },
  value: { fontSize: 10, color: "#0f172a", marginTop: 2 },
  kv: { marginBottom: 6 },
  foot: { marginTop: 14, fontSize: 8, color: "#64748b", textAlign: "center" },
});

export type CererePdfSettings = {
  assetBaseUrl?: string;
  structuraLabel?: string;
};

export type CererePdfData = {
  id: string;
  submittedAt?: string;
  structuriLabel?: string;
  media: any;
  jurnalist: any;
  consimtamant?: any;
};

function registerNoto(assetBaseUrl?: string) {
  try {
    const base = assetBaseUrl || "";
    const makeUrl = (p: string) => (base ? new URL(p, base).toString() : p);
    Font.register({ family: "NotoSans", src: makeUrl("/fonts/NotoSans-Regular.ttf") });
    Font.register({ family: "NotoSans", src: makeUrl("/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" });
    Font.register({ family: "NotoSans", src: makeUrl("/fonts/NotoSans-Italic.ttf"), fontStyle: "italic" });
    Font.register({ family: "NotoSans", src: makeUrl("/fonts/NotoSans-BoldItalic.ttf"), fontStyle: "italic", fontWeight: "bold" });
  } catch {}
}

function val(v: any) {
  const s = String(v ?? "").trim();
  return s || "—";
}

export function CerereAcreditarePdfDoc({ settings, data }: { settings?: CererePdfSettings; data: CererePdfData }) {
  registerNoto(settings?.assetBaseUrl);
  const m = data.media || {};
  const j = data.jurnalist || {};
  const telM = m.telefon || {};
  const telJ = j.telefon || {};
  const docId = j.documentIdentitate || {};
  const legit = j.legitimatie || {};

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: "NotoSans" }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Cerere acreditare</Text>
          <Text style={styles.subtitle}>Formular completat electronic</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>ID cerere: {data.id}</Text>
            <Text style={styles.meta}>Depusă: {val(data.submittedAt)}</Text>
          </View>
          <Text style={[styles.subtitle, { marginTop: 6 }]}>
            Structură: {val(settings?.structuraLabel || data.structuriLabel)}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Date instituție media</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Denumire</Text>
                  <Text style={styles.value}>{val(m.denumire)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>CUI</Text>
                  <Text style={styles.value}>{val(m.cui)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Adresă</Text>
                  <Text style={styles.value}>{val(m.adresa)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>E-mail</Text>
                  <Text style={styles.value}>{val(m.email)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Telefon fix / fax</Text>
                  <Text style={styles.value}>{val(telM.fix)} / {val(telM.fax)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Telefon mobil / website</Text>
                  <Text style={styles.value}>{val(telM.mobil)} / {val(m.website)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Date personale jurnalist</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Nume și prenume</Text>
                  <Text style={styles.value}>{val(j.numePrenume)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Cetățenie</Text>
                  <Text style={styles.value}>{val(j.cetatenie)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Data / locul nașterii</Text>
                  <Text style={styles.value}>{val(j.dataNasterii)} / {val(j.locNastere)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Adresă</Text>
                  <Text style={styles.value}>{val(j.adresa)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Document identitate</Text>
                  <Text style={styles.value}>{val(docId.tip)} {val(docId.serieNumar)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Legitimație de presă</Text>
                  <Text style={styles.value}>{val(legit.numar)} (exp: {val(legit.dataExpirare)})</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>E-mail</Text>
                  <Text style={styles.value}>{val(j.email)}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.label}>Telefon (fix/fax/mobil)</Text>
                  <Text style={styles.value}>{val(telJ.fix)} / {val(telJ.fax)} / {val(telJ.mobil)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.foot}>
          Document generat automat. Nu este stocat în Firebase Storage.
        </Text>
      </Page>
    </Document>
  );
}


