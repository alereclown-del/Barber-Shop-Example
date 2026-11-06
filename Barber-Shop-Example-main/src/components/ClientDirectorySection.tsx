import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  History,
  MessageSquare,
  Search,
  Star,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  ClientProfile,
  PaymentMethodType,
  VenezuelanBank,
} from '../types';
import { VENEZUELAN_BANKS } from '../data/seedData';
import {
  buildWhatsAppUrl,
  formatBs,
  formatUsd,
  parseDecimalSafe,
  roundToTwoDecimals,
  sanitizeDecimalInput,
  usdToBs,
} from '../utils/finance';

interface ClientDirectorySectionProps {
  clients: ClientProfile[];
  activeRateBs: number;
  selectedClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
  onSettleClientDebt: (
    clientId: string,
    amountUsd: number,
    method: PaymentMethodType,
    bank?: VenezuelanBank,
    referenceDigits?: string
  ) => void;
  onUpdateClientNotes: (clientId: string, newNotes: string) => void;
  onOpenNewClientModal: () => void;
}

type DirectoryFilter = 'TODOS' | 'DEUDORES' | 'SALDO_FAVOR' | 'SOLVENTES' | 'VIP';

export const ClientDirectorySection: React.FC<ClientDirectorySectionProps> = ({
  clients,
  activeRateBs,
  selectedClientId,
  onSelectClient,
  onSettleClientDebt,
  onUpdateClientNotes,
  onOpenNewClientModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DirectoryFilter>('TODOS');
  const [settlingClientId, setSettlingClientId] = useState<string | null>(null);
  const [settleAmountStr, setSettleAmountStr] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethodType>('PAGO_MOVIL_BS');
  const [settleBank, setSettleBank] = useState<VenezuelanBank>('Banesco (0134)');
  const [settleRef, setSettleRef] = useState('');

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const debtorsCount = clients.filter((c) => c.balanceUsd < -0.01).length;
  const creditCount = clients.filter((c) => c.balanceUsd > 0.01).length;

  const filteredClients = clients.filter((client) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchesName = client.name.toLowerCase().includes(q);
      const matchesPhone = client.phone.toLowerCase().includes(q);
      const matchesStyle = client.styleNotes.toLowerCase().includes(q);
      if (!matchesName && !matchesPhone && !matchesStyle) return false;
    }

    if (activeFilter === 'DEUDORES') return client.balanceUsd < -0.01;
    if (activeFilter === 'SALDO_FAVOR') return client.balanceUsd > 0.01;
    if (activeFilter === 'SOLVENTES') return Math.abs(client.balanceUsd) <= 0.01;
    if (activeFilter === 'VIP') return client.isVip;
    return true;
  });

  const handleOpenSettleDrawer = (client: ClientProfile) => {
    if (settlingClientId === client.id) {
      setSettlingClientId(null);
      return;
    }
    setSettlingClientId(client.id);
    setSettleAmountStr(String(Math.abs(client.balanceUsd)));
  };

  const handleSettleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeDecimalInput(e.target.value);
    if (cleaned !== null) {
      setSettleAmountStr(cleaned);
    }
  };

  const handleConfirmDebtSettlement = (client: ClientProfile, e: React.FormEvent) => {
    e.preventDefault();
    const maxDebt = Math.abs(client.balanceUsd);
    const parsed = roundToTwoDecimals(parseDecimalSafe(settleAmountStr));
    const finalUsd = parsed > 0 ? Math.min(maxDebt, parsed) : maxDebt;
    if (finalUsd <= 0) return;

    onSettleClientDebt(
      client.id,
      finalUsd,
      settleMethod,
      settleMethod === 'PAGO_MOVIL_BS' ? settleBank : undefined,
      settleMethod === 'PAGO_MOVIL_BS' ? settleRef || '9042' : undefined
    );
    setSettlingClientId(null);
    setSettleRef('');
  };

  return (
    <section
      aria-label="Directorio de clientes y libro de cuentas"
      className="flex flex-col gap-4"
    >
      {/* Top Filter & Search Card */}
      <div className="bg-[#13151A] border border-[#222631] rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg lg:text-xl font-extrabold text-[#F9FAFB] tracking-tight">
                Libro de Cuentas y Solvencia
              </h2>
              <span className="text-xs font-mono text-[#9CA3AF]">
                · {clients.length} clientes
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Auditoría rápida de cuentas por cobrar, saldos a favor y notas técnicas.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNewClientModal}
            className="px-4 py-2 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-bold text-[#F9FAFB] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Registrar Cliente</span>
          </button>
        </div>

        {/* Search Input + Priority Filter Tabs */}
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <label htmlFor="client-search-input" className="sr-only">
              Buscar cliente por nombre, teléfono o corte
            </label>
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="client-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, teléfono o corte (ej. Mid fade, Vizquel)..."
              className="w-full bg-[#1A1D24] border border-[#222631] focus:border-[#F59E0B] rounded-xl pl-10 pr-3 py-2.5 text-xs text-[#F9FAFB] placeholder:text-[#9CA3AF] focus:outline-none"
            />
          </div>

          <div
            role="group"
            aria-label="Filtros de solvencia de clientes"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'TODOS', label: `Todos (${clients.length})` },
                { id: 'DEUDORES', label: `Solo con Deuda (${debtorsCount})` },
                { id: 'SALDO_FAVOR', label: `Saldo a Favor (${creditCount})` },
                { id: 'SOLVENTES', label: 'Al Día' },
                { id: 'VIP', label: 'VIP' },
              ] as const
            ).map((f) => {
              const isSelected = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? f.id === 'DEUDORES'
                        ? 'bg-[#7F1D1D40] border-[#DC262650] text-[#EF4444]'
                        : 'bg-[#F59E0B] border-[#F59E0B] text-[#090A0D]'
                      : 'bg-[#1A1D24] border-[#222631] text-[#9CA3AF] hover:text-[#F9FAFB]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Client Cards List */}
      {filteredClients.length === 0 ? (
        <div className="bg-[#13151A] border border-[#222631] rounded-3xl p-8 text-center">
          <p className="text-sm font-bold text-[#F9FAFB]">
            Sin clientes que coincidan con la búsqueda
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Prueba limpiando el filtro activo o registra un cliente nuevo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const isExpanded = selectedClientId === client.id;
            const isSettling = settlingClientId === client.id;
            const owesMoney = client.balanceUsd < -0.01;
            const hasCredit = client.balanceUsd > 0.01;
            const absBalanceUsd = Math.abs(client.balanceUsd);
            const absBalanceBs = usdToBs(absBalanceUsd, activeRateBs);

            const whatsappUrl = buildWhatsAppUrl(
              client.phone,
              client.name,
              owesMoney ? 'COBRO_DEUDA' : 'SALDO_FAVOR',
              {
                amountUsd: absBalanceUsd,
                rateBs: activeRateBs,
              }
            );

            return (
              <article
                key={client.id}
                className="bg-[#13151A] border border-[#222631] rounded-3xl p-4 sm:p-5 transition-colors hover:border-[#374151]"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left: Client Identity, Style Notes & Financial State */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onSelectClient(isExpanded ? null : client.id)}
                        className="text-base font-extrabold text-[#F9FAFB] hover:text-[#F59E0B] transition-colors text-left inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{client.name}</span>
                        {client.isVip && (
                          <Star
                            className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]"
                            aria-label="Cliente VIP"
                          />
                        )}
                      </button>
                      <span aria-hidden="true" className="text-xs text-[#9CA3AF]">
                        ·
                      </span>
                      <span className="font-mono text-xs text-[#9CA3AF]">{client.phone}</span>
                      <span aria-hidden="true" className="text-xs text-[#9CA3AF]">
                        ·
                      </span>
                      <span className="text-xs text-[#9CA3AF]">{client.frequency}</span>
                    </div>

                    {/* Technical Style Notes */}
                    {editingNotesId === client.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          aria-label={`Notas de estilo de ${client.name}`}
                          className="flex-1 bg-[#1A1D24] border border-[#F59E0B] rounded-xl px-3 py-1.5 text-xs text-[#F9FAFB] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateClientNotes(client.id, notesDraft);
                            setEditingNotesId(null);
                          }}
                          className="px-3 py-1.5 bg-[#F59E0B] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardar</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-start gap-2">
                        <p className="text-xs text-[#F9FAFB]/90 leading-relaxed">
                          <span className="text-[#9CA3AF]">Fórmula: </span>
                          {client.styleNotes}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(client.id);
                            setNotesDraft(client.styleNotes);
                          }}
                          aria-label={`Editar notas de corte de ${client.name}`}
                          className="text-[#9CA3AF] hover:text-[#F9FAFB] p-0.5 shrink-0 cursor-pointer"
                          title="Editar fórmula de corte"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Semantic Solvency Pill & Note */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      {owesMoney && (
                        <>
                          <span className="font-mono font-extrabold px-2.5 py-1 rounded-xl bg-[#7F1D1D40] border border-[#DC262650] text-[#EF4444]">
                            Debe {formatUsd(absBalanceUsd)} ({formatBs(absBalanceBs)})
                          </span>
                          {client.balanceNote && (
                            <span className="text-[#9CA3AF]">{client.balanceNote}</span>
                          )}
                        </>
                      )}
                      {hasCredit && (
                        <>
                          <span className="font-mono font-extrabold px-2.5 py-1 rounded-xl bg-[#78350F40] border border-[#D9770650] text-[#F59E0B]">
                            Saldo a favor: +{formatUsd(absBalanceUsd)} ({formatBs(absBalanceBs)})
                          </span>
                          {client.balanceNote && (
                            <span className="text-[#9CA3AF]">{client.balanceNote}</span>
                          )}
                        </>
                      )}
                      {!owesMoney && !hasCredit && (
                        <span className="font-mono font-bold px-2.5 py-1 rounded-xl bg-[#064E3B40] border border-[#05966950] text-[#10B981]">
                          Al día · Solvente ($0.00) · Última visita: {client.lastVisitDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions (Liquidar Deuda, WhatsApp, Ver Historial) */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {owesMoney && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettleDrawer(client)}
                        className="min-h-[38px] px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-[#F9FAFB] rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Cobrar {formatUsd(absBalanceUsd)}</span>
                      </button>
                    )}

                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Escribir por WhatsApp a ${client.name}`}
                      title="Abrir WhatsApp del cliente"
                      className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-[#9CA3AF] hover:text-[#F9FAFB] inline-flex items-center justify-center transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onSelectClient(isExpanded ? null : client.id)}
                      aria-expanded={isExpanded}
                      className="min-h-[38px] px-3 py-1.5 bg-[#1A1D24] hover:bg-[#222631] border border-[#222631] rounded-xl text-xs font-semibold text-[#9CA3AF] hover:text-[#F9FAFB] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Historial ({client.history.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline Fast Debt Settlement Drawer with Decimal String Fix */}
                {isSettling && owesMoney && (
                  <form
                    onSubmit={(e) => handleConfirmDebtSettlement(client, e)}
                    className="mt-3 p-3.5 bg-[#1A1D24] border border-[#222631] rounded-2xl flex flex-col gap-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[#F9FAFB]">
                          Abonar o liquidar deuda de {client.name}:
                        </span>{' '}
                        <span className="font-mono text-[#EF4444] font-bold">
                          Total deuda {formatUsd(absBalanceUsd)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`settle-amount-${client.id}`}
                          className="text-[#9CA3AF]"
                        >
                          Monto a abonar ($):
                        </label>
                        <input
                          id={`settle-amount-${client.id}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={settleAmountStr}
                          onChange={handleSettleAmountChange}
                          className="w-20 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-[#F9FAFB] focus:border-[#F59E0B] focus:outline-none"
                        />
                        <span className="font-mono text-[#F59E0B]">
                          = {formatBs(usdToBs(parseDecimalSafe(settleAmountStr), activeRateBs))}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <select
                        aria-label="Método para liquidar deuda"
                        value={settleMethod}
                        onChange={(e) =>
                          setSettleMethod(e.target.value as PaymentMethodType)
                        }
                        className="bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs text-[#F9FAFB] focus:outline-none"
                      >
                        <option value="PAGO_MOVIL_BS">Pago Móvil (Bs)</option>
                        <option value="EFECTIVO_USD">Efectivo USD ($)</option>
                        <option value="DIGITAL_USD">Binance / Zinli ($)</option>
                      </select>

                      {settleMethod === 'PAGO_MOVIL_BS' && (
                        <>
                          <select
                            aria-label="Banco receptor"
                            value={settleBank}
                            onChange={(e) =>
                              setSettleBank(e.target.value as VenezuelanBank)
                            }
                            className="bg-[#090A0D] border border-[#222631] rounded-xl px-2 py-1.5 text-xs text-[#F9FAFB] focus:outline-none"
                          >
                            {VENEZUELAN_BANKS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            maxLength={6}
                            value={settleRef}
                            onChange={(e) =>
                              setSettleRef(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="Ref. 4 dígitos"
                            aria-label="Referencia bancaria de 4 dígitos"
                            className="w-28 bg-[#090A0D] border border-[#222631] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#F9FAFB] placeholder:text-[#9CA3AF] focus:outline-none"
                          />
                        </>
                      )}

                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#10B981] text-[#090A0D] rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar Solvencia</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Chronological Visit & Payment History */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#222631]">
                    <h3 className="text-xs font-bold text-[#9CA3AF] mb-2">
                      Historial Cronológico de Visitas y Pagos
                    </h3>
                    {client.history.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF]">
                        Aún no registra visitas previas cerradas.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {client.history.map((visit) => (
                          <div
                            key={visit.id}
                            className="p-3 bg-[#1A1D24] border border-[#222631] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-x-2">
                                <span className="font-mono text-[#F9FAFB] font-medium">
                                  {visit.date} · {visit.time}
                                </span>
                                <span aria-hidden="true" className="text-[#9CA3AF]">
                                  ·
                                </span>
                                <span className="text-[#F9FAFB] font-bold">
                                  {visit.serviceName}
                                </span>
                                <span aria-hidden="true" className="text-[#9CA3AF]">
                                  ·
                                </span>
                                <span className="font-mono text-[#9CA3AF]">
                                  Tasa día: {visit.rateBs.toFixed(2)} Bs
                                </span>
                              </div>
                              {visit.notes && (
                                <p className="text-[#9CA3AF] mt-0.5">{visit.notes}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 font-mono sm:justify-end">
                              <span className="text-[#F9FAFB] font-bold">
                                {formatUsd(visit.totalUsd)}
                              </span>
                              <span aria-hidden="true" className="text-[#9CA3AF]">
                                /
                              </span>
                              {visit.splits.map((s) => (
                                <span key={s.id} className="text-[#9CA3AF]">
                                  {s.method === 'PAGO_MOVIL_BS' &&
                                    `PM ${formatBs(s.amountBs || 0)} (${s.bank?.split(' ')[0]} #${s.referenceDigits})`}
                                  {s.method === 'EFECTIVO_USD' &&
                                    `Efectivo ${formatUsd(s.amountUsd)}`}
                                  {s.method === 'DIGITAL_USD' &&
                                    `${s.digitalProvider} ${formatUsd(s.amountUsd)}`}
                                  {s.method === 'PUNTO_EFECTIVO_BS' &&
                                    `Punto ${formatBs(s.amountBs || 0)}`}
                                  {s.method === 'FIADO_PENDIENTE' && (
                                    <span className="text-[#EF4444]">
                                      Fiado {formatUsd(s.amountUsd)}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
