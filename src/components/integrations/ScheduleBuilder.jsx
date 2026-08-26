/**
 * ScheduleBuilder Component
 * Provides a business-friendly scheduling interface
 * Hides cron complexity but generates valid cron expressions internally
 * 
 * Usage:
 * <ScheduleBuilder schedule={cronString} setSchedule={setCronFunction} error={errorText} />
 * 
 * Returns cron strings to the parent for backend compatibility
 */

import { useState, useMemo } from 'react'
import Button from '../../components/ui/Button'
import { SCHEDULE_PRESETS, generateDailyCron, generateWeeklyCron, parseCron, getScheduleDescription, getNextRunEstimate } from '../../utils/scheduleUtils'

const ScheduleBuilder = ({ schedule, setSchedule, error }) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customTime, setCustomTime] = useState('02:00')
  const [customDay, setCustomDay] = useState(1)

  const parsed = useMemo(() => parseCron(schedule), [schedule])

  const selectedPreset = useMemo(
    () => SCHEDULE_PRESETS.find((p) => p.cron === schedule) || { id: 'custom', label: 'Personalizada' },
    [schedule]
  )

  const handlePresetSelect = (preset) => {
    setSchedule(preset.cron)
  }

  const handleDailyCustom = () => {
    const [hour, minute] = customTime.split(':').map(Number)
    const cron = generateDailyCron(hour, minute)
    setSchedule(cron)
  }

  const handleWeeklyCustom = () => {
    const [hour, minute] = customTime.split(':').map(Number)
    const cron = generateWeeklyCron(customDay, hour, minute)
    setSchedule(cron)
  }

  const handleAdvancedCron = (cronString) => {
    setSchedule(cronString)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">¿Con qué frecuencia debe ejecutarse esta integración?</h3>
        <p className="mt-1 text-sm text-slate-600">Elegí una programación o configurala como manual para iniciarla cuando la necesites.</p>
      </div>

      {/* Quick Preset Options */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SCHEDULE_PRESETS.slice(0, 5).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePresetSelect(preset)}
            className={`rounded-2xl border-2 p-4 text-left transition ${
              selectedPreset.id === preset.id ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className="font-semibold text-slate-900">{preset.label}</p>
            <p className="mt-1 text-sm text-slate-600">{preset.description}</p>
          </button>
        ))}
      </div>

      {/* Custom Time Selection */}
      {selectedPreset.id === 'daily-custom' && (
        <div className="space-y-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Elegí un horario</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="daily-time" className="block text-xs font-medium text-slate-700">
                Hora
              </label>
              <input
                id="daily-time"
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="form-input mt-1 w-full"
              />
            </div>
            <Button size="sm" onClick={handleDailyCustom}>
              Aplicar
            </Button>
          </div>
        </div>
      )}

      {selectedPreset.id === 'weekly-custom' && (
        <div className="space-y-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Elegí un día y un horario</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="weekly-day" className="block text-xs font-medium text-slate-700">
                Día de la semana
              </label>
              <select id="weekly-day" value={customDay} onChange={(e) => setCustomDay(Number(e.target.value))} className="form-input mt-1 w-full">
                <option value={0}>Domingo</option>
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
              </select>
            </div>
            <div>
              <label htmlFor="weekly-time" className="block text-xs font-medium text-slate-700">
                Hora
              </label>
              <input id="weekly-time" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="form-input mt-1 w-full" />
            </div>
          </div>
          <Button size="sm" onClick={handleWeeklyCustom}>
            Aplicar
          </Button>
        </div>
      )}

      {/* Current Schedule Summary */}
      {schedule && (
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Programada para ejecutarse:</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{getScheduleDescription(schedule)}</p>
          <p className="mt-2 text-sm text-slate-600">{getNextRunEstimate(schedule)}</p>
        </div>
      )}

      {/* Advanced Cron Mode */}
      <details className="rounded-2xl border border-slate-200">
        <summary className="cursor-pointer p-4 font-semibold text-slate-900 hover:bg-slate-50">
          ⚙️ Opciones avanzadas: expresión cron personalizada
        </summary>
        <div className="space-y-3 border-t border-slate-200 p-4">
          <p className="text-sm text-slate-600">
            Ingresá una expresión cron para una programación avanzada. Formato: <code className="bg-slate-100 px-1">minuto hora día mes día-de-la-semana</code>
          </p>
          <input
            type="text"
            value={schedule || ''}
            onChange={(e) => handleAdvancedCron(e.target.value)}
            placeholder="0 0 * * * (todos los días a medianoche)"
            className="form-input w-full font-mono text-sm"
          />
          <p className="text-xs text-slate-500">
            Ejemplo: <code className="bg-slate-100 px-1">0 9 * * 1-5</code> = días hábiles a las 9:00
          </p>
        </div>
      </details>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default ScheduleBuilder
