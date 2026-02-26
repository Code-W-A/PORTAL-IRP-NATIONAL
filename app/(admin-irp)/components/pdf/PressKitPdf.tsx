import React from "react";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  DEFAULT_PRESS_KIT_INVITATION_NOTE,
  buildDefaultConferenceMaterialTitle,
  type PressKitPayload,
} from "@/app/(admin-irp)/mape-presa/_core/types";

const CM_TO_PT = 28.3464567;
const ACCENT = "#002060";

const PAGE_MARGIN = {
  top: 0.82 * CM_TO_PT,
  right: 1.5 * CM_TO_PT,
  bottom: 0.64 * CM_TO_PT,
  left: 2.0 * CM_TO_PT,
};

const HEADER_RESERVED_MIN = 110;
const FOOTER_RESERVED_MIN = 54;
const JOURNALISTS_FIRST_PAGE_ROWS = 18;
const JOURNALISTS_NEXT_PAGE_ROWS = 30;
const COVER_CONTACT_STATIC = {
  name: "Locotenent Popesc Radu",
  role: "Purtător de cuvânt",
  phone: "0722.743.485",
  email: "irp@isudb.igsu.ro",
};

function resolveAssetUrl(pathOrUrl: string | undefined, base?: string) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!base) return value;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

export type PressKitPdfSettings = {
  headerLines?: string[];
  footerLines?: string[];
  logoUrlPublic?: string;
  assetBaseUrl?: string;
  showHeaderTricolor?: boolean;
  showTricolorFooter?: boolean;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN.top + HEADER_RESERVED_MIN,
    paddingRight: PAGE_MARGIN.right,
    paddingBottom: PAGE_MARGIN.bottom + FOOTER_RESERVED_MIN,
    paddingLeft: PAGE_MARGIN.left,
    fontFamily: "NotoSans",
    fontSize: 11,
    color: "#000000",
  },
  headerWrap: {
    position: "absolute",
    top: PAGE_MARGIN.top,
    left: PAGE_MARGIN.left,
    right: PAGE_MARGIN.right,
  },
  headerLine: {
    fontFamily: "NotoSerif",
    fontSize: 9,
    textAlign: "center",
    lineHeight: 1.25,
    marginBottom: 1,
  },
  headerLogo: {
    width: 46,
    height: 46,
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 5,
    objectFit: "contain",
  },
  tricolorRow: {
    flexDirection: "row",
    height: 6,
    width: "100%",
  },
  triBlue: { flex: 1, backgroundColor: "#002B7F" },
  triYellow: { flex: 1, backgroundColor: "#FCD116" },
  triRed: { flex: 1, backgroundColor: "#CE1126" },
  footerWrap: {
    position: "absolute",
    left: PAGE_MARGIN.left,
    right: PAGE_MARGIN.right,
    bottom: PAGE_MARGIN.bottom,
  },
  footerLine: {
    textAlign: "center",
    fontSize: 8.5,
    fontFamily: "NotoSerif",
    marginTop: 2,
  },
  accentLine: {
    borderTopWidth: 2,
    borderTopColor: ACCENT,
    marginTop: 8,
    marginBottom: 10,
  },
  accentHeading: {
    color: ACCENT,
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  conferenceTitle: {
    textAlign: "right",
    color: ACCENT,
    fontFamily: "NotoSerif",
    fontSize: 18,
    fontWeight: 700,
    marginTop: 8,
  },
  coverCenterWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitleCentered: {
    color: ACCENT,
    fontFamily: "NotoSerif",
    fontSize: 52,
    fontWeight: 700,
    textAlign: "center",
  },
  coverContactWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  coverContactTitle: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    marginTop: 0,
  },
  coverContactLine: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    marginTop: 2,
  },
  h1: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontSize: 22,
    color: ACCENT,
  },
  h2: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontSize: 13,
  },
  sumItem: {
    color: ACCENT,
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontStyle: "italic",
    fontSize: 12,
  },
  underlineBoldItalic: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontStyle: "italic",
    textDecoration: "underline",
    marginTop: 12,
  },
  hostLine: {
    color: ACCENT,
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontStyle: "italic",
    marginTop: 3,
    marginLeft: 12,
  },
  rightText: {
    textAlign: "right",
    marginTop: 4,
    fontSize: 9.5,
  },
  rightTextBold: {
    textAlign: "right",
    marginTop: 2,
    fontSize: 9.5,
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  materialTitle: {
    marginTop: 8,
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.25,
  },
  materialContent: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 1.35,
    textAlign: "justify",
  },
  basicText: {
    marginTop: 4,
    lineHeight: 1.25,
  },
  basicTextBold: {
    marginTop: 4,
    lineHeight: 1.25,
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  inlineBold: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  spokespersonMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  spokespersonMetaEmail: {
    width: "64%",
    fontSize: 10,
    lineHeight: 1.2,
  },
  spokespersonMetaPhone: {
    width: "36%",
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: "right",
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#000",
  },
  tableRowFirst: {
    flexDirection: "row",
  },
  tableCellLabel: {
    width: "36%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingHorizontal: 7,
    paddingVertical: 7,
    textAlign: "center",
    fontFamily: "NotoSerif",
  },
  tableCellValue: {
    width: "64%",
    paddingHorizontal: 7,
    paddingVertical: 7,
    textAlign: "center",
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  linkText: {
    color: ACCENT,
    textDecoration: "underline",
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  centeredParagraph: {
    textAlign: "center",
    fontFamily: "NotoSerif",
    fontWeight: 700,
    marginTop: 8,
    lineHeight: 1.3,
  },
  centeredItalic: {
    fontStyle: "italic",
  },
  note: {
    marginTop: 10,
    textDecoration: "underline",
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontStyle: "italic",
    lineHeight: 1.25,
  },
  journalistsTable: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 10,
  },
  journalistsHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#f4f7ff",
  },
  journalistsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#000",
  },
  cellNr: {
    width: "12%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingHorizontal: 5,
    paddingVertical: 6,
    textAlign: "center",
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontSize: 10,
  },
  cellName: {
    width: "60%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 10,
    lineHeight: 1.25,
  },
  cellTrust: {
    width: "28%",
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 1.25,
  },
  intocmitBlock: {
    marginTop: 18,
    width: "44%",
    alignSelf: "flex-end",
    alignItems: "center",
  },
  intocmitTitle: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  intocmitName: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#000",
    width: "100%",
    textAlign: "center",
    paddingTop: 6,
    fontFamily: "NotoSerif",
    fontWeight: 700,
  },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  boldItalic: {
    fontFamily: "NotoSerif",
    fontWeight: 700,
    fontStyle: "italic",
  },
});

function registerPressKitFonts(assetBaseUrl?: string) {
  const serfReg = resolveAssetUrl("/fonts/NotoSerif-Regular.ttf", assetBaseUrl);
  const serfBold = resolveAssetUrl("/fonts/NotoSerif-Bold.ttf", assetBaseUrl);
  const serfItalic = resolveAssetUrl("/fonts/NotoSerif-Italic.ttf", assetBaseUrl);
  const serfBoldItalic = resolveAssetUrl("/fonts/NotoSerif-BoldItalic.ttf", assetBaseUrl);
  const sansReg = resolveAssetUrl("/fonts/NotoSans-Regular.ttf", assetBaseUrl);
  const sansBold = resolveAssetUrl("/fonts/NotoSans-Bold.ttf", assetBaseUrl);
  try {
    Font.register({ family: "NotoSerif", src: serfReg });
    Font.register({ family: "NotoSerif", src: serfBold, fontWeight: "bold" });
    Font.register({ family: "NotoSerif", src: serfItalic, fontStyle: "italic" });
    Font.register({
      family: "NotoSerif",
      src: serfBoldItalic,
      fontStyle: "italic",
      fontWeight: "bold",
    });
    Font.register({ family: "NotoSans", src: sansReg });
    Font.register({ family: "NotoSans", src: sansBold, fontWeight: "bold" });
  } catch {}
}

function cleanHosts(hosts: string[]) {
  return hosts.map((host) => String(host || "").trim()).filter(Boolean);
}

function cleanJournalists(rows: PressKitPayload["journalists"]) {
  return rows
    .map((row) => ({
      fullNameAndRole: String(row?.fullNameAndRole || "").trim(),
      trust: String(row?.trust || "").trim(),
    }))
    .filter((row) => row.fullNameAndRole || row.trust);
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function estimateWrappedRows(text: string) {
  const value = String(text || "").trim();
  if (!value) return 0;
  // Approximation for centered lines at 9pt on LETTER width.
  return Math.max(1, Math.ceil(value.length / 84));
}

function computeHeaderReserved(settings: PressKitPdfSettings) {
  const lineRows = (settings.headerLines || []).reduce(
    (sum, line) => sum + estimateWrappedRows(line),
    0
  );
  const linesHeight = lineRows * 12;
  const hasLogo = !!resolveAssetUrl(settings.logoUrlPublic, settings.assetBaseUrl);
  const logoHeight = hasLogo ? 56 : 0;
  const tricolorHeight = settings.showHeaderTricolor === false ? 0 : 8;
  return Math.max(HEADER_RESERVED_MIN, Math.ceil(linesHeight + logoHeight + tricolorHeight + 14));
}

function computeFooterReserved(settings: PressKitPdfSettings) {
  const lineRows = (settings.footerLines || []).reduce(
    (sum, line) => sum + estimateWrappedRows(line),
    0
  );
  const linesHeight = lineRows * 10;
  const tricolorHeight = settings.showTricolorFooter === false ? 0 : 8;
  return Math.max(FOOTER_RESERVED_MIN, Math.ceil(linesHeight + tricolorHeight + 8));
}

function Header({ settings }: { settings: PressKitPdfSettings }) {
  const lines = settings.headerLines?.length ? settings.headerLines : [];
  const logo = resolveAssetUrl(settings.logoUrlPublic, settings.assetBaseUrl);

  return (
    <View style={styles.headerWrap} fixed>
      {lines.map((line, index) => (
        <Text key={`header:${index}`} style={styles.headerLine}>
          {line}
        </Text>
      ))}
      {!!logo && <Image src={logo} style={styles.headerLogo} />}
      {settings.showHeaderTricolor !== false && (
        <View style={styles.tricolorRow}>
          <View style={styles.triBlue} />
          <View style={styles.triYellow} />
          <View style={styles.triRed} />
        </View>
      )}
    </View>
  );
}

function Footer({ settings }: { settings: PressKitPdfSettings }) {
  const footerLines = Array.isArray(settings.footerLines) ? settings.footerLines : [];
  return (
    <View style={styles.footerWrap} fixed>
      {settings.showTricolorFooter !== false && (
        <View style={styles.tricolorRow}>
          <View style={styles.triBlue} />
          <View style={styles.triYellow} />
          <View style={styles.triRed} />
        </View>
      )}
      {footerLines.map((line, index) => (
        <Text key={`footer:${index}`} style={styles.footerLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function JournalistsTable({
  rows,
  startIndex,
}: {
  rows: PressKitPayload["journalists"];
  startIndex: number;
}) {
  return (
    <View style={styles.journalistsTable}>
      <View style={styles.journalistsHeaderRow}>
        <Text style={styles.cellNr}>Nr.crt.</Text>
        <Text style={styles.cellName}>Nume, prenume, funcția</Text>
        <Text style={styles.cellTrust}>Trustul de presă</Text>
      </View>
      {rows.map((row, index) => (
        <View key={`journalist:${startIndex + index}`} style={styles.journalistsRow}>
          <Text style={styles.cellNr}>{startIndex + index + 1}.</Text>
          <Text style={styles.cellName}>{row.fullNameAndRole || "-"}</Text>
          <Text style={styles.cellTrust}>{row.trust || "-"}</Text>
        </View>
      ))}
    </View>
  );
}

export function PressKitPdf({
  settings,
  data,
}: {
  settings?: PressKitPdfSettings;
  data: PressKitPayload;
}) {
  const mergedSettings: PressKitPdfSettings = settings || {};
  registerPressKitFonts(mergedSettings.assetBaseUrl);

  const hosts = cleanHosts(data.hosts);
  const journalists = cleanJournalists(data.journalists);
  const safeJournalists = journalists.length
    ? journalists
    : [{ fullNameAndRole: "", trust: "" }];

  const firstRows = safeJournalists.slice(0, JOURNALISTS_FIRST_PAGE_ROWS);
  const overflowRows = safeJournalists.slice(JOURNALISTS_FIRST_PAGE_ROWS);
  const overflowChunks = chunkArray(overflowRows, JOURNALISTS_NEXT_PAGE_ROWS);
  const speakersText = hosts.length ? hosts.join(", ") : "-";
  const invitationNote = String(data.invitationNote || "").trim() || DEFAULT_PRESS_KIT_INVITATION_NOTE;
  const conferenceMaterialTitle =
    String(data.conferenceMaterial?.title || "").trim() ||
    buildDefaultConferenceMaterialTitle(data.conference.year);
  const conferenceMaterialContent = String(data.conferenceMaterial?.content || "").trim();
  const headerReserved = computeHeaderReserved(mergedSettings);
  const footerReserved = computeFooterReserved(mergedSettings);
  const pageStyle = {
    paddingTop: PAGE_MARGIN.top + headerReserved,
    paddingBottom: PAGE_MARGIN.bottom + footerReserved,
  };

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, pageStyle]}>
        <Header settings={mergedSettings} />
        <Footer settings={mergedSettings} />

        <Text style={styles.conferenceTitle}>
          CONFERINȚĂ DE PRESĂ {data.conference.date}, ora {data.conference.time}
        </Text>
        <View style={styles.accentLine} />

        <View style={styles.coverCenterWrap}>
          <Text style={styles.coverTitleCentered}>MAPĂ DE PRESĂ</Text>
        </View>

        <View style={styles.coverContactWrap}>
          <Text style={styles.coverContactTitle}>Contact:</Text>
          <Text style={styles.coverContactLine}>{COVER_CONTACT_STATIC.name}</Text>
          <Text style={styles.coverContactLine}>{COVER_CONTACT_STATIC.role}</Text>
          <Text style={styles.coverContactLine}>{COVER_CONTACT_STATIC.phone}</Text>
          <Text style={styles.coverContactLine}>{COVER_CONTACT_STATIC.email}</Text>
        </View>
        <View style={styles.accentLine} />
      </Page>

      <Page size="LETTER" style={[styles.page, pageStyle]}>
        <Header settings={mergedSettings} />
        <Footer settings={mergedSettings} />

        <Text style={styles.h1}>Sumar</Text>
        <View style={styles.accentLine} />

        <Text style={styles.sumItem}>{conferenceMaterialTitle}</Text>
        <View style={styles.accentLine} />
        <Text style={styles.sumItem}>2. Coordonatele de contact ale instituției;</Text>
        <View style={styles.accentLine} />

        <Text style={styles.underlineBoldItalic}>Conduce:</Text>
        {hosts.length ? (
          hosts.map((host, index) => (
            <Text key={`host:${index}`} style={styles.hostLine}>
              - {host};
            </Text>
          ))
        ) : (
          <Text style={styles.hostLine}>-</Text>
        )}

        <Text style={styles.underlineBoldItalic}>
          NOTĂ: Activitatea se desfășoară la sediul inspectoratului
        </Text>

        <Text style={[styles.boldItalic, styles.mt18]}>{conferenceMaterialTitle}</Text>
        <View style={styles.accentLine} />
        {!!conferenceMaterialContent && (
          <Text style={styles.materialContent}>{conferenceMaterialContent}</Text>
        )}

        <View style={{ flexGrow: 1 }} />
        <Text style={styles.rightTextBold}>Informare, Relații Publice și cu Publicul</Text>
      </Page>

      <Page size="LETTER" style={[styles.page, pageStyle]}>
        <Header settings={mergedSettings} />
        <Footer settings={mergedSettings} />

        <Text style={styles.boldItalic}>2. Coordonatele de contact ale instituției</Text>
        <View style={styles.accentLine} />

        <View style={styles.table}>
          <View style={styles.tableRowFirst}>
            <Text style={styles.tableCellLabel}>Adresa:</Text>
            <Text style={styles.tableCellValue}>{data.institutionContact.address}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Telefon/ fax:</Text>
            <Text style={styles.tableCellValue}>{data.institutionContact.phoneFax}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>E-mail:</Text>
            <View style={[styles.tableCellValue, { alignItems: "center" }]}>
              {!!data.institutionContact.email ? (
                <Link style={styles.linkText} src={`mailto:${data.institutionContact.email}`}>
                  {data.institutionContact.email}
                </Link>
              ) : (
                <Text>-</Text>
              )}
            </View>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Pagina web:</Text>
            <View style={[styles.tableCellValue, { alignItems: "center" }]}>
              {!!data.institutionContact.website ? (
                <Link style={styles.linkText} src={data.institutionContact.website}>
                  {data.institutionContact.website}
                </Link>
              ) : (
                <Text>-</Text>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.h2, styles.mt12]}>
          Conducerea Inspectoratului pentru Situații de Urgență Județean Dâmbovița
        </Text>
        <View style={styles.accentLine} />

        <Text style={styles.basicText}>
          Inspector șef – <Text style={styles.basicTextBold}>{data.leadership.inspectorSef}</Text>
        </Text>
        <Text style={styles.basicText}>
          Prim adjunct al inspectorului șef –{" "}
          <Text style={styles.basicTextBold}>{data.leadership.primAdjunct}</Text>
        </Text>
        <Text style={styles.basicText}>
          Adjunct al inspectorului șef –{" "}
          <Text style={styles.basicTextBold}>{data.leadership.adjunct}</Text>
        </Text>

        <Text style={styles.underlineBoldItalic}>Program de audiență</Text>
        <View style={styles.accentLine} />
        <Text style={styles.basicText}>Inspector șef – luni 10.00 – 12.00</Text>
        <Text style={styles.basicText}>Prim adjunct al inspectorului șef – marți 10.00 – 12.00</Text>
        <Text style={styles.basicText}>Adjunct al inspectorului șef – miercuri 10.00 – 12.00</Text>

        <Text style={[styles.h2, styles.mt12]}>
          Responsabil cu difuzarea informațiilor de interes public
        </Text>
        <Text style={styles.h2}>și purtător de cuvânt</Text>
        <View style={styles.accentLine} />
        <Text style={styles.basicTextBold}>{data.spokesperson.name}</Text>
        <View style={styles.spokespersonMetaRow}>
          <Text style={styles.spokespersonMetaEmail}>
            E-mail:{" "}
            {!!data.spokesperson.email ? (
              <Link style={styles.linkText} src={`mailto:${data.spokesperson.email}`}>
                {data.spokesperson.email}
              </Link>
            ) : (
              "-"
            )}
          </Text>
          <Text style={styles.spokespersonMetaPhone}>
            Telefon mobil: <Text style={styles.inlineBold}>{data.spokesperson.phone}</Text>
          </Text>
        </View>
      </Page>

      <Page size="LETTER" style={[styles.page, pageStyle]}>
        <Header settings={mergedSettings} />
        <Footer settings={mergedSettings} />

        <Text style={styles.h2}>TABEL ZIARIȘTI PARTICIPANȚI</Text>
        <Text style={[styles.boldItalic, styles.mt8]}>
          la declarația comună de presă – {data.conference.date} (ora {data.conference.time})
        </Text>
        <View style={styles.accentLine} />

        <Text style={styles.centeredParagraph}>
          DIN CADRUL ISU DÂMBOVIȚA A FOST SUSȚINUTĂ DE:{" "}
          <Text style={styles.centeredItalic}>{speakersText}</Text>
        </Text>

        <Text style={styles.note}>NOTĂ: {invitationNote}</Text>

        <JournalistsTable rows={firstRows} startIndex={0} />

        {overflowChunks.length === 0 && (
          <View style={styles.intocmitBlock}>
            <Text style={styles.intocmitTitle}>ÎNTOCMIT</Text>
            <Text style={styles.intocmitName}>{data.intocmit.name || "-"}</Text>
          </View>
        )}
      </Page>

      {overflowChunks.map((chunk, index) => {
        const startIndex = JOURNALISTS_FIRST_PAGE_ROWS + index * JOURNALISTS_NEXT_PAGE_ROWS;
        const isLast = index === overflowChunks.length - 1;
        return (
          <Page key={`overflow:${index}`} size="LETTER" style={[styles.page, pageStyle]}>
            <Header settings={mergedSettings} />
            <Footer settings={mergedSettings} />

            <Text style={styles.h2}>TABEL ZIARIȘTI PARTICIPANȚI (continuare)</Text>
            <View style={styles.accentLine} />
            <JournalistsTable rows={chunk} startIndex={startIndex} />

            {isLast && (
              <View style={styles.intocmitBlock}>
                <Text style={styles.intocmitTitle}>ÎNTOCMIT</Text>
                <Text style={styles.intocmitName}>{data.intocmit.name || "-"}</Text>
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
}
