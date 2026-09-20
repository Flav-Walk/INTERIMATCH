import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Confirmation d'une action qu'on ne peut pas défaire.
 *
 * S'appuie sur `<dialog>` natif : le piège du focus, la fermeture par Échap et
 * l'inertie du reste de la page sont alors gérés par le navigateur, sans
 * dépendance ni gestionnaire de touches à maintenir.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  busyLabel,
  busy = false,
  tone = "default",
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  tone?: "default" | "danger";
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="confirm"
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className="confirm-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => ref.current?.close()}
          disabled={busy}
        >
          Annuler
        </button>
        <button
          type="button"
          className={`button${tone === "danger" ? " is-danger" : ""}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
