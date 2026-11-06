import React, { useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { ClientProfile } from '../types';
import {
  parseDecimalSafe,
  roundToTwoDecimals,
  sanitizeDecimalInput,
} from '../utils/finance';

interface NewClientModalProps {
  onClose: () => void;
  onCreateClient: (client: Omit<ClientProfile, 'id' | 'history' | 'lastVisitDate'>) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  onClose,
  onCreateClient,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('0414-');
  const [frequency, setFrequency] = useState('Cada 15 días');
  const [styleNotes, setStyleNotes] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [initialBalanceType, setInitialBalanceType] = useState<
    'SOLVENTE' | 'DEUDA' | 'SALDO_FAVOR'
  >('SOLVENTE');
  const [balanceAmountStr, setBalanceAmountStr] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBalanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeDecimalInput(e.target.value);
    if (cleaned !== null) {
      setBalanceAmountStr(cleaned);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('El nombre del cliente es obligatorio.');
      return;
    }

    const numAmount = Math.abs(roundToTwoDecimals(parseDecimalSafe(balanceAmountStr)));
    let balanceUsd = 0;
    let balanceNote: string | undefined = undefined;

    if (initialBalanceType === 'DEUDA' && numAmount > 0) {
      balanceUsd = -numAmount;
      balanceNote = `Saldo pendiente inicial de $${numAmount.toFixed(2)}`;
    } else if (initialBalanceType === 'SALDO_FAVOR' && numAmount > 0) {
      balanceUsd = numAmount;
      balanceNote = `Saldo a favor inicial de +$${numAmount.toFixed(2)}`;
    }

    onCreateClient({
      name: name.trim(),
      phone: phone.trim() || '0414-0000000',
      frequency,
      styleNotes:
        styleNotes.trim() ||
        'Corte clásico, consultar altura de máquina antes de empezar.',
      isVip,
      balanceUsd,
      balanceNote,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-client-modal-title"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
    >
      <div className="bg-[#13151A] border border-[#222631] rounded-3xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222631] bg-[#090A0D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#F59E0B]" />
            <h2
              id="new-client-modal-title"
              className="text-base font-extrabold text-[#F9FAFB]"
            >
              Registrar Cliente en Libro de Cuentas
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de registro de cliente"
            className="p-2 text-[#9CA3AF] hover:text-[#F9FAFB] border border-[#222631] rounded-xl bg-[#1A1D24] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="client-name-input"
                className="block text-xs font-bold text-[#9CA3AF] mb-1"
              >
                Nombre y Apellido
              </label>
              <input
                id="client-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ej. Oswaldo Guillén"
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div>
              <label
                htmlFor="client-phone-input"
                className="block text-xs font-bold text-[#9CA3AF] mb-1"
              >
                Teléfono (WhatsApp)
              </label>
              <input
                id="client-phone-input"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0414-2901122"
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="client-freq-select"
                className="block text-xs font-bold text-[#9CA3AF] mb-1"
              >
                Frecuencia de Corte
              </label>
              <select
                id="client-freq-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none"
              >
                <option value="Cada 7 días">Semanal (Cada 7 días)</option>
                <option value="Cada 12 días">Cada 12 días</option>
                <option value="Cada 15 días">Quincenal (Cada 15 días)</option>
                <option value="Cada 21 días">Cada 3 semanas</option>
              </select>
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F9FAFB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="accent-[#F59E0B]"
                />
                <span>Marcar como Cliente VIP (Frecuente)</span>
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="client-style-notes"
              className="block text-xs font-bold text-[#9CA3AF] mb-1"
            >
              Fórmula Técnica de Corte / Notas de Estilo
            </label>
            <textarea
              id="client-style-notes"
              rows={2}
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder="Ej. Mid fade con la 1.5, no bajarle mucho arriba, navaja en patillas..."
              className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none focus:border-[#F59E0B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#222631]">
            <div>
              <label
                htmlFor="client-init-solvency"
                className="block text-xs font-bold text-[#9CA3AF] mb-1"
              >
                Estado Financiero Inicial
              </label>
              <select
                id="client-init-solvency"
                value={initialBalanceType}
                onChange={(e) =>
                  setInitialBalanceType(
                    e.target.value as 'SOLVENTE' | 'DEUDA' | 'SALDO_FAVOR'
                  )
                }
                className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs text-[#F9FAFB] focus:outline-none"
              >
                <option value="SOLVENTE">Solvente ($0.00)</option>
                <option value="DEUDA">Trae deuda de libreta ($)</option>
                <option value="SALDO_FAVOR">Tiene vuelto / saldo a favor ($)</option>
              </select>
            </div>

            {initialBalanceType !== 'SOLVENTE' && (
              <div>
                <label
                  htmlFor="client-init-amount"
                  className="block text-xs font-bold text-[#9CA3AF] mb-1"
                >
                  Monto USD ($)
                </label>
                <input
                  id="client-init-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={balanceAmountStr}
                  onChange={handleBalanceInputChange}
                  className="w-full bg-[#1A1D24] border border-[#222631] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#F59E0B] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-[#7F1D1D40] border border-[#DC262650] rounded-xl text-xs text-[#EF4444]"
            >
              {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-[#222631] flex justify-end gap-2">
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
              <span>Guardar en Directorio</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
