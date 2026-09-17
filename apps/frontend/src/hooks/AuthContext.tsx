import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, refreshSession, setAccess, type User } from "../services/session";
import { ApiError } from "../services/api";
import { supabase } from "../services/supabase";
interface Auth {
  user: User | null;
  loading: boolean;
  loadError: boolean;
  /** Applique la charge utile renvoyée par une écriture, sans second aller-retour. */
  setUser: (user: User) => void;
  reload: () => Promise<void>;
  /**
   * Numéro de version des données serveur. Les écrans qui lisent l'API le
   * placent dans les dépendances de leur effet : ils relisent alors après
   * chaque écriture, et au retour sur l'onglet, sans que personne ait à
   * recharger la page.
   */
  revision: number;
  /** À appeler après une écriture réussie : marque les lectures comme périmées. */
  invalidate: () => void;
  login: (email: string, password: string, register?: boolean) => Promise<User>;
  google: (jwt: string) => Promise<User>;
  logout: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [revision, setRevision] = useState(0);
  const invalidate = useCallback(() => setRevision((n) => n + 1), []);
  const reload = async () => {
    const u = await api<User>("/me");
    setUser(u);
  };
  useEffect(() => {
    let live = true;
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    void refreshSession()
      .then(() => api<User>("/me"))
      .then((u) => {
        if (live) setUser(u);
      })
      .catch((e) => {
        if (live && !(e instanceof ApiError && e.status === 401))
          setLoadError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  const authenticate = async (path: string, body: object) => {
    const r = await api<{ access_token: string }>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setAccess(r.access_token);
    const u = await api<User>("/me");
    setUser(u);
    setLoadError(false);
    return u;
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setAccess(null);
    setUser(null);
    await supabase?.auth.signOut({ scope: "local" });
  };
  // Un onglet laissé ouvert pendant qu'on agit ailleurs — autre onglet, autre
  // appareil — affiche sinon un état figé au moment où on l'a quitté. Le
  // retour de focus est le moment naturel pour relire.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [invalidate]);

  return (
    <Context.Provider
      value={{
        user,
        loading,
        loadError,
        setUser,
        reload,
        revision,
        invalidate,
        login: (email, password, register = false) =>
          authenticate(register ? "/auth/register" : "/auth/login", {
            email,
            password,
          }),
        google: (jwt) => authenticate("/auth/google", { access_token: jwt }),
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider missing");
  return auth;
}
