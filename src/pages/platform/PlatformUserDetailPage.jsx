import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import platformService from '../../services/api/platformService'
import { ROLE_LABELS, formatDate, getErrorMessage } from './platformUtils'
import BackLink from '../../components/platform/BackLink'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import ConfirmActionModal from './ConfirmActionModal'


const PlatformUserDetailPage = () => {
    const { userId } = useParams()
    const { user } = useAuth()
    const backLink = <BackLink fallbackTo="/platform/users" fallbackLabel="Volver a usuarios" />

    const [account, setAccount] = useState(null)
    const [lockedNow, setLockedNow] = useState(false)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [error, setError] = useState('')

    const [reload, setReload] = useState(0)
    const [successMessage, setSuccessMessage] = useState('')
    const [actionError, setActionError] = useState('')
    const [pendingAction, setPendingAction] = useState(null)
    const [unlocking, setUnlocking] = useState(false)

    useEffect(() => {
        let cancelled = false

        platformService
            .getUser(userId)
            .then((response) => {
                if (cancelled) return
                const data = response.data
                setAccount(data)
                // ¿El bloqueo por intentos sigue vigente? Se calcula al recibir los datos, no al dibujar
                setLockedNow(Boolean(data?.locked_until) && new Date(data.locked_until).getTime() > Date.now())
                setNotFound(false)
                setError('')
            })
            .catch((err) => {
                if (cancelled) return
                if (err?.response?.status === 404) {
                    setNotFound(true)
                } else {
                    setError(getErrorMessage(err, 'No se pudo cargar el usuario.'))
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [userId, reload])

    const handleActionDone = (message) => {
        setPendingAction(null)
        setActionError('')
        setSuccessMessage(message)
        setReload((current) => current + 1)
    }

    // Quitar el bloqueo por intentos no necesita confirmación
    const handleUnlock = async () => {
        setUnlocking(true)
        setActionError('')
        setSuccessMessage('')

        try {
            await platformService.unlockUser(account.id)
            setSuccessMessage(`Se quitó el bloqueo por intentos de ${account.email}.`)
            setReload((current) => current + 1)
        } catch (err) {
            setActionError(getErrorMessage(err, 'No se pudo quitar el bloqueo.'))
        } finally {
            setUnlocking(false)
        }
    }


    if (loading) {
        return (
            <div className="space-y-6">
                {backLink}
                <p className="text-sm text-slate-500">Cargando usuario...</p>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="space-y-6">
                {backLink}
                <Card title="Usuario no encontrado" description="El usuario que buscás no existe o la dirección está mal escrita." />
            </div>
        )
    }

    if (!account) {
        return (
            <div className="space-y-6">
                {backLink}
                <Alert variant="error" title="No se pudo cargar el usuario" description={error} />
            </div>
        )
    }

    const superadmin = account.platform_role === 'superadmin'
    const memberships = account.memberships ?? []
    const isSelf = user?.id === account.id

    // ¿Tiene algún acceso activo a un tenant?
    const hasActiveAccess = memberships.some((membership) => membership.status === 'active')

    // Si no se puede hacer superadmin, por qué (vacío = sí se puede)
    const grantBlockedReason = !account.is_active
        ? 'La cuenta está bloqueada. Desbloqueala primero.'
        : hasActiveAccess
            ? 'Tiene accesos activos a tenants. Un superadmin no puede trabajar dentro de un tenant: primero deshabilitá sus accesos.'
            : ''

    // Qué texto muestra y qué hace cada acción con confirmación
    const actions = {
        block: {
            title: 'Bloquear cuenta',
            warningTitle: 'La persona no va a poder entrar',
            warningText: `${account.email} va a perder el acceso a todos sus tenants, se van a cerrar todas sus sesiones y se van a olvidar sus dispositivos recordados. Podés desbloquearla después.`,
            confirmLabel: 'Bloquear',
            danger: true,
            run: async () => {
                await platformService.updateUser(account.id, { is_active: false })
                return `Se bloqueó la cuenta de ${account.email}.`
            },
        },

        unblock: {
            title: 'Desbloquear cuenta',
            warningTitle: 'La persona va a poder entrar',
            warningText: `${account.email} va a poder volver a entrar a sus tenants, con los mismos accesos que tenía.`,
            confirmLabel: 'Desbloquear',
            danger: false,
            run: async () => {
                await platformService.updateUser(account.id, { is_active: true })
                return `Se desbloqueó la cuenta de ${account.email}.`
            },
        },

        revoke: {
            title: 'Cerrar todas las sesiones',
            warningTitle: 'Se va a cerrar su sesión en todos los dispositivos',
            warningText: `${account.email} va a tener que volver a iniciar sesión. Su cuenta y sus accesos no cambian.`,
            confirmLabel: 'Cerrar sesiones',
            danger: true,
            run: async () => {
                await platformService.revokeUserSessions(account.id)
                return `Se cerraron todas las sesiones de ${account.email}.`
            },
        },
        reset: {
            title: 'Forzar cambio de contraseña',
            warningTitle: 'Su contraseña actual va a dejar de funcionar',
            warningText: `Se van a cerrar todas sus sesiones y ${account.email} va a recibir un correo con un código para elegir una contraseña nueva. Hasta entonces, no va a poder entrar.`,
            confirmLabel: 'Forzar cambio',
            danger: true,
            run: async () => {
                await platformService.forcePasswordReset(account.id)
                return `Se forzó el cambio de contraseña de ${account.email}. Le va a llegar un correo con un código.`
            },
        },

        grantSuperadmin: {
            title: 'Hacer superadmin',
            warningTitle: 'Va a tener control total de la plataforma',
            warningText: `${account.email} va a poder crear y suspender tenants, gestionar todas las cuentas y entrar a cualquier tenant en modo soporte, y se van a cerrar todas sus sesiones.`,
            confirmLabel: 'Hacer superadmin',
            danger: true,
            run: async () => {
                await platformService.updateUser(account.id, { platform_role: 'superadmin' })
                return `La cuenta de ${account.email} ahora es superadmin.`
            },
        },

        revokeSuperadmin: {
            title: 'Quitar rol de superadmin',
            warningTitle: 'Va a perder el acceso a la consola',
            warningText: `${account.email} va a dejar de administrar la plataforma y se van a cerrar todas sus sesiones. Después se le pueden dar accesos a tenants.`,
            confirmLabel: 'Quitar rol',
            danger: true,
            run: async () => {
                await platformService.updateUser(account.id, { platform_role: null })
                return `La cuenta de ${account.email} ya no es superadmin.`
            }
        },
    }

    const currentAction = pendingAction ? actions[pendingAction] : null

    return (
        <div className="space-y-8">
            {backLink}

            <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Usuario</p>
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="section-title">{account.full_name || account.email}</h2>
                    {superadmin ? <Badge variant="pending">Superadmin</Badge> : null}
                    <Badge variant={account.is_active ? 'online' : 'offline'}>
                        {account.is_active ? 'Cuenta activa' : 'Cuenta bloqueada'}
                    </Badge>
                    {lockedNow ? <Badge variant="failed">Bloqueada por intentos</Badge> : null}
                    {account.is_verified === false ? <Badge variant="retrying">Email sin verificar</Badge> : null}
                </div>
                <p className="section-subtitle">{account.email}</p>
                <Link to={`/platform/audit?actor=${account.id}`} className="btn btn-outline">
                    Ver acciones de este usuario
                </Link>
            </div>

            <Card title="Datos de la cuenta">
                <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <dt className="text-sm text-slate-500">Último acceso</dt>
                        <dd className="font-medium text-slate-900">{formatDate(account.last_login)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-slate-500">Cuenta creada</dt>
                        <dd className="font-medium text-slate-900">{formatDate(account.created_at)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-slate-500">Sesiones activas</dt>
                        <dd className="font-medium text-slate-900">{account.active_sessions ?? 0}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-slate-500">Bloqueo por intentos fallidos</dt>
                        <dd className="font-medium text-slate-900">
                            {lockedNow ? `Hasta ${formatDate(account.locked_until)}` : 'No'}
                        </dd>
                    </div>
                </dl>
            </Card>

            <Card
                title="Accesos a tenants"
                description="Organizaciones a las que tiene acceso, con su rol en cada una."
            >
                <Table>
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Rol</th>
                            <th>Acceso</th>
                            <th>Estado del tenant</th>
                        </tr>
                    </thead>
                    <tbody>
                        {memberships.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center text-sm text-slate-500">
                                    {superadmin
                                        ? 'Los superadmins no tienen accesos a tenants.'
                                        : 'Este usuario no tiene accesos a tenants.'}
                                </td>
                            </tr>
                        ) : (
                            memberships.map((membership) => (
                                <tr key={membership.tenant_id}>
                                    <td>
                                        <Link
                                            to={`/platform/tenants/${membership.tenant_id}`}
                                            state={{
                                                from: {
                                                    pathname: `/platform/users/${account.id}`,
                                                    label: `Volver a ${account.full_name || account.email}`,
                                                },
                                            }}
                                            className="font-medium text-slate-900 hover:underline"
                                        >
                                            {membership.tenant_name}
                                        </Link>
                                    </td>
                                    <td>{ROLE_LABELS[membership.role] || membership.role || '-'}</td>
                                    <td>
                                        <Badge variant={membership.status === 'active' ? 'online' : 'offline'}>
                                            {membership.status === 'active' ? 'Activo' : 'Deshabilitado'}
                                        </Badge>
                                    </td>
                                    <td>
                                        <Badge variant={membership.tenant_is_active ? 'online' : 'offline'}>
                                            {membership.tenant_is_active ? 'Activo' : 'Suspendido'}
                                        </Badge>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </Card>

            <Card
                title="Acciones sobre la cuenta"
                description="Afectan a la cuenta en toda la plataforma, no solo en un tenant."
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

                {actionError ? (
                    <div className="mb-4">
                        <Alert
                            variant="error"
                            title="No se pudo completar la acción"
                            description={actionError}
                            onClose={() => setActionError('')}
                        />
                    </div>
                ) : null}

                {isSelf ? (
                    <Alert
                        variant="info"
                        title="Es tu cuenta"
                        description="Para que no te quedes afuera de la plataforma, estas acciones no se pueden usar sobre tu propia cuenta."
                    />
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {account.is_active ? (
                            <Button variant="danger" onClick={() => setPendingAction('block')}>
                                Bloquear cuenta
                            </Button>
                        ) : (
                            <Button onClick={() => setPendingAction('unblock')}>Desbloquear cuenta</Button>
                        )}
                        {lockedNow ? (
                            <Button variant="outline" onClick={handleUnlock} loading={unlocking}>
                                Quitar bloqueo por intentos
                            </Button>
                        ) : null}
                        <Button
                            variant="outline"
                            onClick={() => setPendingAction('revoke')}
                            disabled={!account.active_sessions}
                            title={!account.active_sessions ? 'No tiene sesiones abiertas' : undefined}
                        >
                            Cerrar todas las sesiones
                        </Button>
                        <Button variant="outline" onClick={() => setPendingAction('reset')}>
                            Forzar cambio de contraseña
                        </Button>
                    </div>
                )}
            </Card>

            <Card
                title="Rol de plataforma"
                description="Los superadmins administran toda la plataforma: tenants, cuentas y sesiones de soporte."
            >
                {isSelf ? (
                    <Alert
                        variant="info"
                        title="Es tu cuenta"
                        description="No podés cambiar tu propio rol."
                    />
                ) : superadmin ? (
                    <Button
                        variant="danger" onClick={() => setPendingAction('revokeSuperadmin')}
                    >
                        Quitar rol de superadmin
                    </Button>
                ) : (
                    <div>
                        <Button
                            onClick={() => setPendingAction('grantSuperadmin')}
                            disabled={Boolean(grantBlockedReason)}
                        >
                            Hacer superadmin
                        </Button>
                        {grantBlockedReason ? (
                            <p className="mt-2 text-sm text-slate-500">{grantBlockedReason}</p>
                        ) : null}
                    </div>
                )}

            </Card>

            {currentAction ? (
                <ConfirmActionModal
                    title={currentAction.title}
                    subtitle={account.email}
                    warningTitle={currentAction.warningTitle}
                    warningText={currentAction.warningText}
                    confirmLabel={currentAction.confirmLabel}
                    danger={currentAction.danger}
                    onConfirm={currentAction.run}
                    onClose={() => setPendingAction(null)}
                    onDone={handleActionDone}
                />
            ) : null}
        </div>
    )
}

export default PlatformUserDetailPage