import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { OrderAdminDetail } from "@/services/order-admin.service";

// See invoice-pdf.service.tsx's doc comment: @react-pdf/renderer needs real
// font files (fontkit), not next/font/google's CSS mechanism. Font.register
// is idempotent per family+weight, safe to repeat across module loads.
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
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Same palette as invoice-pdf.service.tsx (docs/blueprint.md Section 2).
const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  chilliRed: "#B22222",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.ivory, padding: 40, fontFamily: "Inter", fontSize: 10, color: COLORS.charcoal },
  title: { fontFamily: "Cormorant Garamond", fontSize: 24, marginBottom: 2 },
  subtitle: { fontSize: 10, color: COLORS.stoneGrey, marginBottom: 16 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: `1pt solid ${COLORS.softBorder}` },
  metaLabel: { fontSize: 8, color: COLORS.stoneGrey },
  metaValue: { fontSize: 10, fontWeight: 600, marginTop: 2 },
  sectionHeading: { fontFamily: "Cormorant Garamond", fontSize: 14, fontWeight: 700, color: COLORS.chilliRed, marginTop: 16, marginBottom: 8 },
  tableHeaderRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.softBorder}`, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottom: `0.5pt solid ${COLORS.softBorder}`, alignItems: "center" },
  colCheck: { width: 24 },
  checkbox: { width: 12, height: 12, border: `1pt solid ${COLORS.charcoal}` },
  colName: { flex: 3 },
  colSku: { flex: 1 },
  colQty: { flex: 1, textAlign: "right" },
  tableHeaderText: { fontSize: 8, fontWeight: 600, color: COLORS.stoneGrey },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

function PackingSlipDocument({ order }: { order: OrderAdminDetail }) {
  return (
    <Document title={`Packing Slip ${order.orderNumber} — Oristor`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Packing Slip</Text>
        <Text style={styles.subtitle}>ORISTOR Food Products (Pvt) Ltd — warehouse copy, no pricing</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Order number</Text>
            <Text style={styles.metaValue}>{order.orderNumber}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Order date</Text>
            <Text style={styles.metaValue}>{new Date(order.placedAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Ship to</Text>
            <Text style={styles.metaValue}>{order.shippingAddress.recipientName}</Text>
            <Text style={styles.metaValue}>{order.shippingAddress.line1}</Text>
            {order.shippingAddress.line2 && <Text style={styles.metaValue}>{order.shippingAddress.line2}</Text>}
            <Text style={styles.metaValue}>
              {order.shippingAddress.city}
              {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Items to pick</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderText, styles.colCheck]}></Text>
          <Text style={[styles.tableHeaderText, styles.colName]}>Product</Text>
          <Text style={[styles.tableHeaderText, styles.colSku]}>SKU</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.orderItemId} style={styles.tableRow}>
            <View style={styles.colCheck}>
              <View style={styles.checkbox} />
            </View>
            <Text style={styles.colName}>{item.productName}</Text>
            <Text style={styles.colSku}>{item.productSku}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com
        </Text>
      </Page>
    </Document>
  );
}

export function renderOrderPackingSlipPdf(order: OrderAdminDetail): Promise<Buffer> {
  return renderToBuffer(<PackingSlipDocument order={order} />);
}
