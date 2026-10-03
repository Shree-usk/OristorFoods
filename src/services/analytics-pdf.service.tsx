import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * STORY-059b. One shared PDF report template for all four analytics
 * reports (sales/customers/products-recipes/funnel), rather than four
 * bespoke documents — every report reduces to a title, a date range,
 * and a headers+rows table. Font registration mirrors
 * invoice-pdf.service.tsx's exact @react-pdf/renderer pattern.
 */

const FONT_DIR = path.join(process.cwd(), "node_modules");

Font.register({
  family: "Cormorant Garamond",
  fonts: [{ src: path.join(FONT_DIR, "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff"), fontWeight: 700 }],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-600-normal.woff"), fontWeight: 600 },
  ],
});

const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  chilliRed: "#B22222",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.ivory, padding: 40, fontFamily: "Inter", fontSize: 9, color: COLORS.charcoal },
  title: { fontFamily: "Cormorant Garamond", fontSize: 22, marginBottom: 2 },
  subtitle: { fontSize: 9, color: COLORS.stoneGrey, marginBottom: 16, paddingBottom: 12, borderBottom: `1pt solid ${COLORS.softBorder}` },
  tableHeaderRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.softBorder}`, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3 },
  cell: { flex: 1 },
  tableHeaderText: { fontSize: 8, fontWeight: 600, color: COLORS.stoneGrey },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

export interface AnalyticsReportTable {
  title: string;
  dateRange: string;
  headers: string[];
  rows: string[][];
}

function AnalyticsReportPdfDocument({ title, dateRange, headers, rows }: AnalyticsReportTable) {
  return (
    <Document title={`${title} — Oristor`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{dateRange}</Text>

        <View style={styles.tableHeaderRow}>
          {headers.map((header, index) => (
            <Text key={index} style={[styles.tableHeaderText, styles.cell]}>
              {header}
            </Text>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {row.map((value, cellIndex) => (
              <Text key={cellIndex} style={styles.cell}>
                {value}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com
        </Text>
      </Page>
    </Document>
  );
}

export function renderAnalyticsReportPdf(table: AnalyticsReportTable): Promise<Buffer> {
  return renderToBuffer(<AnalyticsReportPdfDocument {...table} />);
}
