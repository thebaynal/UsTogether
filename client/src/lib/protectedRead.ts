type ReadFailure = { message: string; code?: string; status?: number; statusCode?: number | string };

const deniedCodes = new Set([
  'PGRST116', '42501', 'PGRST301', 'PGRST302', 'PGRST303',
  'bad_jwt', 'session_not_found', 'session_expired', 'user_not_found',
  'no_authorization', 'not_authenticated', 'insufficient_aal'
]);

function readStatus(cause: { status?: unknown; statusCode?: unknown }, status?: number) {
  const value = status ?? cause.status ?? cause.statusCode;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

// Preserve structured denial information. Plain Error(message) would make a
// revoked membership indistinguishable from a temporary offline refresh.
export class ProtectedReadError extends Error {
  readonly code: string | null;
  readonly status: number | null;

  constructor(cause: ReadFailure, status?: number) {
    super(cause.message);
    this.name = 'ProtectedReadError';
    this.code = cause.code ?? null;
    this.status = readStatus(cause, status);
  }
}

export function raiseProtectedRead(error: ReadFailure | null, status?: number): asserts error is null {
  if (error) throw new ProtectedReadError(error, status);
}

export function isProtectedReadDenied(cause: unknown) {
  if (!cause || typeof cause !== 'object') return false;
  const failure = cause as { code?: unknown; status?: unknown; statusCode?: unknown };
  const status = readStatus(failure);
  return status === 401 || status === 403 || (typeof failure.code === 'string' && deniedCodes.has(failure.code));
}
