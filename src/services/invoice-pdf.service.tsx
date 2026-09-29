import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { OrderDetail } from "@/services/customer-order-history.service";

// See recipe-pdf.service.tsx's doc comment: @react-pdf/renderer needs real
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

// Hex values from docs/blueprint.md Section 2's brand color table — same
// palette recipe-pdf.service.tsx uses.
const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  gold: "#CDAF52",
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
  tableRow: { flexDirection: "row", paddingVertical: 3 },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  tableHeaderText: { fontSize: 8, fontWeight: 600, color: COLORS.stoneGrey },
  totalsBlock: { marginTop: 12, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", gap: 24, marginBottom: 2 },
  totalsLabel: { fontSize: 10, color: COLORS.stoneGrey },
  totalsValue: { fontSize: 10, fontWeight: 600 },
  grandTotalValue: { fontSize: 13, fontWeight: 700, color: COLORS.chilliRed },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvoicePdfDocument({ order }: { order: OrderDetail }) {
  return (
    <Document title={`Invoice ${order.orderNumber} — Oristor`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.subtitle}>ORISTOR Food Products (Pvt) Ltd</Text>

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

        <Text style={styles.sectionHeading}>Items</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderText, styles.colName]}>Product</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit price</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.orderItemId} style={styles.tableRow}>
            <Text style={styles.colName}>{item.productName}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatCurrency(item.unitPrice, order.currency)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(item.lineTotal, order.currency)}</Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(order.subtotal, order.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Delivery</Text>
            <Text style={styles.totalsValue}>{formatCurrency(order.deliveryCharge, order.currency)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount{order.discountLabel ? ` (${order.discountLabel})` : ""}</Text>
              <Text style={styles.totalsValue}>-{formatCurrency(order.discount, order.currency)}</Text>
            </View>
          )}
          {order.pointsRedemptionValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Points redeemed ({order.pointsRedeemed} pts)</Text>
              <Text style={styles.totalsValue}>-{formatCurrency(order.pointsRedemptionValue, order.currency)}</Text>
            </View>
          )}
          {order.tax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatCurrency(order.tax, order.currency)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Grand total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(order.grandTotal, order.currency)}</Text>
          </View>
        </View>

        {order.payment && (
          <>
            <Text style={styles.sectionHeading}>Payment</Text>
            <Text>
              {order.payment.provider} — {order.payment.status}
            </Text>
          </>
        )}

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com
        </Text>
      </Page>
    </Document>
  );
}

export function renderOrderInvoicePdf(order: OrderDetail): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDocument order={order} />);
}
