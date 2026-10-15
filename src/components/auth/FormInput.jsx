const FormInput = ({ id, label, error, ...props }) => {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <input id={id} className={`form-input ${error ? 'input-error' : ''}`} {...props} />
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default FormInput
