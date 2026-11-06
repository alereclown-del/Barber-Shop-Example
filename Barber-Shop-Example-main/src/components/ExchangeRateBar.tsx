import React, { useState, useEffect } from 'react';
import {
  Calculator,
  RefreshCw,
  Edit3,
  Check,
  Scissors,
  ChevronDown,
  X,
  Globe2,
  DollarSign,
  Euro,
  Radio,
} from 'lucide-react';
import { ExchangeRates, RateMode } from '../types';
import {
  formatBs,
  formatUsd,
  getActiveRate,
  usdToBs,
  bsToUsd,
  parseDecimalSafe,
  sanitizeDecimalInput,
  roundToTwoDecimals,
} from '../utils/finance';

interface ExchangeRateBarProps {
  rates: ExchangeRates;
  onSelectMode: (mode: RateMode) => void;
  onUpdateRateValue: (mode: RateMode, newValue: number) => void;
  onToggleCurrency?: (currency: 'USD' | 'EUR') => void;
  onRefreshLiveRates?: () => Promise<void> | void;
  isRefreshingLiveRates?: boolean;
  activeBarberName?: string;
}

export const ExchangeRateBar: React.FC<ExchangeRateBarProps> = ({
  rates,
  onSelectMode,
  onUpdateRateValue,
  onToggleCurrency,
  onRefreshLiveRates,
  isRefreshingLiveRates = false,
  activeBarberName = 'Navas · Silla 1',
}) => {
  const activeRate = getActiveRate(rates);

  // Popover / Sheet states
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

  // Manual rate draft state
  const [rateDraftStr, setRateDraftStr] = useState<string>(
    (rates.PERSONALIZADA || activeRate).toFixed(2)
  );

  // Calculator state
  const [calcInputStr, setCalcInputStr] = useState<string>('12');
  const [calcDirection, setCalcDirection] = useState<'USD_TO_BS' | 'BS_TO_USD'>('USD_TO_BS');

  useEffect(() => {
    setRateDraftStr((rates.PERSONALIZADA || activeRate).toFixed(2));
  }, [rates.PERSONALIZADA, activeRate]);

  const handleRateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeDecimalInput(e.target.value);
    if (cleaned !== null) {
      setRateDraftStr(cleaned);
    }
  };

  const handleCalcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeDecimalInput(e.target.value);
    if (cleaned !== null) {
      setCalcInputStr(cleaned);
    }
  };

  const handleSaveCustomRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseDecimalSafe(rateDraftStr);
    if (parsed > 0) {
      onUpdateRateValue('PERSONALIZADA', roundToTwoDecimals(parsed));
      onSelectMode('PERSONALIZADA');
      setIsRateModalOpen(false);
    }
  };

  const numericCalcInput = parseDecimalSafe(calcInputStr);
  const convertedResult =
    calcDirection === 'USD_TO_BS'
      ? formatBs(usdToBs(numericCalcInput, activeRate))
      : formatUsd(bsToUsd(numericCalcInput, activeRate));

  const activeCurrency = rates.officialCurrency || 'USD';

  // Label for active rate badge in 40-44px header
  const getBadgeLabel = () => {
    if (rates.activeMode === 'EUR_BCV' || (rates.activeMode === 'BCV' && activeCurrency === 'EUR')) {
      return `BCV EUR: ${activeRate.toFixed(2)} Bs`;
    }
    if (rates.activeMode === 'BCV') {
      return `BCV: ${activeRate.toFixed(2)} Bs`;
    }
    if (rates.activeMode === 'PARALELO') {
      return `PAR: ${activeRate.toFixed(2)} Bs`;
    }
    return `MANUAL: ${activeRate.toFixed(2)} Bs`;
  };

  return (
    <>
      {/* 1. ULTRA-COMPACT HEADER (Max 44px - Modo Estación) */}
      <header className="h-11 bg-[#141618] border-b border-[#23262B] px-3 sm:px-5 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left: Brand "BARBER SHOP" + Seat Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-[#D4AF37] text-[#0C0D0E] flex items-center justify-center font-extrabold text-xs shadow-sm">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-extrabold tracking-tight text-[#F4F4F5] uppercase">
              BARBER SHOP
            </span>
          </div>

          <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 bg-[#1C1E22] border border-[#23262B] rounded-md text-[11px] text-[#8E95A2]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate max-w-[120px]">{activeBarberName}</span>
          </div>
        </div>

        {/* Right: Quick Calculator Trigger + Interactive Rate Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Calculator Icon Button */}
          <button
            type="button"
            onClick={() => setIsCalcModalOpen(true)}
            aria-label="Abrir calculadora rápida de conversión"
            title="Calculadora rápida de divisas"
            className="h-8 px-2.5 bg-[#1C1E22] hover:bg-[#24272D] active:scale-95 border border-[#23262B] rounded-md text-[#8E95A2] hover:text-[#F4F4F5] inline-flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden md:inline text-[11px]">Calculadora</span>
          </button>

          {/* Rate Badge (Pill interactivo desplegable) */}
          <button
            type="button"
            onClick={() => setIsRateModalOpen(true)}
            aria-label="Configurar o cambiar tasa de cambio activa"
            className="h-8 px-2.5 bg-[#1C1E22] hover:bg-[#24272D] active:scale-95 border border-[#2D313A] rounded-md inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs font-bold text-[#F4F4F5] tracking-tight">
              {getBadgeLabel()}
            </span>
            <ChevronDown className="w-3 h-3 text-[#8E95A2]" />
          </button>
        </div>
      </header>

      {/* 2. POPOVER / BOTTOM SHEET: SELECTOR DE TASA Y DIVISAS */}
      {isRateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Selector de tasas de cambio"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsRateModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#141618] border-t sm:border border-[#23262B] sm:rounded-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#23262B]">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold tracking-tight text-[#F4F4F5] uppercase">
                  Tasas del Día (BCV & Mercado)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRateModalOpen(false)}
                className="text-[#8E95A2] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Bar with Live API button */}
            <div className="flex items-center justify-between p-2.5 bg-[#1C1E22] border border-[#23262B] rounded-xl text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                <span className="text-[#8E95A2] truncate text-[11px]">
                  {rates.lastUpdated || 'DolarApi VE'}
                </span>
              </div>
              {onRefreshLiveRates && (
                <button
                  type="button"
                  onClick={async () => {
                    await onRefreshLiveRates();
                  }}
                  disabled={isRefreshingLiveRates}
                  className="px-2 py-1 bg-[#24272D] hover:bg-[#2D313A] text-xs font-semibold text-[#F4F4F5] rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingLiveRates ? 'animate-spin text-[#D4AF37]' : ''}`} />
                  <span>{isRefreshingLiveRates ? 'Actualizando...' : 'Recargar'}</span>
                </button>
              )}
            </div>

            {/* Quick Currency Toggle (USD vs EUR) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8E95A2] uppercase tracking-wider">
                Moneda Oficial de Referencia
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onToggleCurrency) onToggleCurrency('USD');
                    onSelectMode('BCV');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${rates.activeMode === 'BCV' && activeCurrency === 'USD'
                      ? 'bg-[#1C1E22] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 text-[#F4F4F5]'
                      : 'bg-[#181A1D] border-[#23262B] text-[#8E95A2] hover:text-[#F4F4F5]'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#D4AF37]" />
                    <div>
                      <div className="text-xs font-bold">Dólar BCV</div>
                      <div className="font-mono text-xs text-[#F4F4F5] font-semibold">
                        Bs {rates.BCV.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {rates.activeMode === 'BCV' && activeCurrency === 'USD' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#D4AF37] text-[#0C0D0E] rounded">
                      ACTIVA
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onToggleCurrency) onToggleCurrency('EUR');
                    onSelectMode('EUR_BCV');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${rates.activeMode === 'EUR_BCV' || (rates.activeMode === 'BCV' && activeCurrency === 'EUR')
                      ? 'bg-[#1C1E22] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 text-[#F4F4F5]'
                      : 'bg-[#181A1D] border-[#23262B] text-[#8E95A2] hover:text-[#F4F4F5]'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-[#38BDF8]" />
                    <div>
                      <div className="text-xs font-bold">Euro BCV</div>
                      <div className="font-mono text-xs text-[#F4F4F5] font-semibold">
                        Bs {(rates.EUR_BCV || rates.BCV * 1.08).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {(rates.activeMode === 'EUR_BCV' || (rates.activeMode === 'BCV' && activeCurrency === 'EUR')) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#38BDF8] text-[#0C0D0E] rounded">
                      ACTIVA
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Other Options: Paralelo & Custom */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8E95A2] uppercase tracking-wider">
                Otras Opciones de Tasa
              </label>

              {/* Paralelo */}
              <button
                type="button"
                onClick={() => {
                  onSelectMode('PARALELO');
                }}
                className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${rates.activeMode === 'PARALELO'
                    ? 'bg-[#1C1E22] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 text-[#F4F4F5]'
                    : 'bg-[#181A1D] border-[#23262B] text-[#8E95A2] hover:text-[#F4F4F5]'
                  }`}
              >
                <div>
                  <div className="text-xs font-bold">Dólar Paralelo (Mercado)</div>
                  <div className="font-mono text-xs text-[#F4F4F5] font-semibold">
                    Bs {rates.PARALELO.toFixed(2)}
                  </div>
                </div>
                {rates.activeMode === 'PARALELO' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#D4AF37] text-[#0C0D0E] rounded">
                    ACTIVA
                  </span>
                )}
              </button>

              {/* Manual Rate Form */}
              <form
                onSubmit={handleSaveCustomRate}
                className={`p-3 rounded-xl border space-y-2 transition-all ${rates.activeMode === 'PERSONALIZADA'
                    ? 'bg-[#1C1E22] border-[#D4AF37]'
                    : 'bg-[#181A1D] border-[#23262B]'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F4F5]">Tasa Manual / Propia</span>
                  {rates.activeMode === 'PERSONALIZADA' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#D4AF37] text-[#0C0D0E] rounded">
                      ACTIVA
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#8E95A2]">
                      Bs:
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={rateDraftStr}
                      onChange={handleRateInputChange}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#0C0D0E] border border-[#23262B] rounded-lg text-xs font-mono font-bold text-[#F4F4F5] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-8 px-3 bg-[#D4AF37] hover:bg-[#E2BF4C] text-[#0C0D0E] rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Fijar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. QUICK CALCULATOR MODAL / DRAWER */}
      {isCalcModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Calculadora rápida de divisas"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsCalcModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-[#141618] border-t sm:border border-[#23262B] sm:rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#23262B]">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-[#F4F4F5] uppercase tracking-tight">
                  Calculadora Rápida
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(false)}
                className="text-[#8E95A2] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-[#8E95A2] flex items-center justify-between">
              <span>Tasa Activa:</span>
              <span className="font-mono font-bold text-[#D4AF37]">{activeRate.toFixed(2)} Bs/$</span>
            </div>

            {/* Input & Output Box */}
            <div className="bg-[#181A1D] border border-[#23262B] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#8E95A2]">
                  {calcDirection === 'USD_TO_BS' ? 'Monto USD ($):' : 'Monto Bolívares (Bs):'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCalcDirection((prev) =>
                      prev === 'USD_TO_BS' ? 'BS_TO_USD' : 'USD_TO_BS'
                    )
                  }
                  className="px-2 py-1 bg-[#24272D] hover:bg-[#2D313A] text-[11px] font-medium text-[#F4F4F5] rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-[#D4AF37]" />
                  <span>Invertir</span>
                </button>
              </div>

              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={calcInputStr}
                onChange={handleCalcInputChange}
                autoFocus
                className="w-full bg-[#0C0D0E] border border-[#23262B] rounded-lg px-3 py-2 text-base font-mono font-bold text-[#F4F4F5] focus:outline-none focus:border-[#D4AF37]"
              />

              <div className="pt-2 border-t border-[#23262B] flex items-center justify-between">
                <span className="text-xs text-[#8E95A2]">Total Equivalente:</span>
                <span className="font-mono text-base font-extrabold text-[#22C55E]">
                  {convertedResult}
                </span>
              </div>
            </div>

            {/* Fast Preset Buttons ($10, $12, $16, $20) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E95A2]">
                Atajos de Servicios
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[10, 12, 16, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCalcDirection('USD_TO_BS');
                      setCalcInputStr(String(preset));
                    }}
                    className={`py-2 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${calcDirection === 'USD_TO_BS' && parseDecimalSafe(calcInputStr) === preset
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0C0D0E]'
                        : 'border-[#23262B] bg-[#1C1E22] text-[#8E95A2] hover:text-[#F4F4F5]'
                      }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
