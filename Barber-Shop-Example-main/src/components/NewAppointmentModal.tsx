import React, { useState } from 'react';
import { CalendarPlus, Check, X } from 'lucide-react';
import { AppointmentItem, ClientProfile, ServiceCatalogItem, ServiceId } from '../types';
import { SERVICE_CATALOG } from '../data/seedData';
import {
  formatBs,
  formatUsd,
  parseDecimalSafe,
  roundToTwoDecimals,
  sanitizeDecimalInput,
  usdToBs,
} from '../utils/finance';

interface NewAppointmentModalProps {
  clients: ClientProfile[];
  activeRateBs: number;
  serviceCatalog?: ServiceCatalogItem[];
  onClose: () => void;
  onCreateAppointment: (newAppt: Omit<AppointmentItem, 'id'>) => void;
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  clients,
  activeRateBs,
  serviceCatalog = SERVICE_CATALOG,
  onClose,
  onCreateAppointment,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id || 'NEW'
  );
  const [customClientName, setCustomClientName] = useState('');
  const [customClientPhone, setCustomClientPhone] = useState('0414-');
  const [serviceId, setServiceId] = useState<ServiceId>('CORTE_BARBA');
  const [customPriceStr, setCustomPriceStr] = useState<string>(() => {
    const def = serviceCatalog.find((s) => s.id === 'CORTE_BARBA') || serviceCatalog[0];
    return String(def.priceUsd);
  });
  const [time, setTime] = useState('16:00');
  const [dateKey, setDateKey] = useState<'HOY' | 'VIE' | 'SAB'>('HOY');
  const [barberName, setBarberName] = useState('Navas (Master)');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedService =
    serviceCatalog.find((s) => s.id === serviceId) || serviceCatalog[0];

  const effectivePriceUsd = roundToTwoDecimals(
    parseDecimalSafe(customPriceStr) || selectedService.priceUsd
  );

  const handleServiceChange = (newId: ServiceId) => {
    setServiceId(newId);
    const found = serviceCatalog.find((s) => s.id === newId);
    if (found) {
      setCustomPriceStr(String(found.priceUsd));
    }
  };

  const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeDecimalInput(e.target.value);
    if (cleaned !== null) {
      setCustomPriceStr(cleaned);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let clientName = '';
    let clientPhone = '';
    let finalClientId = selectedClientId;

    if (selectedClientId === 'NEW') {
      if (!customClientName.trim()) {
        setErrorMsg('Ingresa el nombre del cliente para agendar el turno.');
        return;
      }
      clientName = customClientName.trim();
      clientPhone = customClientPhone.trim() || '0414-0000000';
      finalClientId = `cli-${Date.now()}`;
    } else {
      const existing = clients.find((c) => c.id === selectedClientId);
      if (!existing) {
        setErrorMsg('Selecciona un cliente válido.');
        return;
      }
      clientName = existing.name;
      clientPhone = existing.phone;
    }

    const dayLabel =
      dateKey === 'HOY'
        ? 'Jue 05 Nov'
        : dateKey === 'VIE'
        ? 'Vie 06 Nov'
        : 'Sáb 07 Nov';

    onCreateAppointment({
      clientId: finalClientId,
      clientName,
      clientPhone,
      dateKey,
      dayLabel,
      time,
      barberName,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      priceUsd: effectivePriceUsd,
      status: 'EN_ESPERA',
      solvency: 'PENDIENTE',
      paidUsd: 0,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-appointment-title"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
    >
      <div className="bg-[#13151A] border border-[#222631] rounded-3xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222631] bg-[#090A0D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-[#F59E0B]" />
            <h2
              id="new-appointment-title"
              className="text-base font-extrabold text-[#F9FAFB]"
            >
              Agendar Nuevo Turno Rápido
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de nuevo turno"
            className="p-2 text-[#9CA3AF] hover:text-[#F9FAFB] border border-[#222631] rounded-xl bg-[#1A1D24] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="appt-client-select"
              className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
            >
              Cliente
            </label>
            <select
              id="appt-client-select"
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2.5 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}){' '}
                  {c.balanceUsd < -0.01
                    ? `— Debe $${Math.abs(c.balanceUsd).toFixed(2)}`
                    : c.balanceUsd > 0.01
                    ? `— Saldo a favor +$${c.balanceUsd.toFixed(2)}`
                    : ''}
                </option>
              ))}
              <option value="NEW">+ Cliente nuevo de paso...</option>
            </select>
          </div>

          {selectedClientId === 'NEW' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#1A1D24] border border-[#222631] rounded-2xl">
              <div>
                <label
                  htmlFor="new-appt-client-name"
                  className="block text-xs text-[#9CA3AF] mb-1"
                >
                  Nombre Completo
                </label>
                <input
                  id="new-appt-client-name"
                  type="text"
                  value={customClientName}
                  onChange={(e) => {
                    setCustomClientName(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Ej. Carlos Zambrano"
                  className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>
              <div>
                <label
                  htmlFor="new-appt-client-phone"
                  className="block text-xs text-[#9CA3AF] mb-1"
                >
                  WhatsApp (Venezuela)
                </label>
                <input
                  id="new-appt-client-phone"
                  type="text"
                  value={customClientPhone}
                  onChange={(e) => setCustomClientPhone(e.target.value)}
                  placeholder="0414-1234567"
                  className="w-full bg-[#090A0D] border border-[#222631] rounded-xl px-3 py-2 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="appt-service-select"
                className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
              >
                Servicio Requerido
              </label>
              <select
                id="appt-service-select"
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value as ServiceId)}
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2.5 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
              >
                {serviceCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatUsd(s.priceUsd)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="appt-custom-price"
                className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
              >
                Precio USD ($)
              </label>
              <input
                id="appt-custom-price"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={customPriceStr}
                onChange={handlePriceInputChange}
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#F59E0B] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="appt-day-select"
                className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
              >
                Día
              </label>
              <select
                id="appt-day-select"
                value={dateKey}
                onChange={(e) =>
                  setDateKey(e.target.value as 'HOY' | 'VIE' | 'SAB')
                }
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-2.5 py-2 text-xs text-[#F9FAFB] focus:outline-none"
              >
                <option value="HOY">Hoy (Jue 05)</option>
                <option value="VIE">Vie 06 Nov</option>
                <option value="SAB">Sáb 07 Nov</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="appt-time-input"
                className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
              >
                Hora
              </label>
              <input
                id="appt-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-2.5 py-2 text-xs font-mono text-[#F9FAFB] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="appt-barber-select"
                className="block text-xs font-bold text-[#9CA3AF] mb-1.5"
              >
                Barbero / Silla
              </label>
              <select
                id="appt-barber-select"
                value={barberName}
                onChange={(e) => setBarberName(e.target.value)}
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-2.5 py-2 text-xs text-[#F9FAFB] focus:outline-none"
              >
                <option value="Navas (Master)">Navas (Master)</option>
                <option value="Diego (Silla 2)">Diego (Silla 2)</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-[#7F1D1D40] border border-[#DC262650] rounded-xl text-xs text-[#EF4444]"
            >
              {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-[#222631] flex items-center justify-between">
            <div className="font-mono text-xs text-[#9CA3AF]">
              Total: <strong className="text-[#F9FAFB]">{formatUsd(effectivePriceUsd)}</strong>{' '}
              ({formatBs(usdToBs(effectivePriceUsd, activeRateBs))})
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#1A1D24] border border-[#222631] rounded-xl text-xs text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Turno</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
