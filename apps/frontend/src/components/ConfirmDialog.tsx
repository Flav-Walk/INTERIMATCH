import { useEffect, useRef, type ReactNode } from "react";

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
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog className="confirm" ref={ref} onClose={onCancel}>
      <h2>{title}</h2>
      {children}
      <div className="confirm-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={busy}
        >
          Annuler
        </button>
        <button
          type="button"
          className="button"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
