import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { BicpPdfFooter, BicpPdfHeader, getBicpFooterMeta, registerNoto } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { getSignaturesFromSettings } from "@/app/(admin-irp)/dashboard/raportari/_core/settings";
import { formatDateRo } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import { getOrderedColumns, widthWeight } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import type { ReportRowDoc, ReportTypeColumn } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import type { StructuraSettings } from "@/lib/settings/getSettings";

export type DynamicReportPdfData = {
  title: string;
  registrationNumber: string;
  periodStart: string;
  periodEnd: string;
  columns: ReportTypeColumn[];
  rows: ReportRowDoc[];
  includeSignatures: boolean;
};

const styles = StyleSheet.create({
  page: { padding: 72, paddingTop: 210, paddingBottom: 110 },
  title: { fontSize: 15, fontWeight: 700, marginTop: 18, textAlign: "center" },
  meta: { marginTop: 8, fontSize: 10, textAlign: "center" },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#111827" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111827", backgroundColor: "#e2e8f0" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111827" },
  cellBase: {
    fontSize: 8.5,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderColor: "#111827",
    textAlign: "left",
  },
  headerCell: { fontWeight: 700, textAlign: "center" },
  nrCell: { textAlign: "center" },
  signArea: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  signCol: { width: "48%", alignItems: "center" },
  signLabel: { fontSize: 10, fontWeight: 700 },
  signLine: { fontSize: 9, marginTop: 3, textAlign: "center" },
});

function widthPercentages(columns: ReportTypeColumn[]) {
  const ordered = getOrderedColumns(columns);
  const nrWeight = 1;
  const columnWeights = ordered.map((column) => widthWeight(column.width));
  const totalWeight = nrWeight + columnWeights.reduce((sum, value) => sum + value, 0);

  return {
    nr: `${(nrWeight / totalWeight) * 100}%`,
    columns: columnWeights.map((weight) => `${(weight / totalWeight) * 100}%`),
  };
}

export function DynamicReportPdfDoc({
  settings,
  data,
}: {
  settings?: StructuraSettings | null;
  data: DynamicReportPdfData;
}) {
  registerNoto(settings?.assetBaseUrl);
  const { tricolorBottom } = getBicpFooterMeta(settings || undefined);
  const paddingBottom = Math.max(110, tricolorBottom + 26);
  const { aprobat, intocmit } = getSignaturesFromSettings(settings);
  const orderedColumns = getOrderedColumns(data.columns);
  const widths = widthPercentages(orderedColumns);

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: "NotoSerif", paddingBottom }]}> 
        <BicpPdfHeader
          settings={settings || undefined}
          data={{
            numar: data.registrationNumber || "____",
            dateLabel: formatDateRo(data.periodEnd),
          }}
          variant="signed"
        />

        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.meta}>Nr. înregistrare: {data.registrationNumber || "—"}</Text>
        <Text style={styles.meta}>
          Perioada: {formatDateRo(data.periodStart)} - {formatDateRo(data.periodEnd)}
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.cellBase, styles.headerCell, styles.nrCell, { width: widths.nr }]}>Nr. crt.</Text>
            {orderedColumns.map((column, index) => (
              <Text
                key={`header:${column.id}`}
                style={[
                  styles.cellBase,
                  styles.headerCell,
                  { width: widths.columns[index], borderRightWidth: index === orderedColumns.length - 1 ? 0 : 1 },
                ]}
              >
                {column.label}
              </Text>
            ))}
          </View>

          {data.rows.map((row, rowIndex) => (
            <View key={row.id || rowIndex} style={styles.row} wrap={false}>
              <Text style={[styles.cellBase, styles.nrCell, { width: widths.nr }]}>{rowIndex + 1}</Text>
              {orderedColumns.map((column, index) => (
                <Text
                  key={`${row.id}:${column.id}`}
                  style={[
                    styles.cellBase,
                    {
                      width: widths.columns[index],
                      borderRightWidth: index === orderedColumns.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  {String(row.cells[column.id] || "") || "—"}
                </Text>
              ))}
            </View>
          ))}

          {data.rows.length === 0 && (
            <View style={styles.row}>
              <Text style={[styles.cellBase, { width: "100%", borderRightWidth: 0, textAlign: "center" }]}> 
                Nu există rânduri în raport.
              </Text>
            </View>
          )}
        </View>

        {data.includeSignatures && (
          <View style={styles.signArea}>
            <View style={styles.signCol}>
              <Text style={styles.signLabel}>ÎNTOCMIT,</Text>
              <Text style={styles.signLine}>{intocmit?.nume || ""}</Text>
              <Text style={styles.signLine}>Semnătură: ____________</Text>
            </View>
            <View style={styles.signCol}>
              <Text style={styles.signLabel}>APROBAT,</Text>
              <Text style={styles.signLine}>{aprobat?.functia || ""}</Text>
              <Text style={styles.signLine}>{[aprobat?.grad, aprobat?.nume].filter(Boolean).join(" ")}</Text>
              <Text style={styles.signLine}>Semnătură: ____________</Text>
            </View>
          </View>
        )}

        <BicpPdfFooter settings={settings || undefined} />
      </Page>
    </Document>
  );
}
