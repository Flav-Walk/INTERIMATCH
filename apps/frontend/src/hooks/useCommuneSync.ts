import { useEffect, useState } from "react";

/*
 * Ville ⇄ code postal : l'un complète l'autre, pour éviter les profils
 * incohérents (« Paris » avec « 69002 ») qui faussent le géocodage, donc la
 * carte et le rapprochement avec les missions.
 *
 * Source : API « Découpage administratif » (geo.api.gouv.fr), service public
 * gratuit et sans clé. On n'envoie que la ville ou le code postal tapés.
 *
 * Règles (on ne réagit qu'au champ que la personne vient de modifier) :
 * - Code postal saisi (5 chiffres) :
 *     1 commune       → la ville est remplie automatiquement ;
 *     plusieurs       → on propose de choisir (ex. 01000 : Bourg-en-Bresse
 *                       ou Saint-Denis-lès-Bourg) ;
 *     aucune          → on signale un code postal inconnu.
 * - Ville saisie :
 *     1 code postal   → il est rempli, et le nom est remis au propre
 *                       (« paris » → « Paris ») ;
 *     plusieurs       → on propose de choisir (Lyon : 69001 à 69009) ;
 *     nom approchant  → on propose les communes trouvées.
 * Si la valeur actuelle de l'autre champ est déjà cohérente, on n'y touche pas.
 */

const API = "https://geo.api.gouv.fr/communes";
const DELAY_MS = 600;

export type EditedField = "city" | "postal_code" | null;

interface Commune {
  nom: string;
  codesPostaux: string[];
}

export interface CommuneChoice {
  label: string;
  city: string;
  postalCode: string;
}

/** « Saint-Étienne » et « saint etienne » doivent être égaux. */
const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-'’\s]+/g, " ")
    .trim()
    .toLowerCase();

export function useCommuneSync({
  city,
  postalCode,
  edited,
  apply,
}: {
  city: string;
  postalCode: string;
  /** Le champ que la personne vient de modifier (null = rien à faire). */
  edited: EditedField;
  /**
   * Écrit ville et/ou code postal dans le brouillon. `rerun` relance la
   * vérification sur ce champ (utile après le choix d'une ville qui a
   * plusieurs codes postaux : on enchaîne sur le choix du code).
   */
  apply: (
    values: { city?: string; postal_code?: string },
    rerun?: EditedField,
  ) => void;
}) {
  const [choices, setChoices] = useState<CommuneChoice[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!edited) return;
    const cp = postalCode.trim();
    const name = city.trim();
    const controller = new AbortController();

    const run = async () => {
      if (edited === "postal_code") {
        if (!/^\d{5}$/.test(cp)) {
          setChoices([]);
          setMessage("");
          return;
        }
        const response = await fetch(
          `${API}?codePostal=${cp}&fields=nom&format=json`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const communes: Commune[] = await response.json();
        if (communes.length === 0) {
          setChoices([]);
          setMessage(`Aucune commune ne correspond au code postal ${cp}.`);
          return;
        }
        // La ville déjà saisie fait partie des communes du code : rien à faire.
        const match = communes.find((c) => normalise(c.nom) === normalise(name));
        if (match) {
          if (match.nom !== name) apply({ city: match.nom });
          setChoices([]);
          setMessage("");
          return;
        }
        if (communes.length === 1) {
          apply({ city: communes[0].nom });
          setChoices([]);
          setMessage(`Ville complétée : ${communes[0].nom}.`);
          return;
        }
        setMessage(`Plusieurs communes pour ${cp} : choisissez la vôtre.`);
        setChoices(
          communes.map((c) => ({ label: c.nom, city: c.nom, postalCode: cp })),
        );
        return;
      }

      // edited === "city"
      if (name.length < 2) {
        setChoices([]);
        setMessage("");
        return;
      }
      const response = await fetch(
        `${API}?nom=${encodeURIComponent(name)}&fields=nom,codesPostaux&boost=population&limit=5`,
        { signal: controller.signal },
      );
      if (!response.ok) return;
      const communes: Commune[] = await response.json();
      const exact = communes.find((c) => normalise(c.nom) === normalise(name));
      if (!exact) {
        setMessage(communes.length ? "Vouliez-vous dire :" : "");
        setChoices(
          communes.slice(0, 5).map((c) => ({
            label:
              c.codesPostaux.length === 1
                ? `${c.nom} (${c.codesPostaux[0]})`
                : c.nom,
            city: c.nom,
            // Plusieurs codes : on laisse choisir ensuite le code postal.
            postalCode: c.codesPostaux.length === 1 ? c.codesPostaux[0] : "",
          })),
        );
        return;
      }
      // Nom exact : on le remet au propre, puis on règle le code postal.
      if (exact.codesPostaux.includes(cp)) {
        if (exact.nom !== name) apply({ city: exact.nom });
        setChoices([]);
        setMessage("");
        return;
      }
      if (exact.codesPostaux.length === 1) {
        apply({ city: exact.nom, postal_code: exact.codesPostaux[0] });
        setChoices([]);
        setMessage(`Code postal complété : ${exact.codesPostaux[0]}.`);
        return;
      }
      if (exact.nom !== name) apply({ city: exact.nom });
      setMessage(`Plusieurs codes postaux pour ${exact.nom} : choisissez le vôtre.`);
      setChoices(
        exact.codesPostaux.map((code) => ({
          label: code,
          city: exact.nom,
          postalCode: code,
        })),
      );
    };

    const timer = setTimeout(() => {
      run().catch(() => {
        /* hors ligne ou service indisponible : la saisie reste libre */
      });
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `apply` change à chaque rendu : on ne réagit qu'aux valeurs saisies.
  }, [city, postalCode, edited]);

  /** Clic sur une proposition : on remplit ce qu'on sait, puis on range. */
  const choose = (choice: CommuneChoice) => {
    if (choice.postalCode) {
      apply({ city: choice.city, postal_code: choice.postalCode });
    } else {
      apply({ city: choice.city }, "city"); // → propose ensuite les codes
    }
    setChoices([]);
    setMessage("");
  };

  return { choices, message, choose };
}
