import type { StageAction } from './ticket-stage-flow';

export const REASON_MIN_LENGTH = 10;

export const REASON_MAX_LENGTH = 500;

const REASON_ACTIONS: readonly StageAction[] = ['TERIMA', 'TOLAK'];

export function requiresReason(action: StageAction): boolean {
  return REASON_ACTIONS.includes(action);
}

export function isReasonLengthValid(reason: string): boolean {
  const length = [...reason].length;
  return length >= REASON_MIN_LENGTH && length <= REASON_MAX_LENGTH;
}
