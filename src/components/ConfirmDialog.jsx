import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * A single reusable dialog for both simple confirmations and
 * confirmation-with-text-input (replaces window.confirm / window.prompt).
 *
 * Usage:
 *   <ConfirmDialog
 *     open={dialog?.type === 'delete-entry'}
 *     title="Delete this entry?"
 *     message="This can't be undone."
 *     confirmLabel="Delete"
 *     danger
 *     onConfirm={() => ...}
 *     onCancel={() => setDialog(null)}
 *   />
 *
 * For a prompt-style dialog (text input), pass `withInput` and read the
 * value back from onConfirm(value). Only one input is supported for now.
 *   <ConfirmDialog
 *     open={dialog?.type === 'rename-entry'}
 *     title="Rename this entry"
 *     withInput
 *     inputPlaceholder="New name"
 *     onConfirm={(value) => ...}
 *     onCancel={() => setDialog(null)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  withInput = false,
  inputPlaceholder = '',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[1px] px-4"
      onClick={onCancel}
    >
      <div className="card w-full max-w-sm p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCancel} className="absolute top-4 right-4 text-muted hover:text-ink">
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 mb-2">
          {danger && <AlertTriangle size={20} className="text-rust shrink-0 mt-0.5" />}
          <h3 className="font-mono font-semibold text-lg pr-6">{title}</h3>
        </div>
        {message && <p className="text-inkSoft text-sm mb-4">{message}</p>}

        {withInput && (
          <input
            className="input w-full mb-4"
            placeholder={inputPlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="font-mono text-sm text-muted px-3 py-2">
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(value)}
            className={`font-mono text-sm font-semibold px-4 py-2 text-paper ${danger ? 'bg-rust' : 'bg-navy'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}