/** Confirmation dialog used before destructive actions (delete batch). */
import Modal from './Modal'
import { Spinner } from './Spinner'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <Modal title={title} onClose={onCancel} width={440}>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner size={14} />} {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
