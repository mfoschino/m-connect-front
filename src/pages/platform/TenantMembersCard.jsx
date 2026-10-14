import { useEffect, useState } from 'react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import platformService from '../../services/api/platformService'
import { ROLE_LABELS, formatDate, getErrorMessage } from './platformUtils'
import Button from '../../components/ui/Button'
import EditMemberRoleModal from './EditMemberRoleModal'
import MemberAccessModal from './MemberAccessModal'

const TenantMembersCard = ({ tenantId }) => {
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reload, setReload] = useState(0)
    const [successMessage, setSuccessMessage] = useState('')
    const [editingMember, setEditingMember] = useState(null)
    const [accessMember, setAccessMember] = useState(null)

    useEffect(() => {
        let cancelled = false

        platformService
            .listTenantMembers(tenantId, { include_disabled: true })
            .then((response) => {
                if (cancelled) return
                setMembers(Array.isArray(response.data) ? response.data : [])
                setError('')
            })
            .catch((err) => {
                if (cancelled) return
                setError(getErrorMessage(err, 'No se pudieron cargar los miembros.'))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [tenantId, reload])

    // En este endpoint, is_active indica si tiene acceso a ESTE tenant
    const activeCount = members.filter((member) => member.is_active).length
    const activeAdminCount = members.filter(
        (member) => member.is_active && member.role === 'admin',
    ).length

    // El único admin activo no se puede deshabilitar
    const isLastActiveAdmin = (member) =>
        member.is_active && member.role === 'admin' && activeAdminCount <= 1

    const handleDone = (message) => {
        setEditingMember(null)
        setAccessMember(null)
        setSuccessMessage(message)
        setReload((current) => current + 1)
    }

    return (
        <Card
            title="Miembros"
            description={
                loading
                    ? 'Usuarios con acceso a este tenant.'
                    : `${members.length} con acceso registrado, ${activeCount} activos.`
            }
        >
            {successMessage ? (
                <div className="mb-4">
                    <Alert
                        variant="success"
                        title="Operación completada"
                        description={successMessage}
                        onClose={() => setSuccessMessage('')}
                    />
                </div>
            ) : null}

            {error ? (
                <div className="mb-4">
                    <Alert variant="error" title="No se pudieron cargar los miembros" description={error} />
                </div>
            ) : null}

            <Table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Acceso</th>
                        <th>Último acceso</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan="6" className="text-center text-sm text-slate-500">Cargando miembros...</td>
                        </tr>
                    ) : members.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="text-center text-sm text-slate-500">
                                Este tenant todavía no tiene miembros.
                            </td>
                        </tr>
                    ) : (
                        members.map((member) => (
                            <tr key={member.id}>
                                <td className="font-medium text-slate-900">{member.full_name || 'Sin nombre'}</td>
                                <td>{member.email}</td>
                                <td>{ROLE_LABELS[member.role] || member.role || '—'}</td>
                                <td>
                                    <Badge variant={member.is_active ? 'online' : 'offline'}>
                                        {member.is_active ? 'Activo' : 'Deshabilitado'}
                                    </Badge>
                                </td>
                                <td>{formatDate(member.last_login)}</td>
                                <td>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="ghost"
                                            className="rounded-full px-3 py-1 text-sm"
                                            onClick={() => setEditingMember(member)}
                                        >
                                            Cambiar rol
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className={`rounded-full px-3 py-1 text-sm ${member.is_active ? 'text-rose-600' : 'text-emerald-700'}`}
                                            onClick={() => setAccessMember(member)}
                                            disabled={isLastActiveAdmin(member)}
                                            title={isLastActiveAdmin(member) ? 'Es el único administrador activo' : undefined}
                                        >
                                            {member.is_active ? 'Deshabilitar' : 'Habilitar'}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </Table>
            {editingMember ? (
                <EditMemberRoleModal
                    tenantId={tenantId}
                    member={editingMember}
                    onClose={() => setEditingMember(null)}
                    onDone={handleDone}
                />
            ) : null}

            {accessMember ? (
                <MemberAccessModal
                    tenantId={tenantId}
                    member={accessMember}
                    onClose={() => setAccessMember(null)}
                    onDone={handleDone}
                />
            ) : null}
        </Card>
    )
}

export default TenantMembersCard