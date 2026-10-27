type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
      >
        <h2 id="confirmation-title">{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <button className="tab" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
