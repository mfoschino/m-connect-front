import { useEffect, useMemo } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { getEntityFieldSpec } from '../../constants/connectors'

const FIELD_TYPE_OPTIONS = [
  { value: 'simple', label: 'Direct mapping' },
  { value: 'constant', label: 'Constant value' },
]

const normalize = (s = '') => String(s).replace(/[\s_\-]+/g, '').toLowerCase()

const FieldMappingBuilder = ({ entityId, fieldMappings, setFieldMappings }) => {
  const entitySpec = useMemo(() => getEntityFieldSpec(entityId), [entityId])
  const { sourceFields = [], destinationFields = [] } = entitySpec || {}

  // Auto-generate mappings when entity changes and no mappings provided
  useEffect(() => {
    if (!entityId) return
    // If already have mappings for this entity, do not overwrite
    if (fieldMappings && fieldMappings.length > 0) return

    const initial = sourceFields.map((s) => {
      // Attempt to find destination by label/id
      let match = destinationFields.find((d) => d.id === s.id)
      if (!match) match = destinationFields.find((d) => d.label === s.label)
      if (!match) match = destinationFields.find((d) => d.label.toLowerCase() === String(s.label).toLowerCase())
      if (!match) match = destinationFields.find((d) => normalize(d.label) === normalize(s.label))

      return {
        source_field: s.id,
        source_label: s.label,
        target_field: match ? match.id : '',
        target_label: match ? match.label : '',
        field_type: 'simple',
        constant_value: '',
        on_error: 'fail',
        auto_mapped: Boolean(match),
        required: match?.required === true,
      }
    })

    setFieldMappings(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  const handleUpdateMapping = (index, key, value) => {
    const updated = [...(fieldMappings || [])]
    updated[index] = {
      ...updated[index],
      [key]: value,
      ...(key === 'field_type' && value === 'simple' ? { constant_value: '' } : {}),
      ...(key === 'field_type' && value === 'constant' ? { source_field: '' } : {}),
    }
    setFieldMappings(updated)
  }

  const handleRemoveMapping = (index) => {
    setFieldMappings((fieldMappings || []).filter((_, rowIndex) => rowIndex !== index))
  }

  if (!entityId) {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Select an entity first</p>
        <p className="mt-1 text-sm text-amber-700">Field mapping works after you pick the business entity to sync.</p>
      </div>
    )
  }

  if (!sourceFields || sourceFields.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">No source fields available</p>
        <p className="mt-1 text-sm text-slate-600">This entity does not expose any source fields.</p>
      </div>
    )
  }

  const mappings = fieldMappings || []

  const autoMappedCount = mappings.filter((m) => m.auto_mapped).length
  const needsAttentionCount = mappings.filter((m) => !m.target_field || (m.field_type === 'constant' && !m.constant_value) || (m.field_type !== 'constant' && !m.source_field)).length

  // Destination required fields not mapped (if destination metadata provides `required` flag)
  const requiredUnmapped = destinationFields.filter((d) => d.required === true && !mappings.find((m) => m.target_field === d.id))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Map your data fields</h3>
        <p className="mt-1 text-sm text-slate-600">System generated mappings are shown below — adjust any row as needed.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
        <div className="text-sm text-slate-700">
          <strong className="text-slate-900">{autoMappedCount} mapped automatically</strong>
          <span className="ml-3">{needsAttentionCount > 0 ? `⚠ ${needsAttentionCount} need attention` : '✓ All rows valid'}</span>
        </div>
        <div className="text-sm text-slate-600">
          <Button variant="outline" onClick={() => setFieldMappings([])}>Reset mappings</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-left text-slate-700">
              <th className="w-1/3 py-2">Source Field</th>
              <th className="w-1/3 py-2">Destination Field</th>
              <th className="w-1/6 py-2">Type</th>
              <th className="w-1/12 py-2">Required</th>
              <th className="w-1/6 py-2">Transform</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => {
              const srcLabel = mapping.source_label || (sourceFields.find((s) => s.id === mapping.source_field)?.label || mapping.source_field)
              const isUnmapped = !mapping.target_field
              const destRequired = mapping.required === true

              return (
                <tr key={index} className={`${isUnmapped ? 'bg-amber-50' : ''}`}>
                  <td className="py-3 pr-4">{srcLabel}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={mapping.target_field}
                      onChange={(e) => handleUpdateMapping(index, 'target_field', e.target.value)}
                      className="form-input w-full"
                    >
                      <option value="">Unmapped</option>
                      {destinationFields.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}{d.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <select value={mapping.field_type} onChange={(e) => handleUpdateMapping(index, 'field_type', e.target.value)} className="form-input w-full">
                      {FIELD_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <input type="checkbox" checked={!!mapping.required} onChange={(e) => handleUpdateMapping(index, 'required', e.target.checked)} />
                  </td>
                  <td className="py-3 pr-4">
                    {mapping.field_type === 'constant' ? (
                      <Input value={mapping.constant_value || ''} onChange={(e) => handleUpdateMapping(index, 'constant_value', e.target.value)} placeholder="Constant value" />
                    ) : (
                      <div className="text-slate-500">—</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {requiredUnmapped.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <strong>Required fields not mapped:</strong>
          <ul className="mt-2 list-disc pl-5">
            {requiredUnmapped.map((d) => (<li key={d.id}>{d.label}</li>))}
          </ul>
        </div>
      ) : null}

      <div className="text-sm text-slate-600">Tip: You can edit any row. Transformations and lookups are supported in a future iteration.</div>
    </div>
  )
}

export default FieldMappingBuilder
