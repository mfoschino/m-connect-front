const ConnectorConfigForm = ({ connectorType, configText, setConfigText, error }) => {
  const label = connectorType
    ? `Configuración para conector ${connectorType}`
    : 'Configuración del conector'

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-900">{label}</label>
        <p className="text-sm text-slate-500">
          Ingresa un objeto JSON válido. El schema exacto del config se determina en el backend según el tipo de conector.
        </p>
      </div>
      <textarea
        id="connector-config"
        value={configText}
        onChange={(event) => setConfigText(event.target.value)}
        className="form-input min-h-[220px] w-full font-mono text-sm leading-6"
        placeholder='{"url": "https://api.example.com", "auth": {"type": "basic", "username": "user", "password": "pass"}}'
      />
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default ConnectorConfigForm
