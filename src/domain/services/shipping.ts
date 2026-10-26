// ============================================
// Homara — Domain Service: Shipping Cost (TS)
// ============================================

export const FREE_SHIPPING_THRESHOLD = 500000;
export const SHIPPING_FEE = 25000;

/** RN-031: envío gratis desde 500.000 COP (inclusive). Un carrito vacío no paga envío. */
export function calculateShipping(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}
