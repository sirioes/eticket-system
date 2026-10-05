"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DIVISI_LABEL } from "@/lib/labels";
import { LogoutButton } from "@/components/layout/logout-button";
import type { SessionUser } from "@/types/auth.types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  },
];

const PASSWORD_ITEM: NavItem = {
  href: "/ganti-password",
  label: "Ganti Password",
  icon: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
};

const ACTIVE_CLASS =
  "bg-haze text-teal lg:before:absolute lg:before:-top-5 lg:before:right-0 lg:before:size-5 lg:before:bg-[radial-gradient(circle_at_0_0,transparent_1.25rem,var(--color-haze)_calc(1.25rem+0.5px))] lg:after:absolute lg:after:right-0 lg:after:-bottom-5 lg:after:size-5 lg:after:bg-[radial-gradient(circle_at_0_100%,transparent_1.25rem,var(--color-haze)_calc(1.25rem+0.5px))]";

function initials(fullName: string): string {
  const words = fullName.split(" ").filter((word) => !/\d/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-200 lg:rounded-r-none ${active ? ACTIVE_CLASS : "text-mist/80 hover:bg-mist/10 hover:text-mist"}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      >
        <path d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );
}

interface SidebarProps {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-ink/40 transition-opacity duration-300 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-teal pt-[max(2rem,env(safe-area-inset-top))] pb-6 text-mist transition-transform duration-300 ease-smooth lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex animate-fade-in flex-col items-center px-6 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-mist text-xl font-semibold text-teal ring-4 ring-mist/20">
            {initials(user.fullName)}
          </span>
          <p className="mt-3 font-semibold">{user.fullName}</p>
          <p className="mt-0.5 font-mono text-xs tracking-[0.15em] text-mist/75 uppercase">
            {user.divisi ? `Divisi ${DIVISI_LABEL[user.divisi]}` : "Superadmin"}
          </p>
        </div>

        <nav aria-label="Menu utama" className="mt-10 flex-1 px-4 lg:pr-0">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item, index) => (
              <li
                key={item.href}
                style={{ animationDelay: `${120 + index * 50}ms` }}
                className="animate-fade-up"
              >
                <NavLink
                  item={item}
                  active={pathname === item.href}
                  onClick={onClose}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-1 border-t border-mist/15 px-4 pt-4 lg:pr-0">
          <div className="animate-fade-up [animation-delay:200ms]">
            <NavLink
              item={PASSWORD_ITEM}
              active={pathname === PASSWORD_ITEM.href}
              onClick={onClose}
            />
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}