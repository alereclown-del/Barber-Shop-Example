import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Check,
  DollarSign,
  Plus,
  RotateCcw,
  Scissors,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppointmentItem,
  AppointmentStatus,
  ClientProfile,
  ExchangeRates,
  PaymentMethodType,
  PaymentSplitEntry,
  RateMode,
  ServiceCatalogItem,
  ServiceId,
  VenezuelanBank,
} from './types';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS,
  INITIAL_RATES,
  SERVICE_CATALOG,
} from './data/seedData';
import {
  calculateCashCloseout,
  formatBs,
  formatUsd,
  getActiveRate,
  parseDecimalSafe,
  roundToTwoDecimals,
  sanitizeDecimalInput,
  summarizeSplits,
  usdToBs,
} from './utils/finance';
import { fetchLiveExchangeRates } from './utils/bcvService';
import { ExchangeRateBar } from './components/ExchangeRateBar';
import { AgendaSection } from './components/AgendaSection';
import { ClientDirectorySection } from './components/ClientDirectorySection';
import { CashCloseoutSection } from './components/CashCloseoutSection';
import { CheckoutModal } from './components/CheckoutModal';
import { NewAppointmentModal } from './components/NewAppointmentModal';
import { NewClientModal } from './components/NewClientModal';

type ActiveWorkspaceTab = 'AGENDA' | 'CLIENTES' | 'CAJA' | 'AJUSTES';

const STORAGE_KEYS = {
  RATES: 'navas_barber_vzla_rates_v1',
  CLIENTS: 'navas_barber_vzla_clients_v1',
  APPOINTMENTS: 'navas_barber_vzla_appointments_v1',
  CATALOG: 'navas_barber_vzla_catalog_v1',
};

export default function App() {
  const [rates, setRates] = useState<ExchangeRates>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RATES);
      return saved ? JSON.parse(saved) : INITIAL_RATES;
    } catch {
      return INITIAL_RATES;
    }
  });

  const [clients, setClients] = useState<ClientProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
    } catch {
      return INITIAL_CLIENTS;
    }
  });

  const [appointments, setAppointments] = useState<AppointmentItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
    } catch {
      return INITIAL_APPOINTMENTS;
    }
  });

  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATALOG);
      return saved ? JSON.parse(saved) : SERVICE_CATALOG;
    } catch {
      return SERVICE_CATALOG;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('AGENDA');
  const [activeBarberName, setActiveBarberName] = useState<string>('Navas · Silla 1');
  const [selectedClientId, setSelectedClientId] = useState<string | null>('cli-1');
  const [checkoutAppointmentId, setCheckoutAppointmentId] = useState<string | null>(null);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [lastActionBanner, setLastActionBanner] = useState<string | null>(null);
  const [isRefreshingLiveRates, setIsRefreshingLiveRates] = useState(false);

  // Decoupled string states for the Settings tab inputs
  const [settingsRateStrings, setSettingsRateStrings] = useState<Record<RateMode, string>>({
    BCV: String(rates.BCV),
    EUR_BCV: String(rates.EUR_BCV || roundToTwoDecimals(rates.BCV * 1.08)),
    PARALELO: String(rates.PARALELO),
    PERSONALIZADA: String(rates.PERSONALIZADA),
  });

  const [catalogPriceStrings, setCatalogPriceStrings] = useState<Record<ServiceId, string>>(() => {
    const map = {} as Record<ServiceId, string>;
    for (const item of SERVICE_CATALOG) {
      map[item.id] = String(item.priceUsd);
    }
    return map;
  });

  useEffect(() => {
    setSettingsRateStrings({
      BCV: String(rates.BCV),
      EUR_BCV: String(rates.EUR_BCV || roundToTwoDecimals(rates.BCV * 1.08)),
      PARALELO: String(rates.PARALELO),
      PERSONALIZADA: String(rates.PERSONALIZADA),
    });
  }, [rates.BCV, rates.EUR_BCV, rates.PARALELO, rates.PERSONALIZADA]);

  // Consulta automática transparente al iniciar la aplicación (DolarApi Venezuela)
  useEffect(() => {
    handleRefreshLiveRates(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
    } catch { }
  }, [rates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    } catch { }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    } catch { }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(serviceCatalog));
    } catch { }
  }, [serviceCatalog]);

  const activeRateBs = getActiveRate(rates);
  const closeout = calculateCashCloseout(appointments, clients, activeRateBs);

  const showToast = (msg: string) => {
    setLastActionBanner(msg);
    setTimeout(() => {
      setLastActionBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleSelectRateMode = (mode: RateMode) => {
    setRates((prev) => ({
      ...prev,
      activeMode: mode,
    }));
  };

  const handleToggleCurrency = (curr: 'USD' | 'EUR') => {
    setRates((prev) => ({
      ...prev,
      officialCurrency: curr,
      activeMode: curr === 'EUR' ? 'EUR_BCV' : 'BCV',
    }));
    showToast(`Moneda oficial de referencia: ${curr}`);
  };

  const handleRefreshLiveRates = async (silent = false) => {
    setIsRefreshingLiveRates(true);
    try {
      const res = await fetchLiveExchangeRates();
      if (res.source === 'dolarapi') {
        setRates((prev) => {
          const next: ExchangeRates = {
            ...prev,
            lastUpdated: res.lastUpdated,
          };
          if (res.usdOfficial && res.usdOfficial > 0) next.BCV = res.usdOfficial;
          if (res.eurOfficial && res.eurOfficial > 0) next.EUR_BCV = res.eurOfficial;
          if (res.paralelo && res.paralelo > 0) next.PARALELO = res.paralelo;
          return next;
        });
        if (!silent) {
          showToast(`Tasas BCV actualizadas en vivo (USD: ${res.usdOfficial} Bs · EUR: ${res.eurOfficial} Bs)`);
        }
      } else if (!silent) {
        showToast('Modo offline: se mantienen las tasas locales guardadas');
      }
    } catch {
      if (!silent) {
        showToast('Modo offline: se mantienen las tasas locales guardadas');
      }
    } finally {
      setIsRefreshingLiveRates(false);
    }
  };

  const handleUpdateRateValue = (mode: RateMode, newValue: number) => {
    setRates((prev) => ({
      ...prev,
      [mode]: roundToTwoDecimals(newValue),
      activeMode: mode,
      lastUpdated: 'Actualizado ahora',
    }));
    showToast(`Tasa ${mode} fijada en ${newValue.toFixed(2)} Bs`);
  };

  const handleUpdateAppointmentStatus = (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );
  };

  const handleConfirmCheckout = (
    appointmentId: string,
    splits: PaymentSplitEntry[],
    includePreviousDebtUsd: number
  ) => {
    const targetAppt = appointments.find((a) => a.id === appointmentId);
    if (!targetAppt) return;

    const totalExpectedUsd = roundToTwoDecimals(
      targetAppt.priceUsd + includePreviousDebtUsd
    );
    const summary = summarizeSplits(totalExpectedUsd, splits);

    // 1. Update the appointment to COMPLETADO + solvency + splits
    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id !== appointmentId) return apt;
        return {
          ...apt,
          status: 'COMPLETADO',
          solvency: summary.solvencyResult,
          paidUsd: summary.coveredUsd,
          splits,
        };
      })
    );

    // 2. Update the Client's balance and chronological visit history
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== targetAppt.clientId) return c;

        const baseBalance =
          includePreviousDebtUsd > 0 && c.balanceUsd < 0 ? 0 : c.balanceUsd;
        const updatedBalance = roundToTwoDecimals(
          baseBalance + summary.newClientBalanceDeltaUsd
        );

        let updatedBalanceNote = c.balanceNote;
        if (updatedBalance < -0.01) {
          updatedBalanceNote = `Debe ${formatUsd(Math.abs(updatedBalance))} del 05/Nov (${targetAppt.serviceName})`;
        } else if (updatedBalance > 0.01) {
          updatedBalanceNote = `Saldo a favor: +${formatUsd(updatedBalance)} (vuelto guardado el 05/Nov)`;
        } else {
          updatedBalanceNote = undefined;
        }

        const newVisit = {
          id: `vis-${Date.now()}`,
          date: '05 Nov 2026',
          time: targetAppt.time,
          serviceName: targetAppt.serviceName,
          totalUsd: totalExpectedUsd,
          rateBs: activeRateBs,
          splits,
          notes:
            summary.solvencyResult === 'PAGADO'
              ? 'Liquidado en caja multimoneda.'
              : `Quedó pendiente ${formatUsd(summary.fiadoUsd)} en cuenta por cobrar.`,
        };

        return {
          ...c,
          balanceUsd: updatedBalance,
          balanceNote: updatedBalanceNote,
          lastVisitDate: '05 Nov 2026',
          history: [newVisit, ...c.history],
        };
      })
    );

    setCheckoutAppointmentId(null);
    showToast(
      `Turno de ${targetAppt.clientName} cerrado (${summary.solvencyResult} · ${formatUsd(summary.coveredUsd)} cobrados)`
    );
  };

  const handleSettleClientDebt = (
    clientId: string,
    amountUsd: number,
    method: PaymentMethodType,
    bank?: VenezuelanBank,
    referenceDigits?: string
  ) => {
    const splitEntry: PaymentSplitEntry = {
      id: `sp-debt-${Date.now()}`,
      method,
      amountUsd,
      amountBs:
        method === 'PAGO_MOVIL_BS' ? usdToBs(amountUsd, activeRateBs) : undefined,
      rateApplied: activeRateBs,
      bank,
      referenceDigits,
    };

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const nextBalance = roundToTwoDecimals(c.balanceUsd + amountUsd);
        const newVisit = {
          id: `vis-settle-${Date.now()}`,
          date: '05 Nov 2026',
          time: 'Abono Cuenta',
          serviceName: 'Liquidación de Deuda Pendiente',
          totalUsd: amountUsd,
          rateBs: activeRateBs,
          splits: [splitEntry],
          notes:
            Math.abs(nextBalance) <= 0.01
              ? 'Deuda liquidada al 100% y cliente pasa a estado Solvente.'
              : `Abono parcial de ${formatUsd(amountUsd)}. Resta ${formatUsd(Math.abs(nextBalance))}.`,
        };
        return {
          ...c,
          balanceUsd: Math.abs(nextBalance) <= 0.01 ? 0 : nextBalance,
          balanceNote:
            Math.abs(nextBalance) <= 0.01
              ? undefined
              : `Resta ${formatUsd(Math.abs(nextBalance))} tras abono del 05/Nov`,
          lastVisitDate: '05 Nov 2026',
          history: [newVisit, ...c.history],
        };
      })
    );

    const clientObj = clients.find((c) => c.id === clientId);
    if (clientObj) {
      setAppointments((prev) => [
        ...prev,
        {
          id: `apt-debt-${Date.now()}`,
          clientId: clientObj.id,
          clientName: clientObj.name,
          clientPhone: clientObj.phone,
          dateKey: 'HOY',
          dayLabel: 'Jue 05 Nov',
          time: 'Abono',
          barberName: 'Caja',
          serviceId: 'CERQUILLO',
          serviceName: 'Cobro de Cuenta Pendiente',
          priceUsd: amountUsd,
          status: 'COMPLETADO',
          solvency: 'PAGADO',
          paidUsd: amountUsd,
          splits: [splitEntry],
        },
      ]);
      showToast(`Abono de ${clientObj.name} (${formatUsd(amountUsd)}) registrado en caja`);
    }
  };

  const handleUpdateClientNotes = (clientId: string, newNotes: string) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, styleNotes: newNotes.trim() || c.styleNotes } : c
      )
    );
    showToast('Fórmula técnica de corte actualizada');
  };

  const handleCreateAppointment = (newAppt: Omit<AppointmentItem, 'id'>) => {
    const createdId = `apt-${Date.now()}`;
    const fullAppt: AppointmentItem = {
      ...newAppt,
      id: createdId,
    };

    const existsInClients = clients.some((c) => c.id === newAppt.clientId);
    if (!existsInClients) {
      setClients((prev) => [
        {
          id: newAppt.clientId,
          name: newAppt.clientName,
          phone: newAppt.clientPhone,
          frequency: 'Cada 15 días',
          styleNotes: 'Cliente nuevo agendado en recepción.',
          isVip: false,
          balanceUsd: 0,
          lastVisitDate: '05 Nov 2026',
          history: [],
        },
        ...prev,
      ]);
    }

    setAppointments((prev) => [...prev, fullAppt]);
    showToast(`Turno agendado para ${newAppt.clientName} (${newAppt.time})`);
  };

  const handleCreateClient = (
    newClientData: Omit<ClientProfile, 'id' | 'history' | 'lastVisitDate'>
  ) => {
    const newClient: ClientProfile = {
      ...newClientData,
      id: `cli-${Date.now()}`,
      lastVisitDate: 'Sin visitas',
      history: [],
    };
    setClients((prev) => [newClient, ...prev]);
    setSelectedClientId(newClient.id);
    showToast(`Cliente ${newClient.name} registrado en el Libro de Cuentas`);
  };

  const handleOpenExpressCheckout = () => {
    setIsFabMenuOpen(false);
    // Find current turn in chair or first unpaid turn today
    const target =
      appointments.find((a) => a.status === 'EN_SILLA' && a.solvency !== 'PAGADO') ||
      appointments.find((a) => a.dateKey === 'HOY' && a.solvency !== 'PAGADO') ||
      appointments[0];
    if (target) {
      setCheckoutAppointmentId(target.id);
    }
  };

  const handleResetDemoData = () => {
    setRates(INITIAL_RATES);
    setClients(INITIAL_CLIENTS);
    setAppointments(INITIAL_APPOINTMENTS);
    setServiceCatalog(SERVICE_CATALOG);
    localStorage.removeItem(STORAGE_KEYS.RATES);
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    localStorage.removeItem(STORAGE_KEYS.CATALOG);
    showToast('Datos de demostración restaurados');
  };

  const activeCheckoutAppointment = appointments.find(
    (a) => a.id === checkoutAppointmentId
  );
  const activeCheckoutClient = activeCheckoutAppointment
    ? clients.find((c) => c.id === activeCheckoutAppointment.clientId)
    : undefined;

  return (
    <div className="min-h-screen bg-[#0C0D0E] text-[#F4F4F5] flex flex-col pb-24">
      {/* 1. Global Ultra-Compact Header (44px) with Live BCV & Currency Toggle */}
      <ExchangeRateBar
        rates={rates}
        onSelectMode={handleSelectRateMode}
        onUpdateRateValue={handleUpdateRateValue}
        onToggleCurrency={handleToggleCurrency}
        onRefreshLiveRates={() => handleRefreshLiveRates(false)}
        isRefreshingLiveRates={isRefreshingLiveRates}
        activeBarberName={activeBarberName}
      />

      {/* Feedback Banner if an action was just performed */}
      {lastActionBanner && (
        <div
          role="status"
          className="bg-[#062316] border-b border-[#22C55E]/30 px-4 lg:px-8 py-2 text-xs font-mono text-[#22C55E] flex items-center justify-between"
        >
          <span>{lastActionBanner}</span>
          <button
            type="button"
            onClick={() => setLastActionBanner(null)}
            className="text-[#8E95A2] hover:text-[#F4F4F5] cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Workspace Container (Adaptive Desktop Grid + Mobile-First) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-5 space-y-3 sm:space-y-5">
        {/* 4-Column Operational KPI Strip (Optimized for Mobile Station View) */}
        <section
          aria-label="Resumen operativo en tiempo real"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
        >
          <div className="p-2.5 sm:p-4 bg-[#141618] border border-[#23262B] rounded-xl sm:rounded-2xl">
            <div className="text-[11px] sm:text-xs text-[#8E95A2]">Producido Hoy</div>
            <div className="font-mono text-base sm:text-xl font-extrabold text-[#F4F4F5] mt-0.5">
              {formatUsd(closeout.totalProducedUsd)}
            </div>
            <div className="font-mono text-[10px] sm:text-xs text-[#D4AF37] mt-0.5 truncate">
              {formatBs(closeout.totalProducedBsEquiv)} · {closeout.completedCutsCount} cortes
            </div>
          </div>

          <div className="p-2.5 sm:p-4 bg-[#141618] border border-[#23262B] rounded-xl sm:rounded-2xl">
            <div className="text-[11px] sm:text-xs text-[#8E95A2]">Pago Móvil + Punto</div>
            <div className="font-mono text-base sm:text-xl font-extrabold text-[#F4F4F5] mt-0.5">
              {formatBs(closeout.pagoMovilBs + closeout.puntoEfectivoBs)}
            </div>
            <div className="font-mono text-[10px] sm:text-xs text-[#8E95A2] mt-0.5 truncate">
              Equiv. {formatUsd(closeout.pagoMovilUsdEquiv + closeout.puntoEfectivoUsdEquiv)}
            </div>
          </div>

          <div className="p-2.5 sm:p-4 bg-[#141618] border border-[#23262B] rounded-xl sm:rounded-2xl">
            <div className="text-[11px] sm:text-xs text-[#8E95A2]">Gaveta USD + Digital</div>
            <div className="font-mono text-base sm:text-xl font-extrabold text-[#22C55E] mt-0.5">
              {formatUsd(closeout.efectivoUsdDrawer + closeout.digitalUsdTotal)}
            </div>
            <div className="font-mono text-[10px] sm:text-xs text-[#8E95A2] mt-0.5 truncate">
              Billetes: {formatUsd(closeout.efectivoUsdDrawer)}
            </div>
          </div>

          <div className="p-2.5 sm:p-4 bg-[#141618] border border-[#23262B] rounded-xl sm:rounded-2xl">
            <div className="text-[11px] sm:text-xs text-[#8E95A2]">Cuentas por Cobrar</div>
            <div className="font-mono text-base sm:text-xl font-extrabold text-[#F87171] mt-0.5">
              Debe: {formatUsd(closeout.totalStreetReceivablesUsd)}
            </div>
            <div className="font-mono text-[10px] sm:text-xs text-[#38BDF8] mt-0.5 truncate">
              A favor: +{formatUsd(closeout.totalClientCreditsUsd)}
            </div>
          </div>
        </section>

        {/* Adaptive Workspace Views */}
        {activeTab === 'AGENDA' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left 7 Columns on XL Desktop: Agenda Operativa */}
            <div className="xl:col-span-7 space-y-5">
              <AgendaSection
                appointments={appointments}
                clients={clients}
                activeRateBs={activeRateBs}
                onOpenCheckout={(apt) => setCheckoutAppointmentId(apt.id)}
                onUpdateStatus={handleUpdateAppointmentStatus}
                onSelectClient={(clientId) => setSelectedClientId(clientId)}
                onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
                onNavigateToDebtors={() => setActiveTab('CLIENTES')}
              />

              <div className="hidden xl:block">
                <CashCloseoutSection
                  appointments={appointments}
                  clients={clients}
                  activeRateBs={activeRateBs}
                  onNavigateToDebtors={() => setActiveTab('CLIENTES')}
                />
              </div>
            </div>

            {/* Right 5 Columns on XL Desktop: Libro de Cuentas */}
            <div className="xl:col-span-5">
              <ClientDirectorySection
                clients={clients}
                activeRateBs={activeRateBs}
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
                onSettleClientDebt={handleSettleClientDebt}
                onUpdateClientNotes={handleUpdateClientNotes}
                onOpenNewClientModal={() => setIsNewClientOpen(true)}
              />
            </div>
          </div>
        )}

        {activeTab === 'CLIENTES' && (
          <ClientDirectorySection
            clients={clients}
            activeRateBs={activeRateBs}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            onSettleClientDebt={handleSettleClientDebt}
            onUpdateClientNotes={handleUpdateClientNotes}
            onOpenNewClientModal={() => setIsNewClientOpen(true)}
          />
        )}

        {activeTab === 'CAJA' && (
          <CashCloseoutSection
            appointments={appointments}
            clients={clients}
            activeRateBs={activeRateBs}
            onNavigateToDebtors={() => setActiveTab('CLIENTES')}
          />
        )}

        {activeTab === 'AJUSTES' && (
          <section
            aria-label="Ajustes de tasas, catálogo de servicios y respaldo"
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          >
            {/* Left Card: Exchange Rates & Barber Selector */}
            <div className="bg-[#141618] border border-[#23262B] rounded-2xl p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#F4F4F5]">
                    Tasas de Cambio (DolarApi BCV & Mercado)
                  </h2>
                  <p className="text-xs text-[#8E95A2] mt-0.5">
                    Tasas oficiales sincronizadas en tiempo real con DolarApi Venezuela o fijadas manualmente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRefreshLiveRates(false)}
                  disabled={isRefreshingLiveRates}
                  className="px-2.5 py-1.5 bg-[#1C1E22] hover:bg-[#24272D] border border-[#23262B] text-[#F4F4F5] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRefreshingLiveRates ? 'animate-spin text-[#D4AF37]' : 'text-[#D4AF37]'}`} />
                  <span>Sincronizar BCV</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {(['BCV', 'EUR_BCV', 'PARALELO', 'PERSONALIZADA'] as RateMode[]).map((mode) => {
                  const label =
                    mode === 'BCV'
                      ? 'Dólar Oficial BCV (USD)'
                      : mode === 'EUR_BCV'
                        ? 'Euro Oficial BCV (EUR)'
                        : mode === 'PARALELO'
                          ? 'Dólar Paralelo (Mercado)'
                          : 'Tasa Manual / Acordada';

                  return (
                    <div
                      key={mode}
                      className="p-3 bg-[#181A1D] border border-[#23262B] rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#F4F4F5] block truncate">
                          {label}
                        </span>
                        {rates.activeMode === mode && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#D4AF37] text-[#0C0D0E] inline-block mt-0.5">
                            ACTIVA PARA COBROS
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`Valor tasa ${mode}`}
                          value={settingsRateStrings[mode]}
                          onChange={(e) => {
                            const cleaned = sanitizeDecimalInput(e.target.value);
                            if (cleaned !== null) {
                              setSettingsRateStrings((prev) => ({
                                ...prev,
                                [mode]: cleaned,
                              }));
                            }
                          }}
                          className="w-24 bg-[#0C0D0E] border border-[#23262B] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#D4AF37] focus:outline-none focus:border-[#D4AF37]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = parseDecimalSafe(settingsRateStrings[mode]);
                            if (parsed > 0) {
                              handleUpdateRateValue(mode, parsed);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-[#D4AF37] hover:bg-[#E2BF4C] text-[#0C0D0E] rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Fijar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Barber Station */}
              <div className="pt-4 border-t border-[#23262B] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#F4F4F5]">Estación / Barbero Activo</div>
                  <div className="text-xs text-[#8E95A2]">Se muestra en el encabezado operativo</div>
                </div>
                <select
                  aria-label="Seleccionar barbero activo"
                  value={activeBarberName}
                  onChange={(e) => setActiveBarberName(e.target.value)}
                  className="bg-[#181A1D] border border-[#23262B] rounded-lg px-3 py-1.5 text-xs font-bold text-[#F4F4F5] focus:outline-none"
                >
                  <option value="Navas · Silla 1">Navas · Silla 1 (Master)</option>
                  <option value="Diego · Silla 2">Diego · Silla 2</option>
                </select>
              </div>

              {/* Restore Demo Data */}
              <div className="pt-4 border-t border-[#23262B] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#F4F4F5]">Restaurar Datos de Prueba</div>
                  <div className="text-xs text-[#8E95A2]">
                    Reinicia turnos, deudas y tasas a los valores iniciales de demostración.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="px-3 py-1.5 bg-[#181A1D] hover:bg-[#23262B] border border-[#23262B] rounded-lg text-xs font-bold text-[#F4F4F5] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Restaurar Demo</span>
                </button>
              </div>
            </div>

            {/* Right Card: Editable Service Catalog in USD */}
            <div className="bg-[#141618] border border-[#23262B] rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#F4F4F5]">
                  Catálogo de Servicios y Precios Base ($)
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Equivalente en Bolívares calculado automáticamente a {activeRateBs.toFixed(2)} Bs/$.
                </p>
              </div>

              <div className="space-y-2.5">
                {serviceCatalog.map((service) => (
                  <div
                    key={service.id}
                    className="p-3.5 bg-[#1A1D24] border border-[#222631] rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F9FAFB] truncate">
                        {service.name}
                      </div>
                      <div className="font-mono text-[11px] text-[#9CA3AF] mt-0.5">
                        Equiv: {formatBs(usdToBs(service.priceUsd, activeRateBs))} · {service.durationMin} min
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs text-[#9CA3AF]">USD $</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-label={`Precio USD para ${service.name}`}
                        value={catalogPriceStrings[service.id] ?? String(service.priceUsd)}
                        onChange={(e) => {
                          const cleaned = sanitizeDecimalInput(e.target.value);
                          if (cleaned !== null) {
                            setCatalogPriceStrings((prev) => ({
                              ...prev,
                              [service.id]: cleaned,
                            }));
                            const parsed = parseDecimalSafe(cleaned);
                            if (parsed > 0) {
                              setServiceCatalog((prevCat) =>
                                prevCat.map((item) =>
                                  item.id === service.id
                                    ? { ...item, priceUsd: roundToTwoDecimals(parsed) }
                                    : item
                                )
                              );
                            }
                          }
                        }}
                        className="w-20 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#10B981] focus:outline-none focus:border-[#F59E0B]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Quick Action Floating Popover above Center (+) Button */}
      {isFabMenuOpen && (
        <div
          role="dialog"
          aria-label="Menú rápido de acciones"
          className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center pb-24 px-4"
          onClick={() => setIsFabMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141618] border border-[#23262B] rounded-2xl p-4 w-full max-w-sm space-y-2.5 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#23262B]">
              <span className="text-xs font-bold text-[#F4F4F5] uppercase tracking-wider">
                Acción Rápida BARBER SHOP
              </span>
              <button
                type="button"
                onClick={() => setIsFabMenuOpen(false)}
                className="text-[#8E95A2] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFabMenuOpen(false);
                setIsNewAppointmentOpen(true);
              }}
              className="w-full p-3.5 bg-[#181A1D] hover:bg-[#23262B] border border-[#23262B] rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#F4F4F5]">
                  Nuevo Turno Rápido
                </div>
                <div className="text-xs text-[#8E95A2]">
                  Agendar cliente en silla o lista de espera
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleOpenExpressCheckout}
              className="w-full p-3.5 bg-[#D4AF37] hover:bg-[#E2BF4C] text-[#0C0D0E] rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0C0D0E]/15 flex items-center justify-center text-[#0C0D0E] shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">
                  Cobro Express (En Silla)
                </div>
                <div className="text-xs font-semibold opacity-80">
                  Abrir caja multimoneda del turno activo
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 7. Fixed Bottom Floating Bar with Elevated Center (+) Button */}
      <nav
        aria-label="Navegación principal inferior"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#141618] border-t border-[#23262B] px-4 h-16"
      >
        <div className="max-w-xl mx-auto h-full grid grid-cols-5 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('AGENDA')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors cursor-pointer ${activeTab === 'AGENDA' ? 'text-[#D4AF37]' : 'text-[#8E95A2] hover:text-[#F4F4F5]'
              }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Agenda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLIENTES')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors cursor-pointer ${activeTab === 'CLIENTES' ? 'text-[#D4AF37]' : 'text-[#8E95A2] hover:text-[#F4F4F5]'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes</span>
          </button>

          {/* Center Elevated (+) Button */}
          <div className="flex items-center justify-center -mt-6">
            <button
              type="button"
              onClick={() => setIsFabMenuOpen((prev) => !prev)}
              aria-label="Acción rápida: Nuevo Turno o Cobro Express"
              className="w-14 h-14 rounded-full bg-[#D4AF37] hover:bg-[#E2BF4C] text-[#0C0D0E] border-4 border-[#0C0D0E] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('CAJA')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors cursor-pointer ${activeTab === 'CAJA' ? 'text-[#D4AF37]' : 'text-[#8E95A2] hover:text-[#F4F4F5]'
              }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Caja/Finanzas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AJUSTES')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors cursor-pointer ${activeTab === 'AJUSTES' ? 'text-[#D4AF37]' : 'text-[#8E95A2] hover:text-[#F4F4F5]'
              }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ajustes</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {activeCheckoutAppointment && (
        <CheckoutModal
          appointment={activeCheckoutAppointment}
          client={activeCheckoutClient}
          activeRateBs={activeRateBs}
          onClose={() => setCheckoutAppointmentId(null)}
          onConfirmCheckout={handleConfirmCheckout}
        />
      )}

      {isNewAppointmentOpen && (
        <NewAppointmentModal
          clients={clients}
          activeRateBs={activeRateBs}
          serviceCatalog={serviceCatalog}
          onClose={() => setIsNewAppointmentOpen(false)}
          onCreateAppointment={handleCreateAppointment}
        />
      )}

      {isNewClientOpen && (
        <NewClientModal
          onClose={() => setIsNewClientOpen(false)}
          onCreateClient={handleCreateClient}
        />
      )}
    </div>
  );
}
