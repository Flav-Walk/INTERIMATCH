import { useEffect, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage, type Role } from "../services/session";
import {
  adminUserName,
  listAdminUsers,
  roleOptions,
  updateAdminUserRole,
  type AdminUser,
} from "../services/admin";
import "../styles/admin.css";

interface TableProps {
  users: AdminUser[];
  currentUserId: string;
  drafts: Record<string, Role>;
  savingId: string | null;
  savedId: string | null;
  onRoleChange: (userId: string, role: Role) => void;
  onSave: (user: AdminUser) => void;
}

export function AdminUsersTable({
  users,
  currentUserId,
  drafts,
  savingId,
  savedId,
  onRoleChange,
  onSave,
}: TableProps) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Utilisateur</th>
            <th scope="col">Email</th>
            <th scope="col">Rôle</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const selected = drafts[user.id] ?? user.role;
            const ownAccount = user.id === currentUserId;
            const saving = savingId === user.id;
            const saved = savedId === user.id;
            return (
              <tr key={user.id}>
                <td>
                  <strong>{adminUserName(user)}</strong>
                  {ownAccount && (
                    <span className="admin-you">Votre compte</span>
                  )}
                </td>
                <td>{user.email}</td>
                <td>
                  <label className="admin-role-field">
                    <span className="sr-only">Rôle de {user.email}</span>
                    <select
                      value={selected}
                      disabled={ownAccount || saving}
                      onChange={(event) =>
                        onRoleChange(user.id, event.target.value as Role)
                      }
                      aria-describedby={
                        ownAccount ? `self-role-${user.id}` : undefined
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {ownAccount && (
                    <small id={`self-role-${user.id}`}>
                      Protégé contre l’auto-rétrogradation
                    </small>
                  )}
                </td>
                <td>
                  <div className="admin-action">
                    <button
                      className="secondary-button admin-save"
                      type="button"
                      disabled={ownAccount || saving || selected === user.role}
                      onClick={() => onSave(user)}
                    >
                      {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    {saved && (
                      <span className="admin-saved" role="status">
                        <Check size={16} aria-hidden="true" /> Enregistré
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminLoading() {
  return (
    <div
      className="admin-loading"
      role="status"
      aria-label="Chargement des utilisateurs"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Role>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAdminUsers()
      .then((items) => {
        if (!active) return;
        setUsers(items);
        setDrafts(
          Object.fromEntries(items.map((item) => [item.id, item.role])),
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(target: AdminUser) {
    const role = drafts[target.id] ?? target.role;
    setSavingId(target.id);
    setSavedId(null);
    setError("");
    try {
      const updated = await updateAdminUserRole(target.id, role);
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((current) => ({ ...current, [updated.id]: updated.role }));
      setSavedId(updated.id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <header className="admin-head">
        <span className="admin-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </span>
        <div>
          <h1 id="admin-title">Administration</h1>
          <p>Consultez les comptes et attribuez leur rôle InteriMatch.</p>
        </div>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <AdminLoading />
      ) : users.length === 0 ? (
        <p className="empty">Aucun utilisateur à afficher.</p>
      ) : (
        <AdminUsersTable
          users={users}
          currentUserId={user?.id ?? ""}
          drafts={drafts}
          savingId={savingId}
          savedId={savedId}
          onRoleChange={(id, role) => {
            setDrafts((current) => ({ ...current, [id]: role }));
            setSavedId(null);
          }}
          onSave={(target) => void save(target)}
        />
      )}
    </section>
  );
}
