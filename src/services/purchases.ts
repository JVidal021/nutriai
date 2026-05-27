/**
 * purchases.ts — Mock para Expo Go
 * Pagamentos reais: integrados via Mercado Pago (Edge Function create-payment)
 */

export async function initPurchases(_userId?: string): Promise<void> {}

export async function checkPremium(): Promise<boolean> {
  return false
}

export async function getOfferings() {
  return {
    availablePackages: [
      { packageType: 'MONTHLY', product: { priceString: 'R$ 29,00', price: 29.0 } },
      { packageType: 'ANNUAL',  product: { priceString: 'R$ 209,00', price: 209.0 } },
    ],
  }
}

export async function purchasePackage(
  _pkg: Record<string, unknown>
): Promise<{ success: boolean; cancelled: boolean }> {
  return { success: true, cancelled: false }
}

export async function restorePurchases(): Promise<boolean> {
  return false
}

export function openSubscriptionManagement(): void {}
