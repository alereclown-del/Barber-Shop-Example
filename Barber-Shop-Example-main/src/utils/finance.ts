import {
  AppointmentItem,
  ClientProfile,
  ExchangeRates,
  ExtractedReceiptData,
  PaymentSplitEntry,
  SolvencyBadge,
  VenezuelanBank,
} from '../types';

export const roundToTwoDecimals = (num: number): number => {
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const parseDecimalSafe = (val: string | number): number => {
  if (typeof val === 'number') return Number.isNaN(val) || !Number.isFinite(val) ? 0 : val;
  if (typeof val !== 'string') return 0;
  const clean = val.replace(/,/g, '.').trim();
  if (!clean || clean === '.') return 0;
  const parsed = parseFloat(clean);
  return Number.isNaN(parsed) || !Number.isFinite(parsed) ? 0 : parsed;
};

/**
 * Normalizes commas into dots and returns the cleaned string if it is a valid
 * partial or complete non-negative decimal input (e.g. "", "12", "12.", "12.50", ".5").
 * Returns null if the input contains invalid characters or multiple decimal points.
 */
export const sanitizeDecimalInput = (rawValue: string): string | null => {
  const normalized = rawValue.replace(/,/g, '.');
  if (/^\d*\.?\d*$/.test(normalized)) {
    return normalized;
  }
  return null;
};

export function getActiveRate(rates: ExchangeRates): number {
  if (rates.activeMode === 'EUR_BCV' || (rates.activeMode === 'BCV' && rates.officialCurrency === 'EUR')) {
    if (typeof rates.EUR_BCV === 'number' && rates.EUR_BCV > 0) {
      return roundToTwoDecimals(rates.EUR_BCV);
    }
  }
  const raw = rates[rates.activeMode as keyof ExchangeRates];
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? roundToTwoDecimals(raw) : 45.5;
}

export function usdToBs(usd: number, rateBs: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(rateBs) || rateBs <= 0) return 0;
  return roundToTwoDecimals(usd * rateBs);
}

export function bsToUsd(bs: number, rateBs: number): number {
  if (!Number.isFinite(bs) || !Number.isFinite(rateBs) || rateBs <= 0) return 0;
  return roundToTwoDecimals(bs / rateBs);
}

export function formatUsd(amount: number): string {
  const safe = Number.isFinite(amount) ? roundToTwoDecimals(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}$${Math.abs(safe).toFixed(2)}`;
}

export function formatBs(amount: number): string {
  const safe = Number.isFinite(amount) ? roundToTwoDecimals(amount) : 0;
  return `${safe.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

export interface SplitSummary {
  serviceTotalUsd: number;
  coveredUsd: number;         // Non-fiado payments covered right now
  fiadoUsd: number;           // Explicitly marked as fiado/pendiente
  remainingUnassignedUsd: number; // Still needs to be assigned in the modal
  solvencyResult: SolvencyBadge;
  newClientBalanceDeltaUsd: number; // Negative if client takes on debt, positive if client leaves change as credit
}

export function summarizeSplits(
  serviceTotalUsd: number,
  splits: PaymentSplitEntry[]
): SplitSummary {
  let coveredUsd = 0;
  let fiadoUsd = 0;
  let newClientBalanceDeltaUsd = 0;

  for (const s of splits) {
    const amt = Math.max(0, roundToTwoDecimals(s.amountUsd || 0));
    if (s.method === 'FIADO_PENDIENTE') {
      fiadoUsd = roundToTwoDecimals(fiadoUsd + amt);
      newClientBalanceDeltaUsd = roundToTwoDecimals(newClientBalanceDeltaUsd - amt);
    } else if (s.method === 'SALDO_A_FAVOR_APLICADO') {
      coveredUsd = roundToTwoDecimals(coveredUsd + amt);
      newClientBalanceDeltaUsd = roundToTwoDecimals(newClientBalanceDeltaUsd - amt);
    } else {
      coveredUsd = roundToTwoDecimals(coveredUsd + amt);
      if (
        s.method === 'EFECTIVO_USD' &&
        s.changeUsd &&
        s.changeUsd > 0 &&
        (s.changeHandling === 'ABONAR_SALDO_FAVOR' || s.changeHandling === 'VUELTO_PENDIENTE')
      ) {
        newClientBalanceDeltaUsd = roundToTwoDecimals(
          newClientBalanceDeltaUsd + roundToTwoDecimals(s.changeUsd)
        );
      }
    }
  }

  const assignedTotal = roundToTwoDecimals(coveredUsd + fiadoUsd);
  const remainingUnassignedUsd = Math.max(
    0,
    roundToTwoDecimals(serviceTotalUsd - assignedTotal)
  );

  // Any remaining unassigned amount when closing is also treated as pending debt if not covered
  const effectiveDebt = roundToTwoDecimals(fiadoUsd + remainingUnassignedUsd);

  let solvencyResult: SolvencyBadge = 'PAGADO';
  if (coveredUsd === 0 && effectiveDebt > 0) {
    solvencyResult = 'PENDIENTE';
  } else if (coveredUsd > 0 && effectiveDebt > 0.01) {
    solvencyResult = 'ABONO_PARCIAL';
  } else {
    solvencyResult = 'PAGADO';
  }

  return {
    serviceTotalUsd: roundToTwoDecimals(serviceTotalUsd),
    coveredUsd,
    fiadoUsd: effectiveDebt,
    remainingUnassignedUsd,
    solvencyResult,
    newClientBalanceDeltaUsd: roundToTwoDecimals(
      newClientBalanceDeltaUsd - remainingUnassignedUsd
    ),
  };
}

export interface CashCloseoutSummary {
  totalProducedUsd: number;
  totalProducedBsEquiv: number;
  completedCutsCount: number;
  pagoMovilBs: number;
  pagoMovilUsdEquiv: number;
  puntoEfectivoBs: number;
  puntoEfectivoUsdEquiv: number;
  efectivoUsdDrawer: number;         // Physical USD bills in the drawer
  digitalUsdTotal: number;           // Zinli + Binance USDT + Zelle
  fiadoTodayUsd: number;             // Left unpaid from today's cuts
  totalStreetReceivablesUsd: number; // Total owed across all clients in the directory
  totalClientCreditsUsd: number;     // Total "saldo a favor" owed to clients
}

export function calculateCashCloseout(
  appointments: AppointmentItem[],
  clients: ClientProfile[],
  activeRateBs: number
): CashCloseoutSummary {
  let totalProducedUsd = 0;
  let completedCutsCount = 0;
  let pagoMovilBs = 0;
  let pagoMovilUsdEquiv = 0;
  let puntoEfectivoBs = 0;
  let puntoEfectivoUsdEquiv = 0;
  let efectivoUsdDrawer = 0;
  let digitalUsdTotal = 0;
  let fiadoTodayUsd = 0;

  const todayAppointments = appointments.filter((a) => a.dateKey === 'HOY');

  for (const appt of todayAppointments) {
    if (appt.status === 'COMPLETADO') {
      completedCutsCount += 1;
      totalProducedUsd = roundToTwoDecimals(totalProducedUsd + appt.priceUsd);
    }

    if (appt.splits && appt.splits.length > 0) {
      for (const s of appt.splits) {
        const rate = s.rateApplied || activeRateBs;
        if (s.method === 'PAGO_MOVIL_BS') {
          const bs = s.amountBs ?? usdToBs(s.amountUsd, rate);
          pagoMovilBs = roundToTwoDecimals(pagoMovilBs + bs);
          pagoMovilUsdEquiv = roundToTwoDecimals(pagoMovilUsdEquiv + s.amountUsd);
        } else if (s.method === 'PUNTO_EFECTIVO_BS') {
          const bs = s.amountBs ?? usdToBs(s.amountUsd, rate);
          puntoEfectivoBs = roundToTwoDecimals(puntoEfectivoBs + bs);
          puntoEfectivoUsdEquiv = roundToTwoDecimals(puntoEfectivoUsdEquiv + s.amountUsd);
        } else if (s.method === 'EFECTIVO_USD') {
          if (
            s.cashTenderedUsd &&
            s.cashTenderedUsd > s.amountUsd &&
            s.changeHandling &&
            s.changeHandling !== 'ENTREGADO_EFECTIVO'
          ) {
            efectivoUsdDrawer = roundToTwoDecimals(efectivoUsdDrawer + s.cashTenderedUsd);
          } else {
            efectivoUsdDrawer = roundToTwoDecimals(efectivoUsdDrawer + s.amountUsd);
          }
        } else if (s.method === 'DIGITAL_USD') {
          digitalUsdTotal = roundToTwoDecimals(digitalUsdTotal + s.amountUsd);
        } else if (s.method === 'FIADO_PENDIENTE') {
          fiadoTodayUsd = roundToTwoDecimals(fiadoTodayUsd + s.amountUsd);
        }
      }
    } else if (appt.status === 'COMPLETADO' && appt.paidUsd < appt.priceUsd) {
      fiadoTodayUsd = roundToTwoDecimals(
        fiadoTodayUsd + Math.max(0, appt.priceUsd - appt.paidUsd)
      );
    }
  }

  let totalStreetReceivablesUsd = 0;
  let totalClientCreditsUsd = 0;

  for (const c of clients) {
    if (c.balanceUsd < -0.009) {
      totalStreetReceivablesUsd = roundToTwoDecimals(
        totalStreetReceivablesUsd + Math.abs(c.balanceUsd)
      );
    } else if (c.balanceUsd > 0.009) {
      totalClientCreditsUsd = roundToTwoDecimals(totalClientCreditsUsd + c.balanceUsd);
    }
  }

  return {
    totalProducedUsd,
    totalProducedBsEquiv: usdToBs(totalProducedUsd, activeRateBs),
    completedCutsCount,
    pagoMovilBs,
    pagoMovilUsdEquiv,
    puntoEfectivoBs,
    puntoEfectivoUsdEquiv,
    efectivoUsdDrawer,
    digitalUsdTotal,
    fiadoTodayUsd,
    totalStreetReceivablesUsd,
    totalClientCreditsUsd,
  };
}

export function evaluateReceiptExtraction(
  originBank: VenezuelanBank,
  date: string,
  referenceLastDigits: string,
  amountBs: number,
  expectedUsd: number,
  activeRateBs: number
): ExtractedReceiptData {
  const expectedBs = usdToBs(expectedUsd, activeRateBs);
  const equivalentUsd = bsToUsd(amountBs, activeRateBs);
  const differenceBs = roundToTwoDecimals(amountBs - expectedBs);
  const matchesExpectedTotal = Math.abs(differenceBs) <= 1.5;

  return {
    originBank,
    date,
    referenceLastDigits,
    amountBs: roundToTwoDecimals(amountBs),
    equivalentUsd,
    matchesExpectedTotal,
    differenceBs,
    confidenceLabel: '99.4% OCR Bancario VE',
  };
}

export function buildWhatsAppUrl(
  phone: string,
  clientName: string,
  messageType: 'RECORDATORIO_TURNO' | 'COBRO_DEUDA' | 'SALDO_FAVOR',
  details: {
    time?: string;
    serviceName?: string;
    amountUsd?: number;
    rateBs: number;
  }
): string {
  const digits = phone.replace(/\D/g, '');
  const normalizedPhone = digits.startsWith('58')
    ? digits
    : digits.startsWith('0')
    ? `58${digits.slice(1)}`
    : `58${digits}`;

  const firstName = clientName.split(' ')[0];
  let text = '';

  if (messageType === 'RECORDATORIO_TURNO') {
    const usd = details.amountUsd ?? 10;
    const bs = formatBs(usdToBs(usd, details.rateBs));
    text = `Hermano ${firstName}, tienes turno agendado hoy a las ${details.time || '10:00'} en BARBER SHOP (${details.serviceName || 'Corte'}). Monto: ${formatUsd(usd)} (${bs} a tasa ${details.rateBs.toFixed(2)}). ¡Te esperamos activos!`;
  } else if (messageType === 'COBRO_DEUDA') {
    const usd = Math.abs(details.amountUsd ?? 0);
    const bs = formatBs(usdToBs(usd, details.rateBs));
    text = `Hermano ${firstName}, saludos de BARBER SHOP. Te recordamos que tienes un saldo pendiente de ${formatUsd(usd)} (equiv. a ${bs} a la tasa de hoy ${details.rateBs.toFixed(2)} Bs/USD). Puedes cancelar por Pago Móvil o efectivo cuando gustes.`;
  } else {
    const usd = Math.abs(details.amountUsd ?? 0);
    text = `Hermano ${firstName}, te recordamos que en BARBER SHOP tienes un saldo a favor de ${formatUsd(usd)} disponible para tu próximo corte.`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}
