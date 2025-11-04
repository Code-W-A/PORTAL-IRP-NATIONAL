import { NextResponse } from "next/server";
import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24 },
  title: { fontSize: 18, marginBottom: 12 },
  paragraph: { fontSize: 12, lineHeight: 1.4 },
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title: string = body?.title || "Document";
  const content: string = body?.content || "";

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.paragraph}>{content}</Text>
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(Doc).toBlob();
  return new Response(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${title.replace(/\W+/g, "_")}.pdf"`,
    },
  });
}


