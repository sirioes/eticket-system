export const ACCESS_TOKEN_COOKIE = 'access_token';

export const ACCESS_TOKEN_TTL = '12h';

export const INVALID_SESSION_MESSAGE = 'Sesi tidak valid, silakan masuk lagi';

export const LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

export const CHANGE_PASSWORD_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

export const FORBIDDEN_MESSAGE = 'Anda tidak memiliki akses ke fitur ini';