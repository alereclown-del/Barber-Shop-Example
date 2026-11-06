export type RateMode = 'BCV' | 'PARALELO' | 'PERSONALIZADA' | 'EUR_BCV';

export interface ExchangeRates {
  BCV: number;
  PARALELO: number;
  PERSONALIZADA: number;
  EUR_BCV?: number;
  activeMode: RateMode;
  lastUpdated: string;
  officialCurrency?: 'USD' | 'EUR';
}

export type ServiceId = 'CORTE' | 'BARBA' | 'CEJAS' | 'COMBO_IMPERIAL' | 'CORTE_BARBA' | 'CERQUILLO';

export interface ServiceCatalogItem {
  id: ServiceId;
  name: string;
  shortName: string;
  priceUsd: number;
  durationMin: number;
}

export type AppointmentStatus = 'EN_ESPERA' | 'EN_SILLA' | 'COMPLETADO';
export type SolvencyBadge = 'PAGADO' | 'ABONO_PARCIAL' | 'PENDIENTE';

export type PaymentMethodType =
  | 'PAGO_MOVIL_BS'
  | 'EFECTIVO_USD'
  | 'DIGITAL_USD'      // Zinli / Binance USDT / Zelle
  | 'PUNTO_EFECTIVO_BS'
  | 'SALDO_A_FAVOR_APLICADO'
  | 'FIADO_PENDIENTE';

export type VenezuelanBank =
  | 'Banesco (0134)'
  | 'Mercantil (0105)'
  | 'Bancamiga (0172)'
  | 'Banco de Venezuela (0102)'
  | 'BBVA Provincial (0108)'
  | 'BNC (0191)';

export type DigitalWalletProvider = 'Binance USDT' | 'Zinli' | 'Zelle';

export interface PaymentSplitEntry {
  id: string;
  method: PaymentMethodType;
  amountUsd: number;          // Equivalent value in USD covered by this split
  amountBs?: number;          // Amount in Bs if paid in Bolivares
  rateApplied?: number;       // Exchange rate at moment of payment
  bank?: VenezuelanBank;
  referenceDigits?: string;   // Last 4 or 6 digits for Pago Móvil or POS
  digitalProvider?: DigitalWalletProvider;
  accountIdentifier?: string; // Email / user / reference for Zinli/Binance/Zelle
  cashTenderedUsd?: number;   // Physical bill handed over (e.g. $20 bill for $12 service)
  changeUsd?: number;         // Change owed ($8)
  changeHandling?: 'ENTREGADO_EFECTIVO' | 'ENTREGADO_PAGO_MOVIL' | 'ABONAR_SALDO_FAVOR' | 'VUELTO_PENDIENTE';
  receiptVerified?: boolean;
}

export interface VisitRecord {
  id: string;
  date: string;         // e.g. '05 Nov 2026'
  time: string;         // e.g. '10:30'
  serviceName: string;
  totalUsd: number;
  rateBs: number;
  splits: PaymentSplitEntry[];
  notes?: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;        // e.g. '+58 414-2894102'
  frequency: string;    // e.g. 'Cada 12 días'
  styleNotes: string;   // e.g. 'Mid fade con la 1.5, no bajarle mucho arriba, navaja en patillas'
  isVip: boolean;
  /**
   * Net financial balance in USD:
   * - Negative value (e.g. -3.00): Client OWES the barbershop $3.00 ("Debe $3.00")
   * - Positive value (e.g. +2.00): Client has CREDIT in their favor ("Saldo a favor: $2.00")
   * - Zero (0): Solvent ("Solvente")
   */
  balanceUsd: number;
  balanceNote?: string; // e.g. 'Debe $3.00 del 24/Oct (Corte + Barba)' or 'Vuelto pendiente de billete $20 el 28/Oct'
  lastVisitDate: string;
  history: VisitRecord[];
}

export interface AppointmentItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  dateKey: string;      // 'HOY' or 'SEM_LUN', 'SEM_MAR', etc.
  dayLabel: string;     // 'Jue 05 Nov'
  time: string;         // '09:00', '10:00', etc.
  barberName: string;
  serviceId: ServiceId;
  serviceName: string;
  priceUsd: number;
  status: AppointmentStatus;
  solvency: SolvencyBadge;
  paidUsd: number;
  splits?: PaymentSplitEntry[];
}

export interface ExtractedReceiptData {
  originBank: VenezuelanBank;
  date: string;
  referenceLastDigits: string;
  amountBs: number;
  equivalentUsd: number;
  matchesExpectedTotal: boolean;
  differenceBs: number;
  confidenceLabel: string;
}
