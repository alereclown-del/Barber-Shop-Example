import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  Plus,
  Scissors,
} from 'lucide-react';
import {
  AppointmentItem,
  AppointmentStatus,
  ClientProfile,
} from '../types';
import {
  buildWhatsAppUrl,
  formatBs,
  formatUsd,
  usdToBs,
} from '../utils/finance';

interface AgendaSectionProps {
  appointments: AppointmentItem[];
  clients: ClientProfile[];
  activeRateBs: number;
  onOpenCheckout: (appointment: AppointmentItem) => void;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onSelectClient: (clientId: string) => void;
  onOpenNewAppointment: () => void;
  onNavigateToDebtors?: () => void;
  compactMode?: boolean;
}

type DateFilterKey = 'HOY' | 'VIE' | 'SAB' | 'SEMANA';
type StatusTabKey = 'TODOS' | 'POR_ATENDER' | 'EN_SILLA' | 'DEUDORES';

const CALENDAR_DAYS: {
  key: DateFilterKey;
  month: string;
  dayNum: string;
  weekday: string;
}[] = [
    { key: 'HOY', month: 'NOV', dayNum: '05', weekday: 'JUE' },
    { key: 'VIE', month: 'NOV', dayNum: '06', weekday: 'VIE' },
    { key: 'SAB', month: 'NOV', dayNum: '07', weekday: 'SÁB' },
    { key: 'SEMANA', month: 'NOV', dayNum: 'ALL', weekday: 'SEM' },
  ];

export const AgendaSection: React.FC<AgendaSectionProps> = ({
  appointments,
  clients,
  activeRateBs,
  onOpenCheckout,
  onUpdateStatus,
  onSelectClient,
  onOpenNewAppointment,
  onNavigateToDebtors,
  compactMode = false,
}) => {
  const [selectedDateKey, setSelectedDateKey] = useState<DateFilterKey>('HOY');
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('TODOS');

  const clientMap = new Map<string, ClientProfile>();
  for (const c of clients) {
    clientMap.set(c.id, c);
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (selectedDateKey !== 'SEMANA' && apt.dateKey !== selectedDateKey) {
      return false;
    }
    if (statusFilter === 'POR_ATENDER') {
      return apt.status !== 'COMPLETADO';
    }
    if (statusFilter === 'EN_SILLA') {
      return apt.status === 'EN_SILLA';
    }
    if (statusFilter === 'DEUDORES') {
      const cli = clientMap.get(apt.clientId);
      const hasClientDebt = cli ? cli.balanceUsd < -0.01 : false;
      return apt.solvency !== 'PAGADO' || hasClientDebt;
    }
    return true;
  });

  const todayCount = appointments.filter((a) => a.dateKey === 'HOY').length;
  const pendingTodayCount = appointments.filter(
    (a) => a.dateKey === 'HOY' && a.status !== 'COMPLETADO'
  ).length;

  return (
    <section
      aria-label="Agenda y turnos del día"
      className="flex flex-col gap-4"
    >
      {/* Top Section Card: Title + Date Carousel + Segmented Filter Pills */}
      <div className="bg-[#13151A] border border-[#222631] rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h2 className="text-lg lg:text-xl font-extrabold text-[#F9FAFB] tracking-tight">
                Agenda Operativa de Turnos
              </h2>
              <span className="text-xs font-mono text-[#9CA3AF]">
                · {pendingTodayCount} por atender / {todayCount} hoy
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Toca &ldquo;Cobrar Turno&rdquo; para abrir la caja multimoneda en menos de 3 toques.
            </p>
          </div>

          {!compactMode && (
            <button
              type="button"
              onClick={onOpenNewAppointment}
              className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Turno</span>
            </button>
          )}
        </div>

        {/* 2. Horizontal Date Selector Carousel (Vertical Pills) */}
        <div
          role="group"
          aria-label="Selector de fecha de agenda"
          className="flex items-center gap-2.5 overflow-x-auto pb-1"
        >
          {CALENDAR_DAYS.map((day) => {
            const isSelected = selectedDateKey === day.key;
            const countForDay =
              day.key === 'SEMANA'
                ? appointments.length
                : appointments.filter((a) => a.dateKey === day.key).length;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDateKey(day.key)}
                className={`min-w-[68px] py-2.5 px-3 rounded-2xl border flex flex-col items-center justify-center transition-all shrink-0 cursor-pointer ${isSelected
                    ? 'bg-[#F59E0B] border-[#F59E0B] text-[#090A0D] font-extrabold'
                    : 'bg-[#1A1D24] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB] hover:border-[#374151]'
                  }`}
              >
                <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                  {day.month}
                </span>
                <span className="font-mono text-lg font-extrabold leading-tight my-0.5">
                  {day.dayNum}
                </span>
                <span className="text-[10px] font-mono font-semibold">
                  {day.weekday} ({countForDay})
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Quick Filter Pills (Tabs de Estado) */}
        <div
          role="group"
          aria-label="Filtro de estado de turnos"
          className="flex flex-wrap items-center gap-2 pt-1"
        >
          {(
            [
              { id: 'TODOS', label: 'Todos' },
              { id: 'POR_ATENDER', label: 'Por Atender' },
              { id: 'EN_SILLA', label: 'En Silla' },
              { id: 'DEUDORES', label: 'Deudores / Cuentas x Cobrar' },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${active
                    ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B]'
                    : 'bg-[#1A1D24] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB]'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}

          {onNavigateToDebtors && (
            <button
              type="button"
              onClick={onNavigateToDebtors}
              className="ml-auto text-xs font-semibold text-[#F59E0B] hover:underline cursor-pointer"
            >
              Ir al Libro de Deudas →
            </button>
          )}
        </div>
      </div>

      {/* 4. Editorial Rounded Turn Cards */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-[#13151A] border border-[#222631] rounded-3xl p-8 text-center">
          <Calendar className="w-7 h-7 text-[#9CA3AF] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#F9FAFB]">
            No hay turnos registrados en este filtro
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Selecciona otro día en el carrusel superior o agenda un nuevo corte.
          </p>
          <button
            type="button"
            onClick={onOpenNewAppointment}
            className="mt-4 px-4 py-2.5 bg-[#F59E0B] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar Primer Turno</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((apt) => {
            const amountBs = usdToBs(apt.priceUsd, activeRateBs);
            const clientProfile = clientMap.get(apt.clientId);
            const clientBalance = clientProfile?.balanceUsd ?? 0;

            const isDebtor = (clientProfile && clientProfile.balanceUsd < -0.01) || apt.solvency === 'PENDIENTE' || apt.solvency === 'ABONO_PARCIAL';
            const debtAmountUsd = clientProfile && clientProfile.balanceUsd < -0.01
              ? Math.abs(clientProfile.balanceUsd)
              : Math.max(0, apt.priceUsd - apt.paidUsd);

            const whatsappUrl = buildWhatsAppUrl(
              apt.clientPhone,
              apt.clientName,
              isDebtor ? 'COBRO_DEUDA' : 'RECORDATORIO_TURNO',
              {
                time: apt.time,
                serviceName: apt.serviceName,
                amountUsd: isDebtor ? debtAmountUsd : apt.priceUsd,
                rateBs: activeRateBs,
              }
            );

            // Cut Status Badge
            const statusConfig =
              apt.status === 'EN_SILLA'
                ? {
                  label: 'Cortando · En Silla',
                  classes: 'bg-[#78350F40] text-[#F59E0B] border border-[#D9770650]',
                }
                : apt.status === 'COMPLETADO'
                  ? {
                    label: 'Finalizado',
                    classes: 'bg-[#064E3B40] text-[#10B981] border border-[#05966950]',
                  }
                  : {
                    label: 'En espera',
                    classes: 'bg-[#1A1D24] text-[#9CA3AF] border border-[#222631]',
                  };

            // Solvency Badge
            const solvencyConfig =
              apt.solvency === 'PAGADO'
                ? {
                  label: 'PAGADO',
                  classes: 'bg-[#064E3B40] text-[#10B981] border border-[#05966950]',
                }
                : apt.solvency === 'ABONO_PARCIAL'
                  ? {
                    label: `ABONO ($${apt.paidUsd.toFixed(2)})`,
                    classes: 'bg-[#78350F40] text-[#F59E0B] border border-[#D9770650]',
                  }
                  : {
                    label: 'DEUDA / PENDIENTE',
                    classes: 'bg-[#7F1D1D40] text-[#EF4444] border border-[#DC262650]',
                  };

            return (
              <article
                key={apt.id}
                className={`bg-[#13151A] border rounded-3xl p-4 sm:p-5 transition-colors ${apt.status === 'EN_SILLA'
                    ? 'border-[#F59E0B]/70'
                    : 'border-[#222631] hover:border-[#374151]'
                  }`}
              >
                {/* Top Card Row: Time + Cut Status Badge + Solvency Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222631]">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-extrabold text-[#F9FAFB] bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-1">
                      <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                      {apt.time}
                    </span>
                    <span className="font-mono text-xs text-[#9CA3AF]">
                      {apt.dateKey === 'HOY' ? 'Hoy · Jue 05' : apt.dayLabel}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-xl ${statusConfig.classes}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Prominent Solvency Badge */}
                  <span
                    className={`font-mono text-xs font-extrabold px-3 py-1 rounded-xl ${solvencyConfig.classes}`}
                  >
                    {solvencyConfig.label}
                  </span>
                </div>

                {/* Middle Row: Client Name + Service + Dual Price Block + Actions */}
                <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectClient(apt.clientId)}
                        className="text-base sm:text-lg font-extrabold text-[#F9FAFB] hover:text-[#F59E0B] transition-colors text-left truncate cursor-pointer"
                      >
                        {apt.clientName}
                      </button>
                      <span className="text-xs text-[#9CA3AF]">· {apt.barberName}</span>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-[#9CA3AF] mt-0.5">
                      {apt.serviceName}
                    </p>

                    {/* Client previous debt or credit indicator */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {clientBalance < -0.01 && (
                        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg bg-[#7F1D1D40] text-[#EF4444] border border-[#DC262650]">
                          Arrastra deuda previa: {formatUsd(Math.abs(clientBalance))}
                        </span>
                      )}
                      {clientBalance > 0.01 && (
                        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg bg-[#78350F40] text-[#F59E0B] border border-[#D9770650]">
                          Saldo a favor disponible: +{formatUsd(clientBalance)}
                        </span>
                      )}
                    </div>

                    {/* Audit split line if already paid */}
                    {apt.splits && apt.splits.length > 0 && (
                      <div className="mt-2 text-xs font-mono text-[#9CA3AF] flex flex-wrap items-center gap-x-2">
                        <span>Registro caja:</span>
                        {apt.splits.map((s, idx) => (
                          <span key={s.id} className="text-[#F9FAFB]">
                            {idx > 0 ? '+ ' : ''}
                            {s.method === 'PAGO_MOVIL_BS' &&
                              `Pago Móvil ${formatUsd(s.amountUsd)} (${s.bank?.split(' ')[0] || 'Banco'} #${s.referenceDigits || '----'})`}
                            {s.method === 'EFECTIVO_USD' && `Efectivo ${formatUsd(s.amountUsd)}`}
                            {s.method === 'DIGITAL_USD' &&
                              `${s.digitalProvider || 'Digital'} ${formatUsd(s.amountUsd)}`}
                            {s.method === 'PUNTO_EFECTIVO_BS' &&
                              `Punto/Bs ${formatUsd(s.amountUsd)}`}
                            {s.method === 'SALDO_A_FAVOR_APLICADO' &&
                              `Saldo a favor ${formatUsd(s.amountUsd)}`}
                            {s.method === 'FIADO_PENDIENTE' &&
                              `Fiado ${formatUsd(s.amountUsd)}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Financial Dual Block ($ | Bs) + Direct Action Buttons */}
                  <div className="flex flex-col sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#222631] shrink-0">
                    {/* Dual Currency Display */}
                    <div className="inline-flex items-baseline gap-2 bg-[#1A1D24] border border-[#222631] rounded-2xl px-3.5 py-2 self-start sm:self-end">
                      <span className="font-mono text-base sm:text-lg font-extrabold text-[#F9FAFB]">
                        {formatUsd(apt.priceUsd)}
                      </span>
                      <span className="text-[#9CA3AF] font-mono">|</span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#F59E0B]">
                        {formatBs(amountBs)}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      {/* WhatsApp Direct Button */}
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={isDebtor ? `Cobrar saldo pendiente a ${apt.clientName} por WhatsApp` : `Enviar recordatorio WhatsApp a ${apt.clientName}`}
                        title={isDebtor ? `Cobrar saldo deudor a ${apt.clientName}` : `WhatsApp a ${apt.clientName} (${apt.clientPhone})`}
                        className={`min-h-[42px] px-3 py-2 border rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${isDebtor
                            ? 'bg-[#2A0E11] hover:bg-[#3B1519] border-[#DC2626]/40 text-[#F87171]'
                            : 'bg-[#181A1D] hover:bg-[#23262B] border-[#23262B] text-[#F4F4F5]'
                          }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${isDebtor ? 'text-[#F87171]' : 'text-[#22C55E]'}`} />
                        <span className="hidden md:inline">{isDebtor ? 'Cobrar WA' : 'WhatsApp'}</span>
                      </a>

                      {/* Move to Chair if waiting */}
                      {apt.status === 'EN_ESPERA' && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(apt.id, 'EN_SILLA')}
                          aria-label={`Pasar a silla a ${apt.clientName}`}
                          className="min-h-[42px] px-3 py-2 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#F9FAFB] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Scissors className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <span>En Silla</span>
                        </button>
                      )}

                      {/* Primary Checkout CTA */}
                      {apt.solvency !== 'PAGADO' ? (
                        <button
                          type="button"
                          onClick={() => onOpenCheckout(apt)}
                          className="min-h-[42px] px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Cobrar Turno</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenCheckout(apt)}
                          className="min-h-[42px] px-3.5 py-2 bg-[#064E3B40] hover:bg-[#064E3B60] border border-[#05966950] text-[#10B981] rounded-xl text-xs font-mono font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Liquidado</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
