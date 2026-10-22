export const STAGE_ACTION_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

export const COMMENT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

export const EXPORT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
