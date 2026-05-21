const FormInput = ({
  id,
  label,
  type = 'text',
  name,
  value,
  placeholder,
  onChange,
  error,
  autoComplete,
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={onChange}
        className={`block w-full rounded-2xl border px-4 py-3 text-slate-900 shadow-sm transition duration-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
          error ? 'border-red-300 focus:border-red-400' : 'border-slate-200'
        }`}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

export default FormInput
