import React, { useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  Copy,
  Smartphone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { AppointmentItem, ClientProfile } from '../types';
import {
  calculateCashCloseout,
  formatBs,
  formatUsd,
  usdToBs,
} from '../utils/finance';

interface CashCloseoutSectionProps {
  appointments: AppointmentItem[];
  clients: ClientProfile[];
  activeRateBs: number;
  onNavigateToDebtors?: () => void;
}

export const CashCloseoutSection: React.FC<CashCloseoutSectionProps> = ({
  appointments,
  clients,
  activeRateBs,
  onNavigateToDebtors,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const closeout = calculateCashCloseout(appointments, clients, activeRateBs);

  // Collect all today's verified bank references for quick audit
  const todayReferences: {
    clientName: string;
    methodLabel: string;
    amountDisplay: string;
    refLabel: string;
  }[] = [];

  for (const apt of appointments.filter((a) => a.dateKey === 'HOY')) {
    if (!apt.splits) continue;
    for (const s of apt.splits) {
      if (s.method === 'PAGO_MOVIL_BS') {
        todayReferences.push({
          clientName: apt.clientName,
          methodLabel: s.bank || 'Pago Móvil',
          amountDisplay: `${formatBs(s.amountBs ?? usdToBs(s.amountUsd, activeRateBs))} (${formatUsd(s.amountUsd)})`,
          refLabel: `Ref #${s.referenceDigits || '----'}`,
        });
      } else if (s.method === 'DIGITAL_USD') {
        todayReferences.push({
          clientName: apt.clientName,
          methodLabel: s.digitalProvider || 'Binance/Zinli',
          amountDisplay: formatUsd(s.amountUsd),
          refLabel: s.accountIdentifier || 'Verificado',
        });
      }
    }
  }

  const handleCopyCloseoutReport = () => {
    const reportText = [
      `BARBER SHOP — CIERRE DE CAJA DIARIO`,
      `Tasa aplicada: 1 USD = ${activeRateBs.toFixed(2)} Bs`,
      `Cortes completados hoy: ${closeout.completedCutsCount}`,
      `Total Producido: ${formatUsd(closeout.totalProducedUsd)} (${formatBs(closeout.totalProducedBsEquiv)})`,
      `----------------------------------------`,
      `• Pago Móvil Bs: ${formatBs(closeout.pagoMovilBs)} (equiv. ${formatUsd(closeout.pagoMovilUsdEquiv)})`,
      `• Efectivo USD en Gaveta: ${formatUsd(closeout.efectivoUsdDrawer)}`,
      `• Zinli / Binance / Zelle: ${formatUsd(closeout.digitalUsdTotal)}`,
      `• Punto / Efectivo Bs: ${formatBs(closeout.puntoEfectivoBs)}`,
      `• Por cobrar en la calle (Deudores): ${formatUsd(closeout.totalStreetReceivablesUsd)}`,
      `• Saldo a favor de clientes (Vueltos): ${formatUsd(closeout.totalClientCreditsUsd)}`,
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(reportText).catch(() => { });
    }
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <section
      aria-label="Cierre de caja diario y desglose por bolsillos"
      className="bg-[#13151A] border border-[#222631] rounded-3xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-[#222631] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg lg:text-xl font-extrabold text-[#F9FAFB] tracking-tight">
              Cierre de Caja Diario (Bolsillos)
            </h2>
            <span className="text-xs font-mono text-[#9CA3AF]">
              · {closeout.completedCutsCount} servicios cerrados hoy
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Arqueo exacto entre Pago Móvil Bs, billetes físicos en gaveta, billeteras digitales y
            cuentas en la calle.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyCloseoutReport}
          className="px-4 py-2 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] inline-flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          {copiedSummary ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[#10B981]">Resumen Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Copiar Cierre Diario</span>
            </>
          )}
        </button>
      </div>

      {/* Main Financial Grid */}
      <div className="p-4 lg:p-5 space-y-4">
        {/* Top Hero Total Produced */}
        <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Total Producido Hoy (USD Equivalentes)</span>
            </div>
            <div
              data-testid="closeout-total-usd"
              className="font-mono text-2xl lg:text-3xl font-extrabold text-[#F9FAFB] mt-1"
            >
              {formatUsd(closeout.totalProducedUsd)}
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#222631]">
            <div className="text-xs text-[#9CA3AF]">Equivalente Total a Tasa Activa</div>
            <div className="font-mono text-xl font-extrabold text-[#F59E0B] mt-0.5">
              {formatBs(closeout.totalProducedBsEquiv)}
            </div>
            <div className="font-mono text-[11px] text-[#9CA3AF]">
              Tasa de cálculo: {activeRateBs.toFixed(2)} Bs/USD
            </div>
          </div>
        </div>

        {/* 4 Pocket Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pocket 1: Pago Móvil Bs */}
          <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Pago Móvil (Bs)</span>
              <Smartphone className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div
              data-testid="pocket-pagomovil-bs"
              className="font-mono text-lg font-extrabold text-[#F9FAFB] mt-1.5"
            >
              {formatBs(closeout.pagoMovilBs)}
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-0.5">
              Equiv: {formatUsd(closeout.pagoMovilUsdEquiv)}
              {closeout.puntoEfectivoBs > 0 &&
                ` · +Punto: ${formatBs(closeout.puntoEfectivoBs)}`}
            </div>
          </div>

          {/* Pocket 2: Efectivo USD en Gaveta */}
          <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Billetes USD en Gaveta</span>
              <Banknote className="w-4 h-4 text-[#10B981]" />
            </div>
            <div
              data-testid="pocket-cash-usd"
              className="font-mono text-lg font-extrabold text-[#10B981] mt-1.5"
            >
              {formatUsd(closeout.efectivoUsdDrawer)}
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-0.5">
              Equiv: {formatBs(usdToBs(closeout.efectivoUsdDrawer, activeRateBs))}
            </div>
          </div>

          {/* Pocket 3: Zinli / Binance USDT / Zelle */}
          <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Zinli / Binance USDT / Zelle</span>
              <Wallet className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div
              data-testid="pocket-digital-usd"
              className="font-mono text-lg font-extrabold text-[#F9FAFB] mt-1.5"
            >
              {formatUsd(closeout.digitalUsdTotal)}
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-0.5">
              Transferencias digitales verificadas
            </div>
          </div>

          {/* Pocket 4: Por Cobrar en la Calle (Deudores) & Vueltos a Favor */}
          <div className="p-4 bg-[#1A1D24] border border-[#222631] rounded-2xl">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Por Cobrar en la Calle</span>
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            </div>
            <div
              data-testid="pocket-receivables-usd"
              className="font-mono text-lg font-extrabold text-[#EF4444] mt-1.5"
            >
              {formatUsd(closeout.totalStreetReceivablesUsd)}
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-[#9CA3AF] mt-0.5">
              <span>Saldos a favor clientes: +{formatUsd(closeout.totalClientCreditsUsd)}</span>
              {onNavigateToDebtors && closeout.totalStreetReceivablesUsd > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToDebtors}
                  className="text-[#F59E0B] font-bold hover:underline cursor-pointer"
                >
                  Ver deudores
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Today's Electronic References Log */}
        <div className="pt-2 border-t border-[#222631]">
          <h3 className="text-xs font-bold text-[#9CA3AF] mb-2">
            Auditoría de Referencias Electrónicas de Hoy ({todayReferences.length})
          </h3>
          {todayReferences.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">
              Aún no se han registrado pagos electrónicos en la jornada de hoy.
            </p>
          ) : (
            <div className="space-y-2">
              {todayReferences.map((ref, idx) => (
                <div
                  key={`${ref.refLabel}-${idx}`}
                  className="px-3.5 py-2.5 bg-[#1A1D24] border border-[#222631] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-bold text-[#F9FAFB]">{ref.clientName}</span>
                    <span className="text-[#9CA3AF] mx-1.5">·</span>
                    <span className="text-[#9CA3AF]">{ref.methodLabel}</span>
                  </div>
                  <div className="font-mono flex items-center gap-2 shrink-0">
                    <span className="text-[#F59E0B] font-bold">{ref.refLabel}</span>
                    <span className="text-[#9CA3AF]">·</span>
                    <span className="text-[#10B981] font-extrabold">{ref.amountDisplay}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
