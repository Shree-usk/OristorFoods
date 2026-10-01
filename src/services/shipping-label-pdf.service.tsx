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
  white: "#FFFFFF",
  charcoal: "#2F2B2A",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.white, padding: 24, fontFamily: "Inter", fontSize: 11, color: COLORS.charcoal },
  outerBorder: { border: `2pt solid ${COLORS.charcoal}`, padding: 20, height: "100%" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: `1pt solid ${COLORS.softBorder}` },
  brandName: { fontFamily: "Cormorant Garamond", fontSize: 18, fontWeight: 700 },
  orderNumber: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  sectionLabel: { fontSize: 8, color: COLORS.stoneGrey, marginBottom: 4, marginTop: 16 },
  shipToName: { fontSize: 18, fontWeight: 700 },
  addressLine: { fontSize: 13, marginTop: 2 },
  placeholderBlock: { marginTop: 28, padding: 16, border: `1pt dashed ${COLORS.stoneGrey}`, alignItems: "center" },
  placeholderBarcode: { fontFamily: "Courier", fontSize: 28, letterSpacing: 2 },
  placeholderNote: { fontSize: 8, color: COLORS.stoneGrey, marginTop: 6, textAlign: "center" },
});

/**
 * STORY-047. A genuine carrier-agnostic placeholder — per the AC's own
 * wording and blueprint Section 10's unconfirmed-carrier flag, this
 * makes no claim of real carrier tracking/barcode scanning. Swapped for
 * a real carrier template once that decision is made.
 */
function ShippingLabelDocument({ order }: { order: OrderAdminDetail }) {
  return (
    <Document title={`Shipping Label ${order.orderNumber} — Oristor`}>
      <Page size="A6" style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.brandRow}>
            <Text style={styles.brandName}>ORISTOR</Text>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          </View>

          <Text style={styles.sectionLabel}>Ship to</Text>
          <Text style={styles.shipToName}>{order.shippingAddress.recipientName}</Text>
          <Text style={styles.addressLine}>{order.shippingAddress.line1}</Text>
          {order.shippingAddress.line2 && <Text style={styles.addressLine}>{order.shippingAddress.line2}</Text>}
          <Text style={styles.addressLine}>
            {order.shippingAddress.city}
            {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ""}
            {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}
          </Text>
          <Text style={styles.addressLine}>{order.shippingAddress.phone}</Text>

          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderBarcode}>* {order.orderNumber} *</Text>
            <Text style={styles.placeholderNote}>Carrier: not yet integrated — generic placeholder label</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderOrderShippingLabelPdf(order: OrderAdminDetail): Promise<Buffer> {
  return renderToBuffer(<ShippingLabelDocument order={order} />);
}
