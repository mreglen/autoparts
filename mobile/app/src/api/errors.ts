export type ApiErrorKind = 'http' | 'network' | 'timeout';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly detail: string | null;

  constructor(kind: ApiErrorKind, status: number, detail: string | null) {
    super(describe(kind, status, detail));
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

function describe(kind: ApiErrorKind, status: number, detail: string | null): string {
  if (detail) return detail;
  if (kind === 'timeout') return 'Сервер не отвечает, попробуйте ещё раз';
  if (kind === 'network') return 'Нет связи с сервером';
  if (status === 403) return 'Недостаточно прав для этого действия';
  if (status === 401) return 'Сессия истекла, войдите заново';
  return `Ошибка сервера (${status})`;
}

/** Ответ бэкенда: `{ detail: string }`, а на 422 — массив ошибок полей. */
export async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) return 'Проверьте правильность данных';
    return null;
  } catch {
    return null;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Неизвестная ошибка';
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
