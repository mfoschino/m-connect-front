import Button from '../ui/Button'

export const IntegrationRowActions = ({ canEdit, canDelete, deleting, onDetail, onEdit, onDelete }) => (
  <>
    <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onDetail}>
      Detalles
    </Button>
    {canEdit ? (
      <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onEdit}>
        Editar
      </Button>
    ) : null}
    {canDelete ? (
      <Button variant="ghost" className="rounded-full px-3 py-1 text-sm text-rose-600"
        onClick={onDelete} disabled={deleting}>
        Eliminar
      </Button>
    ) : null}
  </>
)

export const ProfileRowActions = ({ canEdit, canDeactivate, deactivating,
  onDetail, onEdit, onDeactivate }) => (
  <>
    <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onDetail}>
      Ver
    </Button>
    {canEdit ? (
      <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onEdit}>
        Editar
      </Button>
    ) : null}
    {canDeactivate ? (
      <Button variant="ghost" className="rounded-full px-3 py-1 text-sm text-rose-600"
        onClick={onDeactivate} disabled={deactivating}>
        Desactivar
      </Button>
    ) : null}
  </>
)

export const LookupRowActions = ({ canEdit, canDelete, deleting, onDetail, onEdit, onDelete }) => (
  <>
    <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onDetail}>
      Ver
    </Button>
    {canEdit ? (
      <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={onEdit}>
        Editar
      </Button>
    ) : null}
    {canDelete ? (
      <Button
        variant="ghost"
        className="rounded-full px-3 py-1 text-sm text-rose-600"
        onClick={onDelete}
        disabled={deleting}
      >
        Eliminar
      </Button>
    ) : null}
  </>
)
