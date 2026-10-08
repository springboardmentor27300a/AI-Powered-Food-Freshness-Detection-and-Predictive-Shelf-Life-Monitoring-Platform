/**
 * Shared create/edit form for a food batch.
 * Used by the "Add Food Item" page and by the Edit modal on the Inventory page.
 * Client-side validation mirrors the backend rules (required fields, positive
 * quantity, expiry >= received, available <= total).
 */
import { useState } from 'react'

import { FOOD_CATEGORIES, PACKAGING_TYPES, STORAGE_OPTIONS, UNITS } from '../utils/constants'
import { Spinner } from './Spinner'

const EMPTY = {
  food_name: '',
  category: '',
  quantity: '',
  available_quantity: '',
  unit: '',
  received_date: '',
  expiry_date: '',
  storage_location: '',
  packaging_type: '',
  notes: '',
  temperature_c: '',
  humidity_pct: '',
  air_circulation: '',
  light_exposure: '',
}

export default function BatchForm({ initial, submitLabel = 'Save Food Batch', busy, serverError, onSubmit }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    // Normalise numeric/date inputs to strings for controlled inputs.
    quantity: initial?.quantity ?? '',
    available_quantity: initial?.available_quantity ?? '',
  }))
  const [errors, setErrors] = useState({})

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.food_name.trim() || form.food_name.trim().length < 2) errs.food_name = 'Food name is required (min 2 characters).'
    if (!form.category) errs.category = 'Please select a food category.'
    const qty = Number(form.quantity)
    if (!form.quantity || Number.isNaN(qty) || qty <= 0) errs.quantity = 'Quantity must be a number greater than 0.'
    if (!form.unit) errs.unit = 'Please select a unit.'
    if (!form.received_date) errs.received_date = 'Received date is required.'
    if (!form.expiry_date) errs.expiry_date = 'Expiry date is required.'
    else if (form.received_date && form.expiry_date < form.received_date)
      errs.expiry_date = 'Expiry date cannot be before the received date.'

    if (form.available_quantity !== '' && form.available_quantity !== null) {
      const avail = Number(form.available_quantity)
      if (Number.isNaN(avail) || avail < 0) errs.available_quantity = 'Available quantity cannot be negative.'
      else if (!errs.quantity && avail > qty) errs.available_quantity = 'Available quantity cannot exceed the total quantity.'
    }
    if (!form.storage_location.trim()) errs.storage_location = 'Storage location is required.'
    if (!form.packaging_type.trim()) errs.packaging_type = 'Packaging type is required.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    // Build a clean JSON payload for FastAPI/Pydantic.
    const payload = {
      food_name: form.food_name.trim(),
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      received_date: form.received_date,
      expiry_date: form.expiry_date,
      storage_location: form.storage_location.trim(),
      packaging_type: form.packaging_type.trim(),
      notes: form.notes?.trim() ? form.notes.trim() : null,
    }
    if (form.available_quantity !== '' && form.available_quantity !== null) {
      payload.available_quantity = Number(form.available_quantity)
    }
    // Milestone 3: optional live storage-condition fields.
    if (form.temperature_c !== '' && form.temperature_c !== null) {
      payload.temperature_c = Number(form.temperature_c)
    }
    if (form.humidity_pct !== '' && form.humidity_pct !== null) {
      payload.humidity_pct = Number(form.humidity_pct)
    }
    if (form.air_circulation) payload.air_circulation = form.air_circulation
    if (form.light_exposure) payload.light_exposure = form.light_exposure
    // Parent returns an error message string when the API rejects the save
    // (e.g. validation on update); undefined means success.
    const result = await onSubmit(payload)
    if (typeof result === 'string') setServerError(result)
  }

  return (
    <form className="batch-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="banner error">{serverError}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="food_name">Food Name *</label>
          <input id="food_name" type="text" placeholder="e.g. Apple" value={form.food_name}
                 onChange={set('food_name')} maxLength={150} />
          {errors.food_name && <span className="field-error">{errors.food_name}</span>}
        </div>

        <div className="field">
          <label htmlFor="category">Food Category *</label>
          <select id="category" value={form.category} onChange={set('category')}>
            <option value="">Select category…</option>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.category && <span className="field-error">{errors.category}</span>}
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantity *</label>
          <input id="quantity" type="number" min="0" step="any" placeholder="e.g. 25"
                 value={form.quantity} onChange={set('quantity')} />
          {errors.quantity && <span className="field-error">{errors.quantity}</span>}
        </div>

        <div className="field">
          <label htmlFor="unit">Unit *</label>
          <select id="unit" value={form.unit} onChange={set('unit')}>
            <option value="">Select unit…</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {errors.unit && <span className="field-error">{errors.unit}</span>}
        </div>

        <div className="field">
          <label htmlFor="available_quantity">
            Available Quantity <small>(leave blank to use full quantity)</small>
          </label>
          <input id="available_quantity" type="number" min="0" step="any" placeholder="Defaults to Quantity"
                 value={form.available_quantity ?? ''} onChange={set('available_quantity')} />
          {errors.available_quantity && <span className="field-error">{errors.available_quantity}</span>}
        </div>

        <div className="field">
          <label htmlFor="received_date">Received Date *</label>
          <input id="received_date" type="date" value={form.received_date ?? ''} onChange={set('received_date')} />
          {errors.received_date && <span className="field-error">{errors.received_date}</span>}
        </div>

        <div className="field">
          <label htmlFor="expiry_date">Expiry Date *</label>
          <input id="expiry_date" type="date" min={form.received_date || undefined}
                 value={form.expiry_date ?? ''} onChange={set('expiry_date')} />
          {errors.expiry_date && <span className="field-error">{errors.expiry_date}</span>}
        </div>

        <div className="field">
          <label htmlFor="storage_location">Storage Location *</label>
          <input id="storage_location" type="text" placeholder="e.g. Cold Storage A - Shelf 3"
                 value={form.storage_location ?? ''} onChange={set('storage_location')} maxLength={150} />
          {errors.storage_location && <span className="field-error">{errors.storage_location}</span>}
        </div>

        <div className="field">
          <label htmlFor="packaging_type">Packaging Type *</label>
          <input id="packaging_type" type="text" list="packaging-options" placeholder="e.g. Crates"
                 value={form.packaging_type ?? ''} onChange={set('packaging_type')} maxLength={80} />
          <datalist id="packaging-options">
            {PACKAGING_TYPES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {errors.packaging_type && <span className="field-error">{errors.packaging_type}</span>}
        </div>

        <div className="field span-2">
          <label htmlFor="notes">Notes <small>(optional)</small></label>
          <textarea id="notes" rows={3} maxLength={2000} placeholder="Supplier details, batch quality remarks…"
                    value={form.notes ?? ''} onChange={set('notes')} />
        </div>
      </div>

      <div className="form-subsection">
        <h4>Live Storage Conditions <small>(optional — enables Milestone 3 monitoring)</small></h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="temperature_c">Temperature (°C)</label>
            <input id="temperature_c" type="number" step="any" placeholder="e.g. 4" value={form.temperature_c ?? ''}
                   onChange={set('temperature_c')} />
          </div>
          <div className="field">
            <label htmlFor="humidity_pct">Humidity (%)</label>
            <input id="humidity_pct" type="number" min="0" max="100" step="any" placeholder="e.g. 75" value={form.humidity_pct ?? ''}
                   onChange={set('humidity_pct')} />
          </div>
          <div className="field">
            <label htmlFor="air_circulation">Air Circulation</label>
            <select id="air_circulation" value={form.air_circulation ?? ''} onChange={set('air_circulation')}>
              <option value="">Not specified…</option>
              {STORAGE_OPTIONS.airCirculation.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="light_exposure">Light Exposure</label>
            <select id="light_exposure" value={form.light_exposure ?? ''} onChange={set('light_exposure')}>
              <option value="">Not specified…</option>
              {STORAGE_OPTIONS.lightExposure.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy && <Spinner size={15} />} {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
