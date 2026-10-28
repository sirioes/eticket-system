"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

function tabDomId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

function panelDomId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

interface TabListProps {
  idPrefix: string;
  label: string;
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

export function TabList({
  idPrefix,
  label,
  tabs,
  active,
  onChange,
}: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const list = listRef.current;
    const tab = tabRefs.current.get(active);
    if (!list || !tab) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    list.scrollTo({
      left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [active]);

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    switch (event.key) {
      case "ArrowRight":
        target = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        target = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    tabRefs.current.get(tabs[target].id)?.focus();
    onChange(tabs[target].id);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain border-b border-ink/10 px-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.id, node);
              else tabRefs.current.delete(tab.id);
            }}
            id={tabDomId(idPrefix, tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelDomId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
            className={`-mb-px flex h-14 shrink-0 snap-start items-center gap-2 border-b-2 px-4 text-sm whitespace-nowrap -outline-offset-2 transition-colors duration-200 ease-smooth ${
              selected
                ? "border-teal font-semibold text-teal"
                : "border-transparent font-medium text-ink/70 hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${
                  selected ? "bg-teal text-mist" : "bg-ink/10 text-ink/70"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  idPrefix: string;
  id: string;
  active: boolean;
  children: ReactNode;
}

export function TabPanel({ idPrefix, id, active, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelDomId(idPrefix, id)}
      aria-labelledby={tabDomId(idPrefix, id)}
      hidden={!active}
      className="p-5 max-md:animate-fade-in sm:p-7 md:animate-tab-in"
    >
      {children}
    </div>
  );
}
