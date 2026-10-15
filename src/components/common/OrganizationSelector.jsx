import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authErrorMessage } from '../../services/auth/iamUi.js'
import { membershipChoices } from '../../services/auth/iamTenantUi.js'

const OrganizationSelector = ({ standalone = false }) => {
  const { user, error, switching, switchTenant, logout } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const pendingRef = useRef(false)
  const choices = membershipChoices(user)
  const availableChoices = choices.filter((choice) => choice.available)
  const unavailableChoices = choices.filter((choice) => !choice.available)
  const active = choices.find((choice) => choice.tenant_id === user?.tenant_id)
  const busy = switching || submitting

  const select = async (tenantId) => {
    const choice = choices.find((item) => item.tenant_id === tenantId)
    if (pendingRef.current || busy || !choice?.available || tenantId === user?.tenant_id) return
    pendingRef.current = true
    setSubmitting(true)
    try {
      await switchTenant(tenantId)
    } catch {
      // El controlador conserva el contexto revalidado o publica recuperación.
    } finally {
      pendingRef.current = false
      setSubmitting(false)
    }
  }

  const errorMessage = error?.status === 403
    ? `No se pudo cambiar de organización. ${authErrorMessage(error)}` : null

  if (standalone) {
    return <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Elegí una organización</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tu sesión está activa. Seleccioná una organización habilitada para continuar.
      </p>
      {availableChoices.length === 0 ? <p role="status" className="mt-5 text-sm text-slate-600">
        No tenés organizaciones habilitadas. Contactá a un administrador para solicitar acceso.
      </p> : null}
      {errorMessage ? <p role="alert" className="mt-5 text-sm text-red-700">{errorMessage}</p> : null}
      <ul className="mt-6 space-y-3">
        {choices.map((choice) => <li key={choice.tenant_id}>
          <button type="button" disabled={busy || !choice.available
            || choice.tenant_id === user?.tenant_id}
          onClick={() => { void select(choice.tenant_id) }}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            <span className="block font-semibold text-slate-900">{choice.tenant_name}</span>
            <span className="block text-slate-600">
              {choice.reason || (choice.tenant_id === user?.tenant_id
                ? 'Organización actual' : 'Seleccionar organización')}
            </span>
          </button>
        </li>)}
      </ul>
      {busy ? <p role="status" className="mt-4 text-sm">Cambiando organización…</p> : null}
      <button type="button" className="mt-6 text-sm font-semibold text-slate-700 underline"
        onClick={() => { void logout().catch(() => {
          // El controlador publica recovery_required si no puede cerrar la sesión.
        }) }}>Cerrar sesión</button>
    </section>
  }

  if (availableChoices.length <= 1) {
    const onlyChoice = availableChoices[0]
    const isCurrent = Boolean(onlyChoice) && onlyChoice.tenant_id === user?.tenant_id
    return <div className="max-w-56 text-sm" aria-label="Organización">
      <span className="block text-xs text-slate-500">Organización</span>
      {isCurrent ? <span className="block truncate font-semibold text-slate-900">
        {onlyChoice.tenant_name}
      </span> : onlyChoice ? <button type="button" disabled={busy}
        onClick={() => { void select(onlyChoice.tenant_id) }}
        className="font-semibold text-sky-700 underline disabled:cursor-not-allowed disabled:opacity-60">
          Seleccionar {onlyChoice.tenant_name}
        </button> : <span className="block text-slate-600">Sin organizaciones disponibles</span>}
      {unavailableChoices.length > 0 ? <ul aria-label="Organizaciones no disponibles"
        className="mt-1 space-y-1 text-xs text-amber-700">
        {unavailableChoices.map((choice) => <li key={choice.tenant_id}>
          {choice.tenant_name} — {choice.reason}
        </li>)}
      </ul> : null}
      {busy ? <span role="status" className="block text-xs">Cambiando organización…</span> : null}
      {errorMessage ? <p role="alert" className="mt-1 text-xs text-red-700">{errorMessage}</p> : null}
    </div>
  }

  return <div className="max-w-56 text-sm">
    <label htmlFor="organization-selector" className="block text-xs text-slate-500">Organización</label>
    <select id="organization-selector" className="form-input mt-1 w-full py-2"
      value={user?.tenant_id ?? ''} disabled={busy}
      onChange={(event) => { void select(event.target.value) }}>
      {!active ? <option value="" disabled>Seleccioná una organización</option> : null}
      {choices.map((choice) => <option key={choice.tenant_id} value={choice.tenant_id}
        disabled={!choice.available}>
        {choice.tenant_name}{choice.reason ? ` — ${choice.reason}` : ''}
      </option>)}
    </select>
    {errorMessage ? <p role="alert" className="mt-1 text-xs text-red-700">{errorMessage}</p> : null}
  </div>
}

export default OrganizationSelector
