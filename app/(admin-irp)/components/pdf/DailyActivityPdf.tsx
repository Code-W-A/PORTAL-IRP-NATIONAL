import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  BicpPdfFooter,
  BicpPdfHeader,
  registerNoto,
  styles as bicpStyles,
  type BicpPdfSettings,
} from "@/app/(admin-irp)/components/pdf/BicpPdf";

const styles = StyleSheet.create({
  pageFont: { fontFamily: "NotoSerif" },
  type: {
    marginTop: 28,
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
  },
  title: { fontSize: 14, fontWeight: 600, marginTop: 4, textAlign: "center" },
  tableWrap: { marginTop: 14, borderWidth: 1, borderColor: "#d1d5db" },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d1d5db" },
  cellHead: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 10.5,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  cellBody: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  cellInterval: { width: "17%" },
  cellActivitate: { width: "33%" },
  cellExecutant: { width: "24%" },
  cellObservatii: { width: "26%", borderRightWidth: 0 },
  emptyCell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    fontSize: 10,
    textAlign: "center",
    color: "#6b7280",
  },
  intocmitBlock: { marginTop: 24, width: "46%", alignItems: "center" },
  intocmitTitle: { fontSize: 10.5, fontWeight: 700, textAlign: "center" },
  intocmitName: {
    marginTop: 30,
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#4b5563",
    paddingTop: 6,
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
  },
});

export type DailyActivityPdfSettings = Pick<
  BicpPdfSettings,
  | "headerLines"
  | "logoUrlPublic"
  | "secrecyLabel"
  | "city"
  | "footerLines"
  | "unitLabel"
  | "assetBaseUrl"
  | "showHeaderTricolor"
  | "showTricolorFooter"
>;

export type DailyActivityPdfData = {
  reportDate: string;
  title: string;
  registrationNumber?: string;
  activities: Array<{
    intervalOrar?: string;
    activitate?: string;
    executant?: string;
    observatii?: string;
  }>;
  intocmit: {
    nume?: string;
  };
  aprobat: {
    functia?: string;
    grad?: string;
    nume?: string;
  };
};

function formatDateRo(value: string) {
  const safe = String(value || "").trim();
  const m = safe.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return safe;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function linesOf(value?: string) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DailyActivityPdfDoc({
  settings,
  data,
}: {
  settings?: DailyActivityPdfSettings;
  data: DailyActivityPdfData;
}) {
  registerNoto(settings?.assetBaseUrl);

  const s = settings || {};
  const safeSettings: BicpPdfSettings = {
    ...s,
    // Cerință: fără telefon/email în PDF-ul de activitate.
    phone: undefined,
    email: undefined,
  };

  const activities = Array.isArray(data.activities) ? data.activities : [];
  const cleanedActivities = activities.filter((item) =>
    [item.intervalOrar, item.activitate, item.executant, item.observatii]
      .map((value) => String(value || "").trim())
      .some(Boolean)
  );

  return (
    <Document>
      <Page size="A4" style={[bicpStyles.page, styles.pageFont]}>
        <BicpPdfHeader
          settings={safeSettings}
          data={{
            numar: String(data.registrationNumber || "____").trim() || "____",
            dateLabel: formatDateRo(data.reportDate),
          }}
          variant="signed"
        />

        <View style={bicpStyles.approveRow}>
          <View style={bicpStyles.approveBox}>
            <Text style={bicpStyles.approveTitle}>APROB</Text>
            {linesOf(data.aprobat?.functia).length ? (
              linesOf(data.aprobat?.functia).map((line, index) => (
                <Text key={`${line}:${index}`} style={bicpStyles.approveLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={bicpStyles.approveLine}> </Text>
            )}
            {!!data.aprobat?.grad && (
              <Text style={bicpStyles.approveLine}>{String(data.aprobat.grad)}</Text>
            )}
            <Text style={bicpStyles.approveLine}>
              {String(data.aprobat?.nume || " ")}
            </Text>
          </View>
        </View>

        <Text style={styles.type}>RAPORT</Text>
        <Text style={styles.title}>ACTIVITATE ZILNICĂ</Text>
        <Text style={styles.title}>
          {String(data.title || "Raport activitate zilnică").trim()}
        </Text>

        <View style={styles.tableWrap}>
          <View style={styles.tableHead}>
            <Text style={[styles.cellHead, styles.cellInterval]}>Interval orar</Text>
            <Text style={[styles.cellHead, styles.cellActivitate]}>Activitate</Text>
            <Text style={[styles.cellHead, styles.cellExecutant]}>Executant</Text>
            <Text style={[styles.cellHead, styles.cellObservatii]}>Observații</Text>
          </View>

          {cleanedActivities.length === 0 ? (
            <Text style={styles.emptyCell}>Nu există activități completate.</Text>
          ) : (
            cleanedActivities.map((item, index) => (
              <View key={`act:${index}`} style={styles.tableRow}>
                <Text style={[styles.cellBody, styles.cellInterval]}>
                  {String(item.intervalOrar || "-")}
                </Text>
                <Text style={[styles.cellBody, styles.cellActivitate]}>
                  {String(item.activitate || "-")}
                </Text>
                <Text style={[styles.cellBody, styles.cellExecutant]}>
                  {String(item.executant || "-")}
                </Text>
                <Text style={[styles.cellBody, styles.cellObservatii]}>
                  {String(item.observatii || "-")}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ flexGrow: 1 }} />
        <View style={styles.intocmitBlock}>
          <Text style={styles.intocmitTitle}>ÎNTOCMIT</Text>
          <Text style={styles.intocmitName}>
            {String(data.intocmit?.nume || "-")}
          </Text>
        </View>

        <BicpPdfFooter settings={safeSettings} />
      </Page>
    </Document>
  );
}
