import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import { errorMessage } from "../services/session";
import {
  listCompanyApplications,
  noApplications,
  type CompanyApplications,
} from "../services/applications";

/**
 * Les candidatures reçues par l'entreprise, chargées une fois pour tous ceux
 * qui en parlent.
 *
 * Trois endroits posent la même question — le badge de navigation, le tableau
 * de bord et l'écran Candidatures — et rien ne serait pire que d'y répondre
 * séparément : trois requêtes concurrentes finiraient par afficher trois
 * nombres différents au même instant. Une seule lecture, un seul état.
 *
 * Ce qui est exposé ici ne contient **que** de vraies candidatures. Les profils
 * suggérés par le rapprochement n'y figurent pas et ne doivent jamais y entrer :
 * ils n'ont exprimé aucune intention, et les compter reviendrait à annoncer à
 * l'entreprise un travail qu'elle n'a pas à faire.
 */
interface CompanyData extends CompanyApplications {
  loading: boolean;
  error: string;
  /** Relit immédiatement, après une décision par exemple. */
  refresh: () => Promise<void>;
}

const Context = createContext<CompanyData | null>(null);

export function CompanyDataProvider({ children }: { children: ReactNode }) {
  const { user, revision } = useAuth();
  const isCompany = user?.role === "company";
  const [data, setData] = useState<CompanyApplications>(noApplications);
  // Le premier chargement seul mérite un état « en cours ». Les relectures
  // suivantes gardent le contenu affiché : remplacer une liste correcte par un
  // écran vide le temps d'un aller-retour donnerait l'impression que les
  // candidatures ont disparu.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  const read = useCallback(async () => {
    if (!isCompany) return;
    if (!loaded.current) setLoading(true);
    try {
      setData(await listCompanyApplications());
      setError("");
      loaded.current = true;
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [isCompany]);

  useEffect(() => {
    if (!isCompany) {
      loaded.current = false;
      setData(noApplications);
      return;
    }
    void read();
    // `revision` change après chaque écriture et au retour sur l'onglet : une
    // candidature déposée ailleurs apparaît sans qu'on ait à recharger la page.
  }, [isCompany, revision, read]);

  return (
    <Context.Provider value={{ ...data, loading, error, refresh: read }}>
      {children}
    </Context.Provider>
  );
}

/**
 * Hors de l'espace entreprise, le fournisseur n'est pas monté : on renvoie un
 * état vide plutôt que de lever. Le badge de navigation vit dans une coquille
 * partagée par tous les rôles, et il ne doit pas la faire tomber.
 */
export function useCompanyData(): CompanyData {
  return (
    useContext(Context) ?? {
      ...noApplications,
      loading: false,
      error: "",
      refresh: async () => {},
    }
  );
}
