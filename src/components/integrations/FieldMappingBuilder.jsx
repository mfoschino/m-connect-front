import { useMemo } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { getEntityFieldSpec } from '../../constants/connectors'

const FIELD_TYPE_OPTIONS = [
  { value: 'simple', label: 'Direct mapping' },
  { value: 'constant', label: 'Constant value' },
]

const FieldMappingBuilder = ({ entityId, fieldMappings, setFieldMappings }) => {
  const entitySpec = useMemo(() => getEntityFieldSpec(entityId), [entityId])
  const { sourceFields = [], destinationFields = [] } = entitySpec || {}

  const handleAddMapping = () => {
    setFieldMappings([
      ...fieldMappings,
      {
        target_field: '',
        source_field: '',
        field_type: 'simple',
        constant_value: '',
        on_error: 'fail',
      },
    ])
  }

  const handleRemoveMapping = (index) => {
    setFieldMappings(fieldMappings.filter((_, rowIndex) => rowIndex !== index))
  }

  const handleUpdateMapping = (index, key, value) => {
    const updated = [...fieldMappings]
    updated[index] = {
      ...updated[index],
      [key]: value,
      ...(key === 'field_type' && value === 'simple' ? { constant_value: '' } : {}),
      ...(key === 'field_type' && value === 'constant' ? { source_field: '' } : {}),
    }
    setFieldMappings(updated)
  }

  if (!entityId) {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Select an entity first</p>
        <p className="mt-1 text-sm text-amber-700">Field mapping works after you pick the business entity to sync.</p>
      </div>
    )
  }

  if (destinationFields.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Mapping fields not available</p>
        <p className="mt-1 text-sm text-slate-600">This entity does not have a preconfigured mapping catalog yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Map your data fields</h3>
        <p className="mt-1 text-sm text-slate-600">Select which source fields should populate your canonical destination fields.</p>
      </div>

      {fieldMappings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No mappings have been added yet. Click "Add mapping" to choose a destination field and connect it to a source field or constant value.
        </div>
      ) : null}

      <div className="space-y-4">
        {fieldMappings.map((mapping, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`mapping-target-${index}`} className="block text-sm font-medium text-slate-900">
                  Destination field
                </label>
                <select
                  id={`mapping-target-${index}`}
                  value={mapping.target_field}
                  onChange={(e) => handleUpdateMapping(index, 'target_field', e.target.value)}
                  className="form-input mt-2 w-full"
                >
                  <option value="">Select destination field</option>
                  {destinationFields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`mapping-type-${index}`} className="block text-sm font-medium text-slate-900">
                  Mapping type
                </label>
                <select
                  id={`mapping-type-${index}`}
                  value={mapping.field_type}
                  onChange={(e) => handleUpdateMapping(index, 'field_type', e.target.value)}
                  className="form-input mt-2 w-full"
                >
                  {FIELD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveMapping(index)}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {mapping.field_type === 'constant' ? (
                <div className="sm:col-span-2">
                  <Input
                    id={`mapping-constant-${index}`}
                    label="Constant value"
                    value={mapping.constant_value || ''}
                    onChange={(e) => handleUpdateMapping(index, 'constant_value', e.target.value)}
                    placeholder="Enter a fixed value"
                  />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label htmlFor={`mapping-source-${index}`} className="block text-sm font-medium text-slate-900">
                    Source field
                  </label>
                  <select
                    id={`mapping-source-${index}`}
                    value={mapping.source_field}
                    onChange={(e) => handleUpdateMapping(index, 'source_field', e.target.value)}
                    className="form-input mt-2 w-full"
                  >
                    <option value="">Select source field</option>
                    {sourceFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handleAddMapping}>
          Add mapping
        </Button>
        <p className="text-sm text-slate-500">Create as many field mappings as needed for the selected entity.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Suggested fields</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Source fields</p>
            <ul className="mt-2 list-disc pl-5 text-slate-600">
              {sourceFields.slice(0, 5).map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Destination fields</p>
            <ul className="mt-2 list-disc pl-5 text-slate-600">
              {destinationFields.slice(0, 5).map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FieldMappingBuilder
