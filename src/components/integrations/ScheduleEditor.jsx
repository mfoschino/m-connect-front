const presets = [
  { label: 'Cada hora', value: '0 * * * *' },
  { label: 'Diario', value: '0 0 * * *' },
  { label: 'Semanal', value: '0 0 * * 1' },
]

const ScheduleEditor = ({ scheduleMode, setScheduleMode, cron, setCron, error }) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="radio"
            name="scheduleMode"
            value="manual"
            checked={scheduleMode === 'manual'}
            onChange={() => setScheduleMode('manual')}
            className="h-4 w-4 text-sky-600"
          />
          <div>
            <p className="font-semibold text-slate-900">Ejecución manual</p>
            <p className="text-sm text-slate-500">La integración se ejecuta solo manualmente o por webhook.</p>
          </div>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="radio"
            name="scheduleMode"
            value="cron"
            checked={scheduleMode === 'cron'}
            onChange={() => setScheduleMode('cron')}
            className="h-4 w-4 text-sky-600"
          />
          <div>
            <p className="font-semibold text-slate-900">Programado</p>
            <p className="text-sm text-slate-500">Ejecutar automáticamente según una expresión cron.</p>
          </div>
        </label>
      </div>

      {scheduleMode === 'cron' ? (
        <div className="space-y-3">
          <label htmlFor="integration-cron" className="block text-sm font-semibold text-slate-900">
            Expresión cron
          </label>
          <input
            id="integration-cron"
            type="text"
            value={cron}
            onChange={(event) => setCron(event.target.value)}
            className="form-input w-full"
            placeholder="0 0 * * *"
          />
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="btn btn-outline text-sm"
                onClick={() => setCron(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">Usá las opciones predefinidas para completar rápidamente la expresión cron.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default ScheduleEditor
