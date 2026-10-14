import Button from '../ui/Button'

const Pagination = ({ skip, limit, total, onChange, disabled = false }) => {
  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + limit, total)

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>Mostrando {from}–{to} de {total}</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => onChange(Math.max(skip - limit, 0))}
          disabled={disabled || skip === 0}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          onClick={() => onChange(skip + limit)}
          disabled={disabled || skip + limit >= total}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

export default Pagination