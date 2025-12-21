import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "NotoSans" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  secrecy: { fontSize: 10, fontWeight: 700 },
  headerWrap: { marginTop: 10, alignItems: "center" },
  headerLine: { fontSize: 10, textAlign: "center", marginVertical: 1 },
  logo: { width: 90, height: 90, marginTop: 6, marginBottom: 6, objectFit: "contain" as any },
  title: { marginTop: 8, fontSize: 16, fontWeight: 700, textAlign: "center" },
  subtitle: { marginTop: 3, fontSize: 10, textAlign: "center" },

  sectionHeader: { marginTop: 14, backgroundColor: "#e5e7eb", paddingVertical: 4, paddingHorizontal: 8, border: "1px solid #9ca3af" },
  sectionHeaderText: { fontSize: 10, fontWeight: 700, textAlign: "center", color: "#374151" },

  table: { border: "1px solid #9ca3af" },
  row: { flexDirection: "row", borderTop: "1px solid #9ca3af" },
  cellLabel: { width: "30%", padding: 6, borderRight: "1px solid #9ca3af", fontWeight: 700 },
  cellValue: { width: "70%", padding: 6 },

  inlineChecks: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  checkItem: { flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 },
  checkbox: { width: 10, height: 10, border: "1px solid #111827", marginRight: 4, alignItems: "center", justifyContent: "center" },
  checkboxMark: { fontSize: 10, lineHeight: 1 },

  small: { fontSize: 9, color: "#374151" },
  footerArea: { marginTop: 10, borderTop: "1px solid #9ca3af", paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  signatureBox: { width: "52%", minHeight: 90, border: "1px solid #9ca3af", padding: 8 },
  signatureLabel: { fontSize: 10, fontWeight: 700, textAlign: "center" },
  signatureImage: { marginTop: 8, width: "100%", height: 55, objectFit: "contain" as any },
  dateBox: { width: "45%", minHeight: 90, border: "1px solid #9ca3af", padding: 8, justifyContent: "space-between" },
  dateLine: { borderBottom: "1px solid #9ca3af", height: 14 },
  note: { marginTop: 8, fontSize: 8, color: "#4b5563", textAlign: "center" },
});

export type CerereAcreditareFormPdfSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  secrecyLabel?: string;
  contactLine?: string; // optional single line
  assetBaseUrl?: string;
};

export type CerereAcreditareFormPdfData = {
  structuraLabel: string;
  media: {
    tip: Record<string, boolean>;
    tipAltceva?: string;
    denumire?: string;
    cui?: string;
    adresa?: string;
    email?: string;
    telefon?: { fix?: string; fax?: string; mobil?: string };
    website?: string;
  };
  jurnalist: {
    numePrenume?: string;
    dataNasterii?: string | null;
    locNastere?: string;
    cetatenie?: string;
    documentIdentitate?: { tip?: string; serieNumar?: string };
    adresa?: string;
    legitimatie?: { numar?: string; dataExpirare?: string | null };
    functie?: Record<string, any>;
    email?: string;
    telefon?: { fix?: string; fax?: string; mobil?: string };
  };
  signatureUrl?: string; // storage download url (admin-only)
};

function safe(v: any) {
  return String(v || "").trim();
}

function checkbox(checked: boolean) {
  return (
    <View style={styles.checkbox}>
      {checked ? <Text style={styles.checkboxMark}>×</Text> : <Text style={styles.checkboxMark}> </Text>}
    </View>
  );
}

export function CerereAcreditareFormPdfDoc({
  settings,
  data,
}: {
  settings?: CerereAcreditareFormPdfSettings;
  data: CerereAcreditareFormPdfData;
}) {
  const s = settings || {};

  if (s.assetBaseUrl) {
    const base = s.assetBaseUrl;
    try {
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Regular.ttf` });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Bold.ttf`, fontWeight: "bold" });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-Italic.ttf`, fontStyle: "italic" });
      Font.register({ family: "NotoSans", src: `${base}/fonts/NotoSans-BoldItalic.ttf`, fontStyle: "italic", fontWeight: "bold" });
    } catch {}
  }

  const headerLines = s.headerLines && s.headerLines.length ? s.headerLines : ["INSPECTORATUL PENTRU SITUAȚII DE URGENȚĂ"];
  const secrecy = s.secrecyLabel || "NESECRET";

  const media = data.media || ({} as any);
  const jurnalist = data.jurnalist || ({} as any);

  const mediaTip = media.tip || {};
  const functie = (jurnalist as any).functie || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.secrecy}>{secrecy}</Text>
          {s.contactLine ? <Text style={styles.small}>{s.contactLine}</Text> : <Text style={styles.small}> </Text>}
        </View>

        <View style={styles.headerWrap}>
          {headerLines.map((l, i) => (
            <Text key={i} style={styles.headerLine}>
              {l}
            </Text>
          ))}
          <Text style={[styles.headerLine, { fontWeight: 700 }]}>{data.structuraLabel}</Text>
          {s.logoUrlPublic ? <Image src={s.logoUrlPublic} style={styles.logo} /> : null}
        </View>

        <Text style={styles.title}>Formular de acreditare</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Date instituție media</Text>
        </View>
        <View style={styles.table}>
          <View style={[styles.row, { borderTop: "none" }]}>
            <Text style={styles.cellLabel}>Tip media:</Text>
            <View style={styles.cellValue}>
              <View style={styles.inlineChecks}>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.presaScrisa)}<Text>Presă scrisă</Text></View>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.tv)}<Text>TV</Text></View>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.radio)}<Text>Radio</Text></View>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.agentie)}<Text>Agenție de presă</Text></View>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.online)}<Text>Online</Text></View>
                <View style={styles.checkItem}>{checkbox(!!mediaTip.altceva)}<Text>Altceva: {safe(media.tipAltceva)}</Text></View>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Denumirea / CUI:</Text>
            <Text style={styles.cellValue}>{[safe(media.denumire), safe(media.cui)].filter(Boolean).join(" / ")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Adresa instituției:</Text>
            <Text style={styles.cellValue}>{safe(media.adresa)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>E-mail:</Text>
            <Text style={styles.cellValue}>{safe(media.email)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Telefon:</Text>
            <Text style={styles.cellValue}>
              Fix: {safe(media.telefon?.fix)}   Fax: {safe(media.telefon?.fax)}   Mobil: {safe(media.telefon?.mobil)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Website:</Text>
            <Text style={styles.cellValue}>{safe(media.website)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Date personale jurnalist</Text>
        </View>
        <View style={styles.table}>
          <View style={[styles.row, { borderTop: "none" }]}>
            <Text style={styles.cellLabel}>Nume și prenume:</Text>
            <Text style={styles.cellValue}>{safe(jurnalist.numePrenume)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Data și locul nașterii:</Text>
            <Text style={styles.cellValue}>{[safe(jurnalist.dataNasterii), safe(jurnalist.locNastere)].filter(Boolean).join(" / ")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Cetățenia:</Text>
            <Text style={styles.cellValue}>{safe(jurnalist.cetatenie)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Tip doc., serie și număr:</Text>
            <Text style={styles.cellValue}>
              {safe(jurnalist.documentIdentitate?.tip)} {safe(jurnalist.documentIdentitate?.serieNumar)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Adresa (opțional):</Text>
            <Text style={styles.cellValue}>{safe(jurnalist.adresa)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Nr. legitimație / expirare:</Text>
            <Text style={styles.cellValue}>
              {safe(jurnalist.legitimatie?.numar)} {jurnalist.legitimatie?.dataExpirare ? ` / ${safe(jurnalist.legitimatie?.dataExpirare)}` : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Funcția:</Text>
            <View style={styles.cellValue}>
              <View style={styles.inlineChecks}>
                <View style={styles.checkItem}>{checkbox(!!functie.redactor)}<Text>Redactor</Text></View>
                <View style={styles.checkItem}>{checkbox(!!functie.reporter)}<Text>Reporter</Text></View>
                <View style={styles.checkItem}>{checkbox(!!functie.fotoreporter)}<Text>Fotoreporter</Text></View>
                <View style={styles.checkItem}>{checkbox(!!functie.cameraman)}<Text>Cameraman</Text></View>
                <View style={styles.checkItem}>{checkbox(!!functie.tehnician)}<Text>Tehnician</Text></View>
                <View style={styles.checkItem}>{checkbox(!!functie.altceva)}<Text>Altceva: {safe(functie.altcevaText)}</Text></View>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>E-mail:</Text>
            <Text style={styles.cellValue}>{safe(jurnalist.email)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Nr. de telefon:</Text>
            <Text style={styles.cellValue}>
              Fix: {safe(jurnalist.telefon?.fix)}   Fax: {safe(jurnalist.telefon?.fax)}   Mobil: {safe(jurnalist.telefon?.mobil)}
            </Text>
          </View>
        </View>

        <View style={styles.footerArea}>
          <View style={styles.dateBox}>
            <Text style={{ fontSize: 10, fontWeight: 700 }}>Nr.</Text>
            <View style={styles.dateLine} />
            <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 10 }}>Data:</Text>
            <View style={styles.dateLine} />
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Semnătura și ștampila</Text>
            {data.signatureUrl ? <Image src={data.signatureUrl} style={styles.signatureImage} /> : null}
          </View>
        </View>

        <Text style={styles.note}>
          Nota: Datele solicitate sunt prelucrate cu respectarea prevederilor Regulamentului (UE) 2016/679.
        </Text>
      </Page>
    </Document>
  );
}


