import { OUTLINE_BUTTON_CLASS } from "@/components/ui/button-class";
import { DIVISI_LABEL } from "@/lib/labels";
import { ROLE_LABEL } from "@/lib/user-rules";
import type { Role } from "@/types/auth.types";
import type { ManagedUser } from "@/types/user.types";

export interface RowHighlight {
  id: number;
  tick: number;
}

interface UserTableProps {
  users: ManagedUser[];
  selfId: number;
  highlight: RowHighlight | null;
  onEdit: (user: ManagedUser) => void;
  onReset: (user: ManagedUser) => void;
}

const ACTION_CLASS = `${OUTLINE_BUTTON_CLASS} h-9 px-4 text-xs whitespace-nowrap`;

const ROLE_BADGE: Record<Role, string> = {
  SUPERADMIN: "bg-ink text-mist",
  TEAM_MAIN_OFFICE: "border border-ink/20 bg-mist text-ink",
  MANAGER_MAIN_OFFICE: "border border-ink/20 bg-mist text-ink",
  FINANCE_MAIN_OFFICE: "border border-ink/20 bg-mist text-ink",
  FINANCE_MANAGER_MAIN_OFFICE: "border border-ink/20 bg-mist text-ink",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${ROLE_BADGE[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex animate-pop-in items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${active ? "bg-green text-ink" : "bg-ink/10 text-ink"}`}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function divisiText(user: ManagedUser): string {
  return user.divisi === null ? "Tanpa divisi" : DIVISI_LABEL[user.divisi];
}

function rowKey(user: ManagedUser, highlight: RowHighlight | null): string {
  return `${user.id}-${highlight?.id === user.id ? highlight.tick : 0}`;
}

function rowAnimation(
  user: ManagedUser,
  highlight: RowHighlight | null,
): string {
  return highlight?.id === user.id
    ? "animate-pop-in bg-aqua/15"
    : "animate-fade-up";
}

function Actions({
  user,
  selfId,
  onEdit,
  onReset,
}: {
  user: ManagedUser;
  selfId: number;
  onEdit: (user: ManagedUser) => void;
  onReset: (user: ManagedUser) => void;
}) {
  if (user.id === selfId) {
    return (
      <span className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
        Akun Anda
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => onEdit(user)}
        aria-label={`Ubah akun ${user.fullName}`}
        className={ACTION_CLASS}
      >
        Ubah
      </button>
      <button
        type="button"
        onClick={() => onReset(user)}
        aria-label={`Reset password ${user.fullName}`}
        className={ACTION_CLASS}
      >
        Reset password
      </button>
    </>
  );
}

export function UserTable({
  users,
  selfId,
  highlight,
  onEdit,
  onReset,
}: UserTableProps) {
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
        {users.map((user, index) => (
          <li
            key={rowKey(user, highlight)}
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
            className={`flex flex-col rounded-2xl border border-ink/10 bg-mist p-4 ${rowAnimation(user, highlight)}`}
          >
            <p className="font-semibold wrap-break-word">{user.fullName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <ActiveBadge active={user.isActive} />
            </div>
            <dl className="mt-3 text-sm">
              <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
                Divisi
              </dt>
              <dd>{divisiText(user)}</dd>
            </dl>
            <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:[&>button]:flex-1">
              <Actions
                user={user}
                selfId={selfId}
                onEdit={onEdit}
                onReset={onReset}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
              <th scope="col" className="py-3 pr-4 font-medium">
                No
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Nama lengkap
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Role
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Divisi
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Status
              </th>
              <th scope="col" className="py-3 font-medium">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={rowKey(user, highlight)}
                style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                className={`border-b border-ink/10 transition-colors duration-200 last:border-b-0 hover:bg-teal/5 ${rowAnimation(user, highlight)}`}
              >
                <td className="py-4 pr-4 font-mono text-xs text-ink/70">
                  {index + 1}
                </td>
                <td className="py-4 pr-4 font-semibold wrap-break-word">
                  {user.fullName}
                </td>
                <td className="py-4 pr-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="py-4 pr-4 whitespace-nowrap">
                  {divisiText(user)}
                </td>
                <td className="py-4 pr-4">
                  <ActiveBadge active={user.isActive} />
                </td>
                <td className="py-4 pr-2">
                  <div className="flex items-center justify-end gap-2">
                    <Actions
                      user={user}
                      selfId={selfId}
                      onEdit={onEdit}
                      onReset={onReset}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
