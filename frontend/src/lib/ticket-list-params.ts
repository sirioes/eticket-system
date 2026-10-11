import { DIVISI_LABEL, STAGE_FILTER_LABEL } from "@/lib/labels";
import type { Divisi } from "@/types/auth.types";
import type { TicketListFilters, TicketStage } from "@/types/ticket.types";

export const TICKET_PAGE_SIZE = 10;

const MAX_TICKET_PAGE = 1000;

export const SEARCH_MAX_LENGTH = 100;

const SEARCH_PATTERN = /^[A-Za-z0-9-]*$/;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STAGES = Object.keys(STAGE_FILTER_LABEL) as TicketStage[];

const DIVISIONS = Object.keys(DIVISI_LABEL) as Divisi[];

export interface TicketListState {
  filters: TicketListFilters;
  page: number;
}

interface ReadableParams {
  get(name: string): string | null;
}

function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidSearch(value: string): boolean {
  return value.length <= SEARCH_MAX_LENGTH && SEARCH_PATTERN.test(value);
}

export function isValidDateRange(dateFrom?: string, dateTo?: string): boolean {
  return dateFrom === undefined || dateTo === undefined || dateFrom <= dateTo;
}

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function pickDate(value: string | null): string | undefined {
  return value !== null && isCalendarDate(value) ? value : undefined;
}

export function readTicketListState(params: ReadableParams): TicketListState {
  const search = params.get("search")?.trim() ?? "";
  const dateFrom = pickDate(params.get("dateFrom"));
  const dateTo = pickDate(params.get("dateTo"));
  const rawPage = Number(params.get("page"));
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= MAX_TICKET_PAGE ? rawPage : 1;
  const rangeIsValid = isValidDateRange(dateFrom, dateTo);

  return {
    page,
    filters: {
      search: search !== "" && isValidSearch(search) ? search : undefined,
      status: pick(params.get("status"), STAGES),
      divisi: pick(params.get("divisi"), DIVISIONS),
      dateFrom: rangeIsValid ? dateFrom : undefined,
      dateTo: rangeIsValid ? dateTo : undefined,
    },
  };
}

export function writeTicketListState(state: TicketListState): string {
  const params = new URLSearchParams();
  const { search, status, divisi, dateFrom, dateTo } = state.filters;
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (divisi) params.set("divisi", divisi);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function activeFilterCount(filters: TicketListFilters): number {
  return [filters.status, filters.divisi, filters.dateFrom ?? filters.dateTo].filter(
    (value) => value !== undefined,
  ).length;
}

export function hasAnyFilter(filters: TicketListFilters): boolean {
  return filters.search !== undefined || activeFilterCount(filters) > 0;
}

export type PageSlot = number | "gap";

export function pageSlots(current: number, total: number): PageSlot[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const slots: PageSlot[] = [];
  for (const page of sorted) {
    const previous = slots.at(-1);
    if (typeof previous === "number" && page - previous > 1) slots.push("gap");
    slots.push(page);
  }
  return slots;
}
