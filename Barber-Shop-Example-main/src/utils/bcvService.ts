/**
 * Servicio comunitario de alta disponibilidad para tasas de cambio en Venezuela (DolarApi)
 * Consulta en tiempo real:
 * - Dólar Oficial BCV: GET https://ve.dolarapi.com/v1/dolares/oficial
 * - Euro Oficial BCV: GET https://ve.dolarapi.com/v1/euros/oficial (con fallback a /v1/monedas/eur)
 * - Dólar Paralelo: GET https://ve.dolarapi.com/v1/dolares/paralelo
 */

export interface BcvApiResult {
  usdOfficial: number | null;
  eurOfficial: number | null;
  paralelo: number | null;
  lastUpdated: string;
  source: 'dolarapi' | 'fallback';
  error?: string;
}

interface DolarApiResponse {
  moneda?: string;
  fuente?: string;
  nombre?: string;
  compra?: number | null;
  venta?: number | null;
  promedio?: number | null;
  fechaActualizacion?: string;
}

const DOLAR_OFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const EURO_OFICIAL_URLS = [
  'https://ve.dolarapi.com/v1/euros/oficial',
  'https://ve.dolarapi.com/v1/monedas/eur',
  'https://ve.dolarapi.com/v1/euros',
];
const DOLAR_PARALELO_URL = 'https://ve.dolarapi.com/v1/dolares/paralelo';

function formatUpdateTimestamp(isoDateStr?: string): string {
  try {
    if (!isoDateStr) {
      const now = new Date();
      return `Hoy · ${now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) {
      const now = new Date();
      return `Hoy · ${now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const day = d.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  } catch {
    return 'Hoy · En tiempo real';
  }
}

async function fetchWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Consulta las tasas oficiales BCV (USD y EUR) y Paralelo de forma paralela.
 * Si falla, retorna valores nulos con source 'fallback' para que la app conserve
 * las tasas guardadas en LocalStorage o valores semilla.
 */
export async function fetchLiveExchangeRates(): Promise<BcvApiResult> {
  try {
    // 1. Fetch USD Oficial
    const usdPromise = fetchWithTimeout<DolarApiResponse>(DOLAR_OFICIAL_URL);

    // 2. Fetch EUR Oficial probando las rutas disponibles
    const eurPromise = (async () => {
      for (const url of EURO_OFICIAL_URLS) {
        const res = await fetchWithTimeout<DolarApiResponse | DolarApiResponse[]>(url);
        if (res) {
          if (Array.isArray(res)) {
            const foundOficial = res.find((r) => r.fuente === 'oficial') || res[0];
            return foundOficial || null;
          }
          return res;
        }
      }
      return null;
    })();

    // 3. Fetch Paralelo
    const paraleloPromise = fetchWithTimeout<DolarApiResponse>(DOLAR_PARALELO_URL);

    const [usdData, eurData, paraleloData] = await Promise.all([
      usdPromise,
      eurPromise,
      paraleloPromise,
    ]);

    const usdVal = usdData?.promedio ?? usdData?.venta ?? null;
    const eurVal = eurData?.promedio ?? eurData?.venta ?? null;
    const paraleloVal = paraleloData?.promedio ?? paraleloData?.venta ?? null;

    const hasAny = usdVal !== null || eurVal !== null || paraleloVal !== null;

    if (!hasAny) {
      return {
        usdOfficial: null,
        eurOfficial: null,
        paralelo: null,
        lastUpdated: 'Sin conexión (Tasas locales)',
        source: 'fallback',
        error: 'No se pudo conectar con DolarApi',
      };
    }

    const latestIso = usdData?.fechaActualizacion || eurData?.fechaActualizacion || paraleloData?.fechaActualizacion;

    return {
      usdOfficial: usdVal ? Math.round(usdVal * 100) / 100 : null,
      eurOfficial: eurVal ? Math.round(eurVal * 100) / 100 : null,
      paralelo: paraleloVal ? Math.round(paraleloVal * 100) / 100 : null,
      lastUpdated: formatUpdateTimestamp(latestIso),
      source: 'dolarapi',
    };
  } catch (error: any) {
    return {
      usdOfficial: null,
      eurOfficial: null,
      paralelo: null,
      lastUpdated: 'Modo Offline',
      source: 'fallback',
      error: error?.message || 'Error desconocido al consultar tasas',
    };
  }
}

