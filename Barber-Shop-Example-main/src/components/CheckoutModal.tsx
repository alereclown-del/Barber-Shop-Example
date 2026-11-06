import React, { useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Plus,
  Smartphone,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppointmentItem,
  ClientProfile,
  DigitalWalletProvider,
  ExtractedReceiptData,
  PaymentMethodType,
  PaymentSplitEntry,
  VenezuelanBank,
} from '../types';
import { VENEZUELAN_BANKS } from '../data/seedData';
import {
  bsToUsd,
  evaluateReceiptExtraction,
  formatBs,
  formatUsd,
  parseDecimalSafe,
  roundToTwoDecimals,
  sanitizeDecimalInput,
  summarizeSplits,
  usdToBs,
} from '../utils/finance';

interface CheckoutModalProps {
  appointment: AppointmentItem;
  client: ClientProfile | undefined;
  activeRateBs: number;
  onClose: () => void;
  onConfirmCheckout: (
    appointmentId: string,
    splits: PaymentSplitEntry[],
    includePreviousDebtUsd: number
  ) => void;
}

interface SplitDraftStrings {
  usdStr: string;
  bsStr: string;
  tenderedStr: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  appointment,
  client,
  activeRateBs,
  onClose,
  onConfirmCheckout,
}) => {
  const previousDebtUsd =
    client && client.balanceUsd < -0.01 ? Math.abs(client.balanceUsd) : 0;
  const availableCreditUsd =
    client && client.balanceUsd > 0.01 ? client.balanceUsd : 0;

  const [includePreviousDebt, setIncludePreviousDebt] = useState(false);

  const effectiveTotalUsd = roundToTwoDecimals(
    appointment.priceUsd + (includePreviousDebt ? previousDebtUsd : 0)
  );

  // Initialize splits from existing appointment splits or default to 1 Pago Móvil line covering the total
  const [splits, setSplits] = useState<PaymentSplitEntry[]>(() => {
    if (appointment.splits && appointment.splits.length > 0) {
      return appointment.splits;
    }
    return [
      {
        id: 'split-init-1',
        method: 'PAGO_MOVIL_BS',
        amountUsd: appointment.priceUsd,
        amountBs: usdToBs(appointment.priceUsd, activeRateBs),
        rateApplied: activeRateBs,
        bank: 'Banesco (0134)',
        referenceDigits: '8429',
      },
    ];
  });

  // Decoupled string state for every split so typing "12." or "12,50" never deletes the dot/comma
  const [splitStrings, setSplitStrings] = useState<Record<string, SplitDraftStrings>>(() => {
    const initialList: PaymentSplitEntry[] =
      appointment.splits && appointment.splits.length > 0
        ? appointment.splits
        : [
            {
              id: 'split-init-1',
              method: 'PAGO_MOVIL_BS',
              amountUsd: appointment.priceUsd,
              amountBs: usdToBs(appointment.priceUsd, activeRateBs),
            },
          ];
    const map: Record<string, SplitDraftStrings> = {};
    for (const s of initialList) {
      const bsVal = s.amountBs ?? usdToBs(s.amountUsd, activeRateBs);
      map[s.id] = {
        usdStr: String(s.amountUsd),
        bsStr: String(bsVal),
        tenderedStr: String(s.cashTenderedUsd ?? s.amountUsd),
      };
    }
    return map;
  });

  const syncStringsFromSplits = (nextSplits: PaymentSplitEntry[]) => {
    const nextMap: Record<string, SplitDraftStrings> = {};
    for (const s of nextSplits) {
      const bsVal = s.amountBs ?? usdToBs(s.amountUsd, activeRateBs);
      nextMap[s.id] = {
        usdStr: String(s.amountUsd),
        bsStr: String(bsVal),
        tenderedStr: String(s.cashTenderedUsd ?? s.amountUsd),
      };
    }
    setSplitStrings(nextMap);
  };

  // Smart Receipt Verifier state
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [extractedReceipt, setExtractedReceipt] =
    useState<ExtractedReceiptData | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const summary = summarizeSplits(effectiveTotalUsd, splits);
  const totalBsEquiv = usdToBs(effectiveTotalUsd, activeRateBs);

  const coverageRatio =
    effectiveTotalUsd > 0
      ? Math.min(100, Math.round(((summary.coveredUsd + summary.fiadoUsd) / effectiveTotalUsd) * 100))
      : 100;

  // Quick 1-Tap Presets (Regla de los 3 Toques)
  const applyQuickSinglePayment = (method: PaymentMethodType) => {
    setValidationError(null);
    let nextSplits: PaymentSplitEntry[] = [];

    if (method === 'PAGO_MOVIL_BS') {
      nextSplits = [
        {
          id: `sp-${Date.now()}`,
          method: 'PAGO_MOVIL_BS',
          amountUsd: effectiveTotalUsd,
          amountBs: usdToBs(effectiveTotalUsd, activeRateBs),
          rateApplied: activeRateBs,
          bank: 'Banesco (0134)',
          referenceDigits: extractedReceipt?.referenceLastDigits || '8429',
        },
      ];
    } else if (method === 'EFECTIVO_USD') {
      nextSplits = [
        {
          id: `sp-${Date.now()}`,
          method: 'EFECTIVO_USD',
          amountUsd: effectiveTotalUsd,
          cashTenderedUsd: effectiveTotalUsd,
          changeUsd: 0,
          changeHandling: 'ENTREGADO_EFECTIVO',
        },
      ];
    } else if (method === 'DIGITAL_USD') {
      nextSplits = [
        {
          id: `sp-${Date.now()}`,
          method: 'DIGITAL_USD',
          amountUsd: effectiveTotalUsd,
          digitalProvider: 'Binance USDT',
          accountIdentifier: 'usdt.pay@gmail.com',
        },
      ];
    } else if (method === 'PUNTO_EFECTIVO_BS') {
      nextSplits = [
        {
          id: `sp-${Date.now()}`,
          method: 'PUNTO_EFECTIVO_BS',
          amountUsd: effectiveTotalUsd,
          amountBs: usdToBs(effectiveTotalUsd, activeRateBs),
          rateApplied: activeRateBs,
          bank: 'Bancamiga (0172)',
          referenceDigits: '1104',
        },
      ];
    } else if (method === 'FIADO_PENDIENTE') {
      nextSplits = [
        {
          id: `sp-${Date.now()}`,
          method: 'FIADO_PENDIENTE',
          amountUsd: effectiveTotalUsd,
        },
      ];
    }

    setSplits(nextSplits);
    syncStringsFromSplits(nextSplits);
  };

  // Apply client's existing positive credit ("Saldo a Favor")
  const handleApplyClientCredit = () => {
    if (availableCreditUsd <= 0) return;
    const creditToUse = Math.min(availableCreditUsd, effectiveTotalUsd);
    const remainder = Math.max(
      0,
      roundToTwoDecimals(effectiveTotalUsd - creditToUse)
    );

    const nextSplits: PaymentSplitEntry[] = [
      {
        id: `sp-credit-${Date.now()}`,
        method: 'SALDO_A_FAVOR_APLICADO',
        amountUsd: creditToUse,
      },
    ];

    if (remainder > 0) {
      nextSplits.push({
        id: `sp-rem-${Date.now() + 1}`,
        method: 'PAGO_MOVIL_BS',
        amountUsd: remainder,
        amountBs: usdToBs(remainder, activeRateBs),
        rateApplied: activeRateBs,
        bank: 'Banesco (0134)',
        referenceDigits: '5512',
      });
    }

    setSplits(nextSplits);
    syncStringsFromSplits(nextSplits);
  };

  const handleAddSplitLine = (method: PaymentMethodType = 'EFECTIVO_USD') => {
    const remaining = summary.remainingUnassignedUsd > 0 ? summary.remainingUnassignedUsd : 5;
    let updatedExisting = [...splits];
    if (splits.length === 1 && summary.remainingUnassignedUsd === 0 && splits[0].amountUsd > 5) {
      const firstNewUsd = roundToTwoDecimals(splits[0].amountUsd - 5);
      updatedExisting[0] = {
        ...splits[0],
        amountUsd: firstNewUsd,
        amountBs:
          splits[0].method === 'PAGO_MOVIL_BS' || splits[0].method === 'PUNTO_EFECTIVO_BS'
            ? usdToBs(firstNewUsd, activeRateBs)
            : undefined,
      };
    }

    const newAmountUsd =
      splits.length === 1 && summary.remainingUnassignedUsd === 0 && splits[0].amountUsd > 5
        ? 5
        : remaining;

    const newEntry: PaymentSplitEntry = {
      id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method,
      amountUsd: newAmountUsd,
      amountBs:
        method === 'PAGO_MOVIL_BS' || method === 'PUNTO_EFECTIVO_BS'
          ? usdToBs(newAmountUsd, activeRateBs)
          : undefined,
      rateApplied: activeRateBs,
      bank: 'Banesco (0134)',
      referenceDigits: method === 'PAGO_MOVIL_BS' ? '9201' : undefined,
      digitalProvider: method === 'DIGITAL_USD' ? 'Binance USDT' : undefined,
      cashTenderedUsd: method === 'EFECTIVO_USD' ? newAmountUsd : undefined,
      changeUsd: 0,
      changeHandling: 'ABONAR_SALDO_FAVOR',
    };

    const nextSplits = [...updatedExisting, newEntry];
    setSplits(nextSplits);
    syncStringsFromSplits(nextSplits);
  };

  // Decoupled string input handlers for USD, Bs, and Tendered Cash
  const handleUsdInputChange = (splitId: string, rawVal: string) => {
    const cleaned = sanitizeDecimalInput(rawVal);
    if (cleaned === null) return;
    setValidationError(null);

    const parsedUsd = roundToTwoDecimals(parseDecimalSafe(cleaned));
    const derivedBs = usdToBs(parsedUsd, activeRateBs);

    setSplitStrings((prev) => {
      const curr = prev[splitId] || { usdStr: '', bsStr: '', tenderedStr: '' };
      return {
        ...prev,
        [splitId]: {
          ...curr,
          usdStr: cleaned,
          bsStr: String(derivedBs),
        },
      };
    });

    setSplits((prev) =>
      prev.map((item) => {
        if (item.id !== splitId) return item;
        const tendered = item.cashTenderedUsd ?? parsedUsd;
        const change =
          item.method === 'EFECTIVO_USD'
            ? Math.max(0, roundToTwoDecimals(tendered - parsedUsd))
            : 0;
        return {
          ...item,
          amountUsd: parsedUsd,
          amountBs:
            item.method === 'PAGO_MOVIL_BS' || item.method === 'PUNTO_EFECTIVO_BS'
              ? derivedBs
              : item.amountBs,
          changeUsd: change,
        };
      })
    );
  };

  const handleBsInputChange = (splitId: string, rawVal: string) => {
    const cleaned = sanitizeDecimalInput(rawVal);
    if (cleaned === null) return;
    setValidationError(null);

    const parsedBs = roundToTwoDecimals(parseDecimalSafe(cleaned));
    const derivedUsd = bsToUsd(parsedBs, activeRateBs);

    setSplitStrings((prev) => {
      const curr = prev[splitId] || { usdStr: '', bsStr: '', tenderedStr: '' };
      return {
        ...prev,
        [splitId]: {
          ...curr,
          bsStr: cleaned,
          usdStr: String(derivedUsd),
        },
      };
    });

    setSplits((prev) =>
      prev.map((item) => {
        if (item.id !== splitId) return item;
        return {
          ...item,
          amountBs: parsedBs,
          amountUsd: derivedUsd,
        };
      })
    );
  };

  const handleTenderedInputChange = (splitId: string, rawVal: string) => {
    const cleaned = sanitizeDecimalInput(rawVal);
    if (cleaned === null) return;
    setValidationError(null);

    const parsedTendered = roundToTwoDecimals(parseDecimalSafe(cleaned));

    setSplitStrings((prev) => {
      const curr = prev[splitId] || { usdStr: '', bsStr: '', tenderedStr: '' };
      return {
        ...prev,
        [splitId]: {
          ...curr,
          tenderedStr: cleaned,
        },
      };
    });

    setSplits((prev) =>
      prev.map((item) => {
        if (item.id !== splitId) return item;
        const change = Math.max(0, roundToTwoDecimals(parsedTendered - item.amountUsd));
        return {
          ...item,
          cashTenderedUsd: parsedTendered,
          changeUsd: change,
          changeHandling: item.changeHandling || 'ABONAR_SALDO_FAVOR',
        };
      })
    );
  };

  const handleUpdateSplit = (id: string, patch: Partial<PaymentSplitEntry>) => {
    setValidationError(null);
    setSplits((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...patch };

        if (
          patch.method &&
          (merged.method === 'PAGO_MOVIL_BS' || merged.method === 'PUNTO_EFECTIVO_BS')
        ) {
          merged.amountBs = usdToBs(merged.amountUsd, activeRateBs);
        }

        if (merged.method === 'EFECTIVO_USD') {
          const tendered = merged.cashTenderedUsd ?? merged.amountUsd;
          const change = Math.max(
            0,
            roundToTwoDecimals(tendered - merged.amountUsd)
          );
          merged.changeUsd = change;
          if (!merged.changeHandling) {
            merged.changeHandling = 'ABONAR_SALDO_FAVOR';
          }
          if (patch.cashTenderedUsd !== undefined) {
            setSplitStrings((sPrev) => ({
              ...sPrev,
              [id]: {
                ...(sPrev[id] || {
                  usdStr: String(merged.amountUsd),
                  bsStr: String(usdToBs(merged.amountUsd, activeRateBs)),
                }),
                tenderedStr: String(patch.cashTenderedUsd),
              },
            }));
          }
        }

        return merged;
      })
    );
  };

  const handleRemoveSplit = (id: string) => {
    setSplits((prev) => prev.filter((item) => item.id !== id));
  };

  // Receipt OCR Simulation & File Upload handler
  const handleSimulateReceipt = (preset: 'EXACT_BANESCO' | 'PARTIAL_MERCANTIL') => {
    setIsAnalyzingReceipt(true);
    setTimeout(() => {
      if (preset === 'EXACT_BANESCO') {
        const expectedBs = usdToBs(effectiveTotalUsd, activeRateBs);
        const result = evaluateReceiptExtraction(
          'Banesco (0134)',
          '05/11/2026 · 10:42 AM',
          '8492',
          expectedBs,
          effectiveTotalUsd,
          activeRateBs
        );
        setExtractedReceipt(result);
        setUploadedFileName('captura_pagomovil_banesco_8492.png');
      } else {
        const partialBs = usdToBs(Math.max(5, effectiveTotalUsd - 4), activeRateBs);
        const result = evaluateReceiptExtraction(
          'Mercantil (0105)',
          '05/11/2026 · 10:44 AM',
          '3109',
          partialBs,
          effectiveTotalUsd,
          activeRateBs
        );
        setExtractedReceipt(result);
        setUploadedFileName('captura_mercantil_abono_3109.jpg');
      }
      setIsAnalyzingReceipt(false);
    }, 150);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setIsAnalyzingReceipt(true);
    setTimeout(() => {
      const expectedBs = usdToBs(effectiveTotalUsd, activeRateBs);
      const result = evaluateReceiptExtraction(
        'Bancamiga (0172)',
        '05/11/2026 · Recién subido',
        '6741',
        expectedBs,
        effectiveTotalUsd,
        activeRateBs
      );
      setExtractedReceipt(result);
      setIsAnalyzingReceipt(false);
    }, 150);
  };

  const handleApplyExtractedReceiptToSplit = () => {
    if (!extractedReceipt) return;
    const remainderUsd = Math.max(
      0,
      roundToTwoDecimals(effectiveTotalUsd - extractedReceipt.equivalentUsd)
    );

    const pmEntry: PaymentSplitEntry = {
      id: `sp-ocr-${Date.now()}`,
      method: 'PAGO_MOVIL_BS',
      amountUsd: extractedReceipt.equivalentUsd,
      amountBs: extractedReceipt.amountBs,
      rateApplied: activeRateBs,
      bank: extractedReceipt.originBank,
      referenceDigits: extractedReceipt.referenceLastDigits,
      receiptVerified: true,
    };

    const nextSplits: PaymentSplitEntry[] =
      remainderUsd > 0.05
        ? [
            pmEntry,
            {
              id: `sp-rem-${Date.now() + 1}`,
              method: 'EFECTIVO_USD',
              amountUsd: remainderUsd,
              cashTenderedUsd: remainderUsd,
              changeUsd: 0,
              changeHandling: 'ENTREGADO_EFECTIVO',
            },
          ]
        : [pmEntry];

    setSplits(nextSplits);
    syncStringsFromSplits(nextSplits);
  };

  const handleSubmitCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (splits.length === 0) {
      setValidationError('Agrega al menos un método de pago o selecciona Dejar Fiado.');
      return;
    }

    for (const s of splits) {
      if (s.method === 'PAGO_MOVIL_BS') {
        const cleanRef = (s.referenceDigits || '').trim();
        if (cleanRef.length < 4) {
          setValidationError(
            'Ingresa los últimos 4 o 6 dígitos de la referencia del Pago Móvil.'
          );
          return;
        }
      }
    }

    const finalSplits = [...splits];
    if (summary.remainingUnassignedUsd > 0.05) {
      finalSplits.push({
        id: `sp-auto-fiado-${Date.now()}`,
        method: 'FIADO_PENDIENTE',
        amountUsd: summary.remainingUnassignedUsd,
      });
    }

    onConfirmCheckout(
      appointment.id,
      finalSplits,
      includePreviousDebt ? previousDebtUsd : 0
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#13151A] border border-[#222631] rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-[#222631] flex items-center justify-between bg-[#090A0D]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="checkout-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#F9FAFB]"
              >
                Caja Multimoneda · Cerrar Turno
              </h2>
              <span className="font-mono text-xs font-bold text-[#F59E0B] bg-[#1A1D24] border border-[#222631] rounded-lg px-2 py-0.5">
                Tasa: {activeRateBs.toFixed(2)} Bs/USD
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Cliente: <strong className="text-[#F9FAFB]">{appointment.clientName}</strong> ·{' '}
              {appointment.serviceName} ({appointment.time})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de cobro"
            className="p-2 text-[#9CA3AF] hover:text-[#F9FAFB] border border-[#222631] rounded-xl bg-[#1A1D24] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form
          onSubmit={handleSubmitCheckout}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5"
        >
          {/* Total Summary Strip + Solvency Progress Bar */}
          <div className="bg-[#1A1D24] border border-[#222631] rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-[#9CA3AF]">Total a Cobrar (USD)</div>
                <div className="font-mono text-2xl font-extrabold text-[#F9FAFB] mt-0.5">
                  {formatUsd(effectiveTotalUsd)}
                </div>
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                  Servicio base: {formatUsd(appointment.priceUsd)}
                </div>
              </div>

              <div>
                <div className="text-xs text-[#9CA3AF]">Equivalente Exacto en Bolívares</div>
                <div
                  data-testid="checkout-total-bs"
                  className="font-mono text-2xl font-extrabold text-[#F59E0B] mt-0.5"
                >
                  {formatBs(totalBsEquiv)}
                </div>
                <div className="font-mono text-[11px] text-[#9CA3AF] mt-0.5">
                  Calculado a 1 USD = {activeRateBs.toFixed(2)} Bs
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div className="text-xs text-[#9CA3AF]">Estado de Validación</div>
                <div className="font-mono text-sm font-bold mt-1">
                  {summary.remainingUnassignedUsd <= 0.01 && summary.fiadoUsd <= 0.01 ? (
                    <span className="text-[#10B981]">
                      Cubierto 100% ({formatUsd(summary.coveredUsd)})
                    </span>
                  ) : (
                    <span className="text-[#F59E0B]">
                      Cubierto: {formatUsd(summary.coveredUsd)} · Resta/Fiado:{' '}
                      {formatUsd(summary.fiadoUsd)}
                    </span>
                  )}
                </div>
                {summary.newClientBalanceDeltaUsd > 0.01 && (
                  <div className="font-mono text-xs text-[#10B981] mt-1">
                    +{formatUsd(summary.newClientBalanceDeltaUsd)} pasa a Saldo a Favor
                  </div>
                )}
              </div>
            </div>

            {/* Solvency Validation Progress Bar */}
            <div className="pt-2 border-t border-[#222631]">
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-[#9CA3AF]">Barra de cobertura del cobro</span>
                <span
                  className={
                    summary.remainingUnassignedUsd <= 0.01
                      ? 'text-[#10B981] font-bold'
                      : 'text-[#F59E0B] font-bold'
                  }
                >
                  {summary.remainingUnassignedUsd <= 0.01
                    ? '100% Solvente / Asignado'
                    : `Faltan por asignar: ${formatUsd(summary.remainingUnassignedUsd)} (${formatBs(usdToBs(summary.remainingUnassignedUsd, activeRateBs))})`}
                </span>
              </div>
              <div className="w-full h-2 bg-[#090A0D] rounded-full overflow-hidden border border-[#222631]">
                <div
                  className={`h-full transition-all ${
                    summary.remainingUnassignedUsd <= 0.01
                      ? 'bg-[#10B981]'
                      : 'bg-[#F59E0B]'
                  }`}
                  style={{ width: `${coverageRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Client Solvency Alert: Previous Debt or Existing Credit */}
          {(previousDebtUsd > 0 || availableCreditUsd > 0) && (
            <div className="p-3.5 bg-[#1A1D24] border border-[#222631] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {previousDebtUsd > 0 && (
                <>
                  <div className="text-xs">
                    <span className="font-mono font-bold text-[#EF4444]">
                      Deuda anterior registrada: {formatUsd(previousDebtUsd)} (
                      {formatBs(usdToBs(previousDebtUsd, activeRateBs))})
                    </span>
                    <span className="text-[#9CA3AF] ml-2">
                      {client?.balanceNote || 'De corte previo'}
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F9FAFB] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePreviousDebt}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIncludePreviousDebt(checked);
                        const nextTotal = roundToTwoDecimals(
                          appointment.priceUsd + (checked ? previousDebtUsd : 0)
                        );
                        if (splits.length === 1) {
                          const nextSplits = [
                            {
                              ...splits[0],
                              amountUsd: nextTotal,
                              amountBs:
                                splits[0].method === 'PAGO_MOVIL_BS' ||
                                splits[0].method === 'PUNTO_EFECTIVO_BS'
                                  ? usdToBs(nextTotal, activeRateBs)
                                  : undefined,
                            },
                          ];
                          setSplits(nextSplits);
                          syncStringsFromSplits(nextSplits);
                        }
                      }}
                      className="accent-[#F59E0B]"
                    />
                    <span>Sumar deuda anterior a esta cuenta (+{formatUsd(previousDebtUsd)})</span>
                  </label>
                </>
              )}

              {availableCreditUsd > 0 && (
                <>
                  <div className="text-xs">
                    <span className="font-mono font-bold text-[#10B981]">
                      Este cliente tiene Saldo a Favor: +{formatUsd(availableCreditUsd)}
                    </span>
                    <span className="text-[#9CA3AF] ml-2">
                      ({client?.balanceNote || 'Vuelto guardado'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyClientCredit}
                    className="px-3.5 py-1.5 bg-[#F59E0B] text-[#090A0D] rounded-xl text-xs font-extrabold cursor-pointer whitespace-nowrap"
                  >
                    Descontar {formatUsd(Math.min(availableCreditUsd, effectiveTotalUsd))} de su Saldo a Favor
                  </button>
                </>
              )}
            </div>
          )}

          {/* 1-Click Fast Presets (3-Tap Rule) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#9CA3AF]">
                Liquidación Rápida (1 Toque) o Pago Mixto (Split Payment):
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => applyQuickSinglePayment('PAGO_MOVIL_BS')}
                className="px-3 py-2.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Pagar todo en Bs</span>
              </button>
              <button
                type="button"
                onClick={() => applyQuickSinglePayment('EFECTIVO_USD')}
                className="px-3 py-2.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5 text-[#10B981]" />
                <span>100% Efectivo $</span>
              </button>
              <button
                type="button"
                onClick={() => applyQuickSinglePayment('DIGITAL_USD')}
                className="px-3 py-2.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>100% Zinli/USDT</span>
              </button>
              <button
                type="button"
                onClick={() => applyQuickSinglePayment('PUNTO_EFECTIVO_BS')}
                className="px-3 py-2.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#10B981]" />
                <span>100% Punto Bs</span>
              </button>
              <button
                type="button"
                onClick={() => applyQuickSinglePayment('FIADO_PENDIENTE')}
                className="px-3 py-2.5 bg-[#7F1D1D40] hover:bg-[#7F1D1D60] border border-[#DC262650] rounded-xl text-xs font-bold text-[#EF4444] flex items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dejar Fiado</span>
              </button>
            </div>
          </div>

          {/* Split Payment Lines */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#F9FAFB]">
                Desglose de Bolsillos Recibidos ({splits.length})
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddSplitLine('EFECTIVO_USD')}
                  className="px-3 py-1.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#F9FAFB] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Dividir con Efectivo $</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSplitLine('PAGO_MOVIL_BS')}
                  className="px-3 py-1.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#F9FAFB] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Dividir con Pago Móvil</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSplitLine('FIADO_PENDIENTE')}
                  className="px-3 py-1.5 bg-[#7F1D1D40] hover:bg-[#7F1D1D60] border border-[#DC262650] rounded-xl text-xs font-semibold text-[#EF4444] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pasar Resto a Fiado</span>
                </button>
              </div>
            </div>

            {splits.map((split, index) => {
              const isBsMethod =
                split.method === 'PAGO_MOVIL_BS' ||
                split.method === 'PUNTO_EFECTIVO_BS';
              const calculatedBs =
                split.amountBs ?? usdToBs(split.amountUsd, activeRateBs);

              const strState = splitStrings[split.id] || {
                usdStr: String(split.amountUsd),
                bsStr: String(calculatedBs),
                tenderedStr: String(split.cashTenderedUsd ?? split.amountUsd),
              };

              return (
                <div
                  key={split.id}
                  className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Method Selector */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#F59E0B]">
                        #{index + 1}
                      </span>
                      <select
                        aria-label={`Método de pago línea ${index + 1}`}
                        value={split.method}
                        onChange={(e) =>
                          handleUpdateSplit(split.id, {
                            method: e.target.value as PaymentMethodType,
                          })
                        }
                        className="bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs font-bold text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
                      >
                        <option value="PAGO_MOVIL_BS">Pago Móvil (Bs)</option>
                        <option value="EFECTIVO_USD">Efectivo USD ($)</option>
                        <option value="DIGITAL_USD">
                          Zinli / Binance USDT / Zelle ($)
                        </option>
                        <option value="PUNTO_EFECTIVO_BS">
                          Punto de Venta / Efectivo Bs
                        </option>
                        <option value="SALDO_A_FAVOR_APLICADO">
                          Usar Saldo a Favor del Cliente
                        </option>
                        <option value="FIADO_PENDIENTE">
                          Dejar Fiado / Cuenta por Cobrar
                        </option>
                      </select>

                      {split.receiptVerified && (
                        <span className="text-[11px] font-mono text-[#10B981] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Captura Verificada
                        </span>
                      )}
                    </div>

                    {/* Decoupled Decimal Inputs: USD $ and Bs */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        <label
                          htmlFor={`split-usd-${split.id}`}
                          className="text-[11px] text-[#9CA3AF] mr-1.5"
                        >
                          Monto USD $:
                        </label>
                        <input
                          id={`split-usd-${split.id}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={strState.usdStr}
                          onChange={(e) =>
                            handleUsdInputChange(split.id, e.target.value)
                          }
                          className="w-24 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#F9FAFB] focus:border-[#F59E0B] focus:outline-none"
                        />
                      </div>

                      {isBsMethod && (
                        <div>
                          <label
                            htmlFor={`split-bs-${split.id}`}
                            className="text-[11px] text-[#9CA3AF] mr-1.5"
                          >
                            Monto Bs:
                          </label>
                          <input
                            id={`split-bs-${split.id}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={strState.bsStr}
                            onChange={(e) =>
                              handleBsInputChange(split.id, e.target.value)
                            }
                            className="w-28 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                          />
                        </div>
                      )}

                      {splits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplit(split.id)}
                          aria-label={`Eliminar línea de pago ${index + 1}`}
                          className="p-2 text-[#9CA3AF] hover:text-[#EF4444] border border-[#222631] rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Method-Specific Controls: Pago Móvil / Punto */}
                  {(split.method === 'PAGO_MOVIL_BS' ||
                    split.method === 'PUNTO_EFECTIVO_BS') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#222631]">
                      <div>
                        <label
                          htmlFor={`bank-${split.id}`}
                          className="block text-[11px] text-[#9CA3AF] mb-1"
                        >
                          Banco Nacional Origen / Destino
                        </label>
                        <select
                          id={`bank-${split.id}`}
                          value={split.bank || 'Banesco (0134)'}
                          onChange={(e) =>
                            handleUpdateSplit(split.id, {
                              bank: e.target.value as VenezuelanBank,
                            })
                          }
                          className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
                        >
                          {VENEZUELAN_BANKS.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`ref-${split.id}`}
                          className="block text-[11px] text-[#9CA3AF] mb-1"
                        >
                          Últimos 4 o 6 dígitos de Referencia
                        </label>
                        <input
                          id={`ref-${split.id}`}
                          type="text"
                          maxLength={6}
                          value={split.referenceDigits || ''}
                          onChange={(e) =>
                            handleUpdateSplit(split.id, {
                              referenceDigits: e.target.value.replace(/\D/g, ''),
                            })
                          }
                          placeholder="Ej. 8492"
                          className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs font-mono text-[#F9FAFB] placeholder:text-[#9CA3AF] focus:border-[#F59E0B] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Efectivo USD with Decimal Input & 1-Tap Vuelto Calculator */}
                  {split.method === 'EFECTIVO_USD' && (
                    <div className="pt-3 border-t border-[#222631] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`tendered-${split.id}`}
                            className="text-xs text-[#9CA3AF]"
                          >
                            Recibido en billetes ($):
                          </label>
                          <input
                            id={`tendered-${split.id}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={strState.tenderedStr}
                            onChange={(e) =>
                              handleTenderedInputChange(split.id, e.target.value)
                            }
                            className="w-24 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#10B981] focus:border-[#F59E0B] focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {[split.amountUsd, 10, 20, 50]
                            .filter((v, i, arr) => v >= split.amountUsd && arr.indexOf(v) === i)
                            .map((bill) => (
                              <button
                                key={bill}
                                type="button"
                                onClick={() =>
                                  handleUpdateSplit(split.id, {
                                    cashTenderedUsd: bill,
                                  })
                                }
                                className={`px-2.5 py-1 text-xs font-mono rounded-xl border cursor-pointer ${
                                  (split.cashTenderedUsd ?? split.amountUsd) === bill
                                    ? 'bg-[#F59E0B] text-[#090A0D] border-[#F59E0B] font-bold'
                                    : 'bg-[#090A0D] text-[#9CA3AF] border-[#222631] hover:text-[#F9FAFB]'
                                }`}
                              >
                                {bill === split.amountUsd
                                  ? `Exacto ($${bill})`
                                  : `Billete $${bill}`}
                              </button>
                            ))}
                        </div>
                      </div>

                      {split.changeUsd !== undefined && split.changeUsd > 0 && (
                        <div className="p-3 bg-[#090A0D] border border-[#222631] rounded-2xl flex flex-col gap-2.5">
                          <div className="text-xs flex items-center justify-between">
                            <span className="text-[#9CA3AF]">Calculadora de Vuelto:</span>
                            <span className="font-mono font-bold text-[#F59E0B]">
                              Vuelto: {formatUsd(split.changeUsd)} (
                              {formatBs(usdToBs(split.changeUsd, activeRateBs))})
                            </span>
                          </div>

                          {/* 1-Tap Vuelto Option Buttons */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSplit(split.id, {
                                  changeHandling: 'ENTREGADO_EFECTIVO',
                                })
                              }
                              className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                split.changeHandling === 'ENTREGADO_EFECTIVO'
                                  ? 'bg-[#064E3B40] border-[#05966950] text-[#10B981]'
                                  : 'bg-[#13151A] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB]'
                              }`}
                            >
                              Entregar {formatUsd(split.changeUsd)} de vuelto
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSplit(split.id, {
                                  changeHandling: 'ABONAR_SALDO_FAVOR',
                                })
                              }
                              className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                split.changeHandling === 'ABONAR_SALDO_FAVOR'
                                  ? 'bg-[#78350F40] border-[#D9770650] text-[#F59E0B]'
                                  : 'bg-[#13151A] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB]'
                              }`}
                            >
                              Guardar {formatUsd(split.changeUsd)} como Saldo a Favor
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSplit(split.id, {
                                  changeHandling: 'ENTREGADO_PAGO_MOVIL',
                                })
                              }
                              className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                split.changeHandling === 'ENTREGADO_PAGO_MOVIL'
                                  ? 'bg-[#064E3B40] border-[#05966950] text-[#10B981]'
                                  : 'bg-[#13151A] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB]'
                              }`}
                            >
                              Vuelto por Pago Móvil ({formatBs(usdToBs(split.changeUsd, activeRateBs))})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Digital Wallet: Zinli / Binance USDT / Zelle */}
                  {split.method === 'DIGITAL_USD' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#222631]">
                      <div>
                        <label
                          htmlFor={`wallet-${split.id}`}
                          className="block text-[11px] text-[#9CA3AF] mb-1"
                        >
                          Billetera Digital
                        </label>
                        <select
                          id={`wallet-${split.id}`}
                          value={split.digitalProvider || 'Binance USDT'}
                          onChange={(e) =>
                            handleUpdateSplit(split.id, {
                              digitalProvider: e.target
                                .value as DigitalWalletProvider,
                            })
                          }
                          className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none"
                        >
                          <option value="Binance USDT">Binance Pay (USDT)</option>
                          <option value="Zinli">Zinli ($)</option>
                          <option value="Zelle">Zelle ($)</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`wallet-id-${split.id}`}
                          className="block text-[11px] text-[#9CA3AF] mb-1"
                        >
                          Correo / Usuario o Código de Transacción
                        </label>
                        <input
                          id={`wallet-id-${split.id}`}
                          type="text"
                          value={split.accountIdentifier || ''}
                          onChange={(e) =>
                            handleUpdateSplit(split.id, {
                              accountIdentifier: e.target.value,
                            })
                          }
                          placeholder="cliente@correo.com o #Orden"
                          className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs font-mono text-[#F9FAFB] placeholder:text-[#9CA3AF] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 5. Verificador Inteligente de Capturas (Comprobantes OCR) */}
          <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#F9FAFB] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#F59E0B]" />
                  <span>
                    Verificador Inteligente de Capturas (Pago Móvil / Zinli / Binance)
                  </span>
                </h3>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  Extrae Banco Origen, Fecha, Referencia (4 dígitos) y valida si el monto en Bs
                  coincide con {formatUsd(effectiveTotalUsd)} a tasa {activeRateBs.toFixed(2)}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <label className="px-3 py-1.5 bg-[#090A0D] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#F9FAFB] inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Subir Captura</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleSimulateReceipt('EXACT_BANESCO')}
                  className="px-3 py-1.5 bg-[#064E3B40] hover:bg-[#064E3B60] border border-[#05966950] rounded-xl text-xs font-bold text-[#10B981] cursor-pointer"
                >
                  Simular Captura Exacta ({formatBs(totalBsEquiv)})
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateReceipt('PARTIAL_MERCANTIL')}
                  className="px-3 py-1.5 bg-[#78350F40] hover:bg-[#78350F60] border border-[#D9770650] rounded-xl text-xs font-bold text-[#F59E0B] cursor-pointer"
                >
                  Simular Captura Parcial
                </button>
              </div>
            </div>

            {isAnalyzingReceipt && (
              <div className="p-3 bg-[#090A0D] border border-[#222631] rounded-xl text-xs font-mono text-[#9CA3AF]">
                Procesando OCR de comprobante bancario venezolano...
              </div>
            )}

            {extractedReceipt && !isAnalyzingReceipt && (
              <div
                data-testid="ocr-receipt-result"
                className="p-3.5 bg-[#090A0D] border border-[#222631] rounded-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222631] pb-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <FileCheck2 className="w-4 h-4 text-[#10B981]" />
                    <span className="font-mono text-[#F9FAFB]">
                      {uploadedFileName || 'comprobante.png'}
                    </span>
                    <span className="text-[#9CA3AF]">·</span>
                    <span className="font-mono text-[#9CA3AF]">
                      {extractedReceipt.confidenceLabel}
                    </span>
                  </div>

                  {extractedReceipt.matchesExpectedTotal ? (
                    <span className="font-mono text-xs font-bold text-[#10B981]">
                      COINCIDE EXACTO CON EL TOTAL ({formatUsd(effectiveTotalUsd)})
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-bold text-[#F59E0B]">
                      MONTO PARCIAL: Faltan{' '}
                      {formatBs(Math.abs(extractedReceipt.differenceBs))} (
                      {formatUsd(
                        Math.max(0, effectiveTotalUsd - extractedReceipt.equivalentUsd)
                      )}
                      )
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-[#9CA3AF]">Banco Origen</div>
                    <div className="font-mono font-semibold text-[#F9FAFB] mt-0.5">
                      {extractedReceipt.originBank}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9CA3AF]">Fecha / Hora</div>
                    <div className="font-mono font-semibold text-[#F9FAFB] mt-0.5">
                      {extractedReceipt.date}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9CA3AF]">Referencia (4 dígitos)</div>
                    <div className="font-mono font-bold text-[#F59E0B] mt-0.5">
                      #{extractedReceipt.referenceLastDigits}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9CA3AF]">Monto Extraído</div>
                    <div className="font-mono font-bold text-[#10B981] mt-0.5">
                      {formatBs(extractedReceipt.amountBs)} ({formatUsd(extractedReceipt.equivalentUsd)})
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleApplyExtractedReceiptToSplit}
                    className="px-3.5 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Volcar Comprobante al Registro de Caja</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {validationError && (
            <div
              role="alert"
              className="p-3 bg-[#7F1D1D40] border border-[#DC262650] rounded-xl text-xs text-[#EF4444] font-semibold"
            >
              {validationError}
            </div>
          )}

          {/* Footer CTA */}
          <div className="pt-3 border-t border-[#222631] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-[#9CA3AF]">
              Al confirmar, el turno pasa a <strong className="text-[#F9FAFB]">Finalizado</strong> y
              se actualizan los bolsillos del Cierre Diario.
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>
                  Confirmar Cobro ({formatUsd(effectiveTotalUsd)} / {formatBs(totalBsEquiv)})
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
