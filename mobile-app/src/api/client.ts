export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') ?? '';
export const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface WorkbookDownload {
  filename: string;
  bytes: Uint8Array;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: object;
  signal?: AbortSignal;
  responseType?: 'xlsx';
}

export type ApiRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;

const statusMessages: Record<number, string> = {
  400: 'Revisa los datos ingresados.',
  401: 'La sesión venció o las credenciales son incorrectas.',
  403: 'Tu cuenta no tiene permiso para esta operación.',
  404: 'No se encontró el registro solicitado.',
  409: 'La operación entra en conflicto con los datos actuales. Actualiza y revisa los datos.',
};

export async function request<T>(
  path: string,
  { method = 'GET', body, signal, responseType }: RequestOptions = {},
  token?: string,
): Promise<T> {
  if (!/^https?:\/\//i.test(apiUrl)) {
    throw new Error('Configura EXPO_PUBLIC_API_URL en .env.local y vuelve a cargar la app.');
  }

  const headers = new Headers({ Accept: responseType === 'xlsx' ? `${xlsxMime}, application/json` : 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 15000);
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method, headers, signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && responseType === 'xlsx' && contentType.split(';')[0].trim().toLowerCase() === xlsxMime) {
      const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/i)?.[1] ?? 'reporte.xlsx';
      payload = { filename, bytes: new Uint8Array(await response.arrayBuffer()) } satisfies WorkbookDownload;
    } else if (response.status !== 204 && /[/+]json\b/i.test(contentType)) {
      payload = await response.json().catch(() => undefined);
    }
  } catch {
    throw new Error('No se pudo conectar a SupaClothes. Verifica la red y el servidor.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }

  if (!response.ok) {
    const details = payload as { detail?: unknown; message?: unknown } | undefined;
    const message = details?.detail ?? details?.message;
    const visible = typeof message === 'string' && message.trim() && message !== 'No message available';
    throw new ApiError(response.status, visible && response.status < 500
      ? message
      : statusMessages[response.status] ?? `La API devolvió un error (${response.status}).`);
  }
  if (responseType === 'xlsx' && !(payload as WorkbookDownload | undefined)?.bytes?.byteLength) {
    throw new Error('La API no devolvió un archivo Excel válido.');
  }
  if (response.status !== 204 && payload === undefined) {
    throw new Error('La API devolvió una respuesta inesperada.');
  }
  return payload as T;
}
