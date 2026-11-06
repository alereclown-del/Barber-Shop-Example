import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundToTwoDecimals,
  parseDecimalSafe,
  sanitizeDecimalInput,
  usdToBs,
  bsToUsd,
  summarizeSplits,
  calculateCashCloseout,
  evaluateReceiptExtraction,
  buildWhatsAppUrl,
} from './finance';
import { AppointmentItem, ClientProfile } from '../types';

test('roundToTwoDecimals and parseDecimalSafe handle commas, dots, and floating-point epsilon', () => {
  assert.equal(roundToTwoDecimals(1.005), 1.01);
  assert.equal(roundToTwoDecimals(12.3456), 12.35);
  assert.equal(parseDecimalSafe('45,50'), 45.5);
  assert.equal(parseDecimalSafe('12.'), 12);
  assert.equal(parseDecimalSafe('0,75'), 0.75);
  assert.equal(parseDecimalSafe(''), 0);
  assert.equal(sanitizeDecimalInput('45,50'), '45.50');
  assert.equal(sanitizeDecimalInput('12.'), '12.');
  assert.equal(sanitizeDecimalInput('12..5'), null);
});

test('usdToBs and bsToUsd calculate exact Venezuelan exchange conversions', () => {
  assert.equal(usdToBs(12, 45.5), 546);
  assert.equal(usdToBs(15, 45.5), 682.5);
  assert.equal(bsToUsd(546, 45.5), 12);
  assert.equal(bsToUsd(227.5, 45.5), 5);
});

test('summarizeSplits handles mixed Pago Móvil + Cash with change left as client credit', () => {
  const summary = summarizeSplits(12, [
    {
      id: 's1',
      method: 'PAGO_MOVIL_BS',
      amountUsd: 5,
      amountBs: 227.5,
      rateApplied: 45.5,
      bank: 'Banesco (0134)',
      referenceDigits: '8492',
    },
    {
      id: 's2',
      method: 'EFECTIVO_USD',
      amountUsd: 7,
      cashTenderedUsd: 10,
      changeUsd: 3,
      changeHandling: 'ABONAR_SALDO_FAVOR',
    },
  ]);

  assert.equal(summary.coveredUsd, 12);
  assert.equal(summary.fiadoUsd, 0);
  assert.equal(summary.remainingUnassignedUsd, 0);
  assert.equal(summary.solvencyResult, 'PAGADO');
  assert.equal(summary.newClientBalanceDeltaUsd, 3);
});

test('summarizeSplits handles partial payment + Fiado (abono parcial)', () => {
  const summary = summarizeSplits(15, [
    {
      id: 's1',
      method: 'EFECTIVO_USD',
      amountUsd: 10,
    },
    {
      id: 's2',
      method: 'FIADO_PENDIENTE',
      amountUsd: 5,
    },
  ]);

  assert.equal(summary.coveredUsd, 10);
  assert.equal(summary.fiadoUsd, 5);
  assert.equal(summary.solvencyResult, 'ABONO_PARCIAL');
  assert.equal(summary.newClientBalanceDeltaUsd, -5);
});

test('evaluateReceiptExtraction validates Pago Móvil amount against active rate', () => {
  const exactReceipt = evaluateReceiptExtraction(
    'Banesco (0134)',
    '05/11/2026',
    '4829',
    546.0,
    12,
    45.5
  );
  assert.equal(exactReceipt.matchesExpectedTotal, true);
  assert.equal(exactReceipt.equivalentUsd, 12);
  assert.equal(exactReceipt.differenceBs, 0);

  const shortReceipt = evaluateReceiptExtraction(
    'Mercantil (0105)',
    '05/11/2026',
    '9104',
    400.0,
    12,
    45.5
  );
  assert.equal(shortReceipt.matchesExpectedTotal, false);
  assert.equal(shortReceipt.differenceBs, -146);
});

test('calculateCashCloseout aggregates multi-currency pockets accurately', () => {
  const appointments: AppointmentItem[] = [
    {
      id: 'a1',
      clientId: 'c1',
      clientName: 'Carlos Mendoza',
      clientPhone: '0414-1234567',
      dateKey: 'HOY',
      dayLabel: 'Hoy',
      time: '09:00',
      barberName: 'Gabriel',
      serviceId: 'CORTE_BARBA',
      serviceName: 'Corte + Barba',
      priceUsd: 12,
      status: 'COMPLETADO',
      solvency: 'PAGADO',
      paidUsd: 12,
      splits: [
        {
          id: 'p1',
          method: 'PAGO_MOVIL_BS',
          amountUsd: 7,
          amountBs: 318.5,
          rateApplied: 45.5,
        },
        {
          id: 'p2',
          method: 'EFECTIVO_USD',
          amountUsd: 5,
        },
      ],
    },
  ];

  const clients: ClientProfile[] = [
    {
      id: 'c1',
      name: 'Carlos Mendoza',
      phone: '0414-1234567',
      frequency: 'Cada 15 días',
      styleNotes: 'Mid fade',
      isVip: true,
      balanceUsd: -3.0,
      lastVisitDate: '05 Nov',
      history: [],
    },
    {
      id: 'c2',
      name: 'Luis Rondón',
      phone: '0412-9876543',
      frequency: 'Cada 10 días',
      styleNotes: 'Low taper',
      isVip: false,
      balanceUsd: 2.0,
      lastVisitDate: '01 Nov',
      history: [],
    },
  ];

  const closeout = calculateCashCloseout(appointments, clients, 45.5);
  assert.equal(closeout.totalProducedUsd, 12);
  assert.equal(closeout.pagoMovilBs, 318.5);
  assert.equal(closeout.efectivoUsdDrawer, 5);
  assert.equal(closeout.totalStreetReceivablesUsd, 3);
  assert.equal(closeout.totalClientCreditsUsd, 2);
});

test('buildWhatsAppUrl normalizes Venezuelan numbers and encodes message', () => {
  const url = buildWhatsAppUrl('0414-289-4102', 'Andrés Vizquel', 'RECORDATORIO_TURNO', {
    time: '15:30',
    serviceName: 'Corte + Barba',
    amountUsd: 12,
    rateBs: 45.5,
  });
  assert.ok(url.startsWith('https://wa.me/584142894102?text='));
  assert.ok(decodeURIComponent(url).includes('Hermano Andrés'));
  assert.ok(decodeURIComponent(url).includes('546,00 Bs'));
});
