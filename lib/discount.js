import { Prisma } from "@prisma/client";

const D = (n) => new Prisma.Decimal(n || 0);
const clamp = (x, min, max) => (x.lessThan(min) ? min : x.greaterThan(max) ? max : x);

export function computeLine({ quantity, unitPrice, discountType, discountValue }) {
  const qty = D(quantity);
  const price = D(unitPrice);
  const before = qty.mul(price);
  let disc = D(0);
  if (discountType && discountValue != null) {
    disc = discountType === "PERCENT" ? before.mul(D(discountValue).div(D(100))) : D(discountValue);
    disc = clamp(disc, D(0), before);
  }
  const after = before.sub(disc);
  return {
    line_total_before_discount: before.toDecimalPlaces(2),
    line_discount_amount: disc.toDecimalPlaces(2),
    line_total_after_discount: after.toDecimalPlaces(2),
  };
}

export function computeInvoice({ lineTotalsAfter, invoiceDiscountType, invoiceDiscountValue, taxRate }) {
  const subtotal = (Array.isArray(lineTotalsAfter) ? lineTotalsAfter : []).reduce((acc, v) => acc.add(D(v)), D(0));
  let invDisc = D(0);
  if (invoiceDiscountType && invoiceDiscountValue != null) {
    invDisc = invoiceDiscountType === "PERCENT" ? subtotal.mul(D(invoiceDiscountValue).div(D(100))) : D(invoiceDiscountValue);
    invDisc = clamp(invDisc, D(0), subtotal);
  }
  const afterDisc = subtotal.sub(invDisc);
  const tax = taxRate != null ? afterDisc.mul(D(taxRate).div(D(100))) : D(0);
  const total = afterDisc.add(tax);
  return {
    subtotal_before_invoice_discount: subtotal.toDecimalPlaces(2),
    invoice_discount_amount: invDisc.toDecimalPlaces(2),
    subtotal_after_invoice_discount: afterDisc.toDecimalPlaces(2),
    tax_amount: tax.toDecimalPlaces(2),
    total_amount: total.toDecimalPlaces(2),
  };
}

