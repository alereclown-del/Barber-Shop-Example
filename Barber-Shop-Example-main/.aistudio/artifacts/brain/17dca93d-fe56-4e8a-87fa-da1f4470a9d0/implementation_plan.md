# BARBERFLOW — Refactorización Visual Dark Grooming y Precisión Decimal Multimoneda

Transformación integral de la experiencia de usuario hacia una estética **Dark Grooming / Brutalista Editorial** Mobile-First y adaptativa a escritorio, acompañada de una refactorización en todos los campos monetarios para garantizar la escritura fluida de decimales con punto (`.`) o coma (`,`) y redondeo financiero exacto sin alterar la lógica de negocio ni la persistencia existente.

## User Review & Critical Decisions

> [!IMPORTANT]
> Se han consolidado las decisiones de producto confirmadas para guiar la refactorización sin pérdida de funcionalidad ni regresiones en el motor contable.

- **Confirmed Decision 1 — Acción del Botón Flotante Central (`+`)**: Al presionar el botón circular ámbar elevado en el centro de la barra inferior, se desplegará un **Menú de Acción Rápida** con dos opciones directas: **Nuevo Turno Rápido** y **Cobro Express** (seleccionando al cliente en silla o el próximo turno activo).
- **Confirmed Decision 2 — Alcance de la Pestaña `Ajustes`**: La cuarta vista de la navegación inferior centralizará el **Control de Tasas de Cambio (`BCV`, `Paralelo`, `Manual`)**, la visualización/edición rápida del **Catálogo de Servicios en USD** y las acciones de **Respaldo / Restauración de Datos de Demostración**.
- **Confirmed Decision 3 — Disposición Adaptativa (Mobile-First + Desktop Grid)**: En móviles se prioriza la ergonomía de una sola mano con carrusel de fechas, filtros táctiles y barra flotante inferior; en pantallas de escritorio se expande a una **grilla amplia multi-columna** manteniendo la barra inferior de acceso rápido y el lenguaje visual Dark Grooming.

---

## 1. Overview & Core Concept

- **What It Does**: Centraliza la operación diaria de una barbería venezolana en un entorno ágil: agenda con carrusel de días, estado de citas en tiempo real, directorio de clientes con control estricto de solvencia (quién está solvente, quién dejó saldo a favor y quién tiene cuentas por cobrar) y caja registradora multimoneda (`Pago Móvil Bs`, `Efectivo USD` con cálculo de vuelto, `Zinli / Binance USDT / Zelle`, `Punto de Venta Bs` y `Fiado`).
- **Target Audience / Persona**: Barberos principales y administradores de barberías en Venezuela que operan desde el teléfono o estación de cobro con una mano ocupada y necesitan precisión matemática inmediata entre Dólares (`$`) y Bolívares (`Bs`).
- **Key Value**: Elimina por completo el bloqueo al digitar decimales (`.` o `,`) en tasas y montos parciales, mientras eleva la interfaz a un estándar visual masculino, técnico y de alto contraste donde cada estado financiero se identifica en menos de un segundo.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Actualización Instantánea de Tasa del Día**: En el header fijo (`BARBERFLOW`), el barbero toca el widget `TASA BCV: 45.50 Bs/$`, escribe libremente un nuevo valor con coma o punto (ej. `46,25` o `52.80`), alterna entre `BCV`, `Paralelo` o `Manual` y toda la aplicación recalcula los equivalentes en Bolívares al instante.
  2. **Navegación por Carrusel de Días y Píldoras de Estado**: Debajo del header, el usuario desliza el carrusel horizontal de fechas (píldoras verticales con mes `NOV`, número en grande `05` y día `JUE`, iluminando el activo en ámbar `#F59E0B` con texto negro y bordes `rounded-2xl`) y filtra con un toque entre `[ Todos ]`, `[ Por Atender ]`, `[ En Silla ]` y `[ Deudores / Cuentas x Cobrar ]`.
  3. **Tarjetas de Turno y Cobro Multimoneda Sin Fricción**: Cada tarjeta (`rounded-2xl` / `rounded-3xl`) exhibe la hora en monoespaciado (`10:30 AM`), badge de estado (`En espera`, `Cortando`, `Finalizado`), cliente, servicio, bloque dual `$12.00 | Bs. 546,00`, badge de solvencia (`PAGADO` en verde esmeralda o `DEUDA / FIADO` en rojo carmín), botón directo de WhatsApp (`"Hermano, tienes turno agendado hoy a las..."`) y botón **Cobrar / Checkout**.
  4. **Modal de Cobro con Inputs Decimales Desacoplados**: Dentro del modal de cobro, los campos de monto en `USD` y `Bs` utilizan estado en texto (`string`) con `type="text"` e `inputMode="decimal"`, permitiendo tipear puntos o comas libremente sin que el cursor salte ni se borre el separador decimal. Incluye calculadora de vuelto en efectivo (1 toque para `"Entregar vuelto"` o `"Guardar como Saldo a Favor"`), verificador inteligente de capturas de Pago Móvil y barra de progreso de solvencia antes de confirmar.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Dark Grooming / Brutalista Editorial** — superficies oscuras profundas, geometría curva pronunciada en tarjetas operativas (`rounded-2xl` / `rounded-3xl`), bordes definidos de `1px solid` y acentos cálidos en ámbar/cobre quemado. Prohibición absoluta de degradados violetas, cian o neón.
  - *Color Palette & Mood*:
    - **Background Principal (`--background`)**: `#090A0D` (Negro asfalto profundo).
    - **Tarjetas y Contenedores (`--card`)**: `#13151A` con bordes nítidos `1px solid #222631`.
    - **Superficie de Inputs y Modales Secundarios (`--input`)**: `#1A1D24`.
    - **Acento Primario (`--primary` / `--accent`)**: Ámbar Dorado / Cobre Quemado (`#F59E0B` / `#D97706`) con texto oscuro contrastante (`#090A0D`) en botones primarios y estados activos.
    - **Texto Principal (`--foreground`)**: Blanco tiza (`#F9FAFB`).
    - **Texto Secundario (`--muted-foreground`)**: Gris plata (`#9CA3AF`).
    - **Estados Semánticos de Solvencia**:
      - *Solvente / Pagado*: Texto `#10B981`, fondo `#064E3B40`, borde `#05966950`.
      - *Deudor / Fiado*: Texto `#EF4444`, fondo `#7F1D1D40`, borde `#DC262650`.
      - *Abono Parcial / Saldo a Favor*: Texto `#F59E0B`, fondo `#78350F40`, borde `#D9770650`.
  - *Typography & Hierarchy*:
    - **Títulos, UI y Navegación**: `Plus Jakarta Sans` en pesos SemiBold (`600`) y Bold (`700`) para jerarquía editorial limpia.
    - **Regla Financiera Estricta**: `JetBrains Mono` (`font-mono tabular-nums`) obligatoria en todos los montos en `$`, montos en `Bs`, tasas de cambio, horas de turnos y dígitos de referencia bancaria.
  - *Component Styling & Layout*:
    - Header superior fijo con marca `BARBERFLOW`, indicador del barbero activo y popover interactivo de tasa + calculadora rápida.
    - Barra de navegación inferior fija (`fixed bottom-0 left-0 right-0 bg-[#13151A] border-t border-[#222631]`) con 4 secciones (`Agenda`, `Clientes`, `Caja/Finanzas`, `Ajustes`) y el botón flotante central (`+`) elevado en ámbar (`bg-amber-500 hover:bg-amber-400 text-black`).

- **Interactive Feedback & Motion**:
  - Transiciones rápidas (`150ms`) en cambios de pestaña, filtros y apertura de modales.
  - Indicadores visuales claros de validación matemática en el modal de cobro (barra de progreso que pasa de ámbar a verde esmeralda al cubrir el 100% del servicio).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Estado Textual Desacoplado (`string`) en Todos los Inputs Monetarios**
  - *Chosen Approach*: Mantener un estado de cadena (`string`) para cada input de monto o tasa (`type="text" inputMode="decimal" placeholder="0.00"`), normalizando comas a puntos (`rawValue.replace(',', '.')`) y validando con `/^\d*\.?\d*$/` antes de sincronizar el valor numérico mediante `parseDecimalSafe` y `roundToTwoDecimals`.
  - *Why*: En navegadores móviles y de escritorio, enlazar `<input type="number">` directamente a un estado numérico destruye el punto o la coma apenas el usuario escribe `"12."` o `"45,"` porque ` parseFloat("12.") === 12`. El estado en `string` permite escribir decimales con total naturalidad.
  - *Alternatives Considered*: Usar `<input type="number" step="0.01">` con parseo en `onBlur`; descartado porque impide recalcular en vivo el equivalente en Bolívares mientras el barbero escribe cada dígito.

- **Decision 2: Redondeo Financiero con `Number.EPSILON` en Toda Operación Multimoneda**
  - *Chosen Approach*: Incorporar `roundToTwoDecimals` y `parseDecimalSafe` en el núcleo de conversión (`usdToBs`, `bsToUsd`, `summarizeSplits`, `calculateCashCloseout`) preservando intactas todas las firmas e interfaces existentes.
  - *Why*: Evita residuos de coma flotante (como `19.999999999999996` o diferencias de `0.01` al dividir pagos mixtos entre Pago Móvil Bs y Efectivo USD) sin romper ningún consumidor actual del estado.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   PERSISTENT STATE & FINANCIAL ENGINE                      │
│  • LocalStorage Sync (Rates, Appointments, Clients, Service Catalog)       │
│  • Pure Math Helpers: roundToTwoDecimals(), parseDecimalSafe(),            │
│    usdToBs(), bsToUsd(), summarizeSplits(), calculateCashCloseout()        │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     BARBERFLOW APPLICATION SHELL                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Global Header Bar ("BARBERFLOW" + Barber Badge + Rate Popover)    │  │
│  │    • String-backed decimal input ("45.50" / "45,50") + Quick Calc    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Top Date Carousel (OCT/NOV Vertical Pills) + Segmented Status Bar │  │
│  │    • [ Todos ] [ Por Atender ] [ En Silla ] [ Deudores / x Cobrar ]  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                      │
│        ┌────────────────────────────┼────────────────────────────┐         │
│        ▼                            ▼                            ▼         │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐  │
│  │  AGENDA & TURNOS   │   │ LIBRO DE CUENTAS   │   │  CAJA & FINANZAS   │  │
│  │  • Rounded-2xl     │   │ • Instant Search   │   │  • Daily Closeout  │  │
│  │    Editorial Cards │   │ • "Solo con Deuda" │   │  • Pocket Totals   │  │
│  │  • Dual $ / Bs     │   │   Priority Filter  │   │    (PM Bs, Cash $, │  │
│  │  • Solvency Badges │   │ • Debt Settlement  │   │    Zinli/USDT,     │  │
│  │  • WhatsApp CTA    │   │   with Decimal Fix │   │    Street Debt)    │  │
│  └─────────┬──────────┘   └─────────┬──────────┘   └────────────────────┘  │
│            │                        │                                      │
│            └────────────┬───────────┘                                      │
│                         ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 3. Multi-Currency Checkout & Quick Action Modals                     │  │
│  │    • String-to-Decimal Split Inputs (Pago Móvil Bs, Efectivo USD,    │  │
│  │      Zinli/Binance/Zelle, Punto Bs, Saldo a Favor, Dejar Fiado)      │  │
│  │    • 1-Tap Change Calculator ("Entregar vuelto" vs "Saldo a Favor")  │  │
│  │    • Smart Receipt OCR Verifier & Progress Validation Bar            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 4. Fixed Bottom Floating Bar                                         │  │
│  │    [ Agenda ]   [ Clientes ]   ( + )   [ Caja/Finanzas ]  [ Ajustes ]│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Se conservan íntegramente todas las entidades y propiedades existentes (`ExchangeRates`, `AppointmentItem`, `ClientProfile`, `PaymentSplitEntry`, `VisitRecord`, `ExtractedReceiptData`).
  - Cada formulario o fila de pago mixto mantiene un diccionario o estado local de cadenas (`Record<string, { usdStr: string; bsStr: string; tenderedStr: string }>`) sincronizado con el modelo numérico subyacente, garantizando que el usuario pueda escribir `"12."`, `"12,5"`, `"0.50"` o borrar y reescribir sin pérdida del separador decimal.

- **Interactive Component & State Mapping**:
  - **Popover de Tasa y Calculadora Rápida**: Inputs `type="text" inputMode="decimal"` con normalización de coma a punto; actualiza la tasa global activa (`BCV`, `PARALELO`, `PERSONALIZADA`) y recalcula todos los montos en Bolívares en tiempo real.
  - **Carrusel de Fechas y Filtros Rápidos**: Filtra la lista de turnos por fecha seleccionada y por estado (`Todos`, `Por Atender`, `En Silla`, o acceso directo a `Deudores / Cuentas x Cobrar`).
  - **Modal de Cobro Multimoneda**: Permite pagos simples de 1 toque o pagos mixtos editando libremente decimales en `USD` o `Bs`, calcula el vuelto exacto cuando se recibe un billete mayor, valida capturas de Pago Móvil y muestra la barra de progreso de cobertura antes de confirmar el cierre del turno.
  - **Botón Flotante Central (`+`) y Vista de Ajustes**: El botón `+` abre el selector rápido entre **Nuevo Turno Rápido** y **Cobro Express** (abriendo directamente el checkout del turno en silla o próximo en espera); la pestaña **Ajustes** permite editar tasas, consultar precios del catálogo y restaurar o respaldar los datos operativos.
