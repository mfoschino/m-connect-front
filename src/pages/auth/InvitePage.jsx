import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { iamAccount, iamInviteToken } from '../../services/auth/iamRuntime.js'
import { invitationAcceptErrorMessage } from '../../services/auth/iamUi.js'
import { decideInviteScreen, readInviteToken } from '../../services/invitationAcceptFlow'
import { ROLE_LABELS, formatDate } from '../platform/platformUtils'
import InviteCreateAccountForm from './InviteCreateAccountForm'

// Se usa una sola vez, al crear la pantalla:
// si el token viene en la URL, lo guarda; si no, lo busca en lo guardado
const resolveInitialToken = (hash) => {
    const tokenFromUrl = readInviteToken(hash)

    if (tokenFromUrl) {
        iamInviteToken.save(tokenFromUrl)
        return tokenFromUrl
    }
    return iamInviteToken.get() || ''
}

const InvitePage = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const auth = useAuth()

    // El token se lee UNA sola vez: es el valor inicial del estado
    const [token] = useState(() => resolveInitialToken(location.hash))

    const [phase, setPhase] = useState(token ? 'verifying' : 'invalid')
    const [preview, setPreview] = useState(null)
    const [error, setError] = useState(token ? '' : 'El link de invitación está incompleto o no es válido.')
    const [reload, setReload] = useState(0)
    const [loggingOut, setLoggingOut] = useState(false)
    const [accepting, setAccepting] = useState(false)
    const [acceptError, setAcceptError] = useState('')
    const [acceptedResult, setAcceptedResult] = useState(null)
    const acceptPendingRef = useRef(false)

    // Sacar el token de la URL apenas se leyó
    useEffect(() => {
        if (location.hash) {
            navigate('/invite', { replace: true })
        }
    }, [location.hash, navigate])

    // Pedirle al backend los datos de la invitación
    useEffect(() => {
        if (!token) return undefined

        let cancelled = false

        iamAccount
            .inspectInvitation(token)
            .then((data) => {
                if (cancelled) return
                setPreview(data)
                setPhase('ready')
            })
            .catch((err) => {
                if (cancelled) return
                setError(invitationAcceptErrorMessage(err).message)

                if (err?.status === 410 || err?.status === 422) {
                    // El link ya no sirve: no tiene sentido guardarlo
                    iamInviteToken.clear()
                    setPhase('invalid')
                } else if (err?.status === 409) {
                    // Tenant suspendido: puede reactivarse, así que guardamos el token
                    setPhase('blocked')
                } else {
                    setPhase('error')
                }
            })

        return () => {
            cancelled = true
        }
    }, [token, reload])

    const handleRetry = () => {
        setError('')
        setPhase('verifying')
        setReload((current) => current + 1)
    }

    // El link dejó de servir: lo borramos y mostramos el error
    const handleInvalid = (message) => {
        iamInviteToken.clear()
        setError(message)
        setPhase('invalid')
    }

    // Cierra la sesión abierta para poder crear la cuenta del invitado
    const handleLogoutKeepingInvite = async () => {
        setLoggingOut(true)
        try {
            await auth.logout()
        } finally {
            // logout() borra el token guardado: lo volvemos a guardar
            iamInviteToken.save(token)
            setLoggingOut(false)
        }
    }

    // Aceptar con la sesión actual (la cuenta correcta ya está logueada)
    const handleAcceptWithSession = async () => {
        if (acceptPendingRef.current) return
        acceptPendingRef.current = true
        setAccepting(true)
        setAcceptError('')

        try {
            const result = await iamAccount.acceptInvitationWithSession(token)
            iamInviteToken.clear()
            setAcceptedResult(result)

            // Actualiza las organizaciones del usuario, para que la nueva aparezca en el selector
            try {
                await auth.reloadUser()
            } catch {
                // La invitación ya quedó aceptada; si esto falla, se actualiza en la próxima carga
            }
        } catch (err) {
            const { message } = invitationAcceptErrorMessage(err, { email: preview.email })

            if (err?.status === 410) {
                handleInvalid(message)
                return
            }
            if (err?.status === 409) {
                handleRetry()
                return
            }
            setAcceptError(message)
        } finally {
            acceptPendingRef.current = false
            setAccepting(false)
        }
    }

    // Cambiar a la organización a la que se acaba de sumar
    const handleGoToTenant = async () => {
        setAcceptError('')
        try {
            await auth.switchTenant(acceptedResult.tenant_id)
            navigate('/dashboard', { replace: true })
        } catch (err) {
            setAcceptError(invitationAcceptErrorMessage(err).message)
        }
    }

    const loginLink = (
        <Link to="/login" className="block text-center text-sm font-semibold text-slate-900 underline">
            Ir a iniciar sesión
        </Link>
    )

    const renderSummary = () => (
        <div className="space-y-1 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
                {preview.invited_by ? `${preview.invited_by} te invitó` : 'Te invitaron'} a{' '}
                <strong>{preview.tenant_name}</strong> como{' '}
                <strong>{ROLE_LABELS[preview.role] || preview.role}</strong>.
            </p>
            <p>Para: {preview.email}</p>
            <p>Vence: {formatDate(preview.expires_at)}</p>
        </div>
    )

    const renderContent = () => {
        if (phase === 'verifying') {
            return <p className="text-center text-sm text-slate-500">Verificando la invitación...</p>
        }

        if (phase === 'invalid' || phase === 'blocked') {
            return (
                <div className="space-y-4">
                    <Alert variant="error" title="No se puede usar esta invitación" description={error} />
                    {loginLink}
                </div>
            )
        }

        if (phase === 'error') {
            return (
                <div className="space-y-4">
                    <Alert variant="error" title="No se pudo verificar la invitación" description={error} />
                    <Button className="w-full" onClick={handleRetry}>
                        Reintentar
                    </Button>
                </div>
            )
        }

        if (!auth.hasBootstrapped) {
            return <p className="text-center text-sm text-slate-500">Cargando sesión...</p>
        }

        if (auth.switching) {
            return <p className="text-center text-sm text-slate-500">Cambiando de organización...</p>
        }

        if (acceptedResult) {
            return (
                <div className="space-y-4">
                    <Alert
                        variant="success"
                        title="¡Listo!"
                        description={`Te sumaste a ${acceptedResult.tenant_name} como ${ROLE_LABELS[acceptedResult.role] || acceptedResult.role
                            }.`}
                    />
                    {acceptError ? (
                        <Alert variant="error" title="No se pudo cambiar de organización" description={acceptError} />
                    ) : null}
                    <Button className="w-full" onClick={handleGoToTenant}>
                        Ir a {acceptedResult.tenant_name}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard', { replace: true })}>
                        Seguir en mi organización actual
                    </Button>
                </div>
            )
        }

        const screen = decideInviteScreen({
            preview,
            authenticated: auth.authenticated,
            user: auth.user,
        })

        if (screen === 'create') {
            return (
                <div className="space-y-5">
                    {renderSummary()}
                    <InviteCreateAccountForm
                        token={token}
                        preview={preview}
                        onInvalid={handleInvalid}
                        onRecheck={handleRetry}
                    />
                </div>
            )
        }

        if (screen === 'create_other_session') {
            return (
                <div className="space-y-4">
                    {renderSummary()}
                    <Alert
                        variant="warning"
                        title="Hay otra sesión abierta"
                        description={`Iniciaste sesión como ${auth.user?.email}. Para crear la cuenta de ${preview.email}, primero cerrá esa sesión.`}
                    />
                    <Button className="w-full" onClick={handleLogoutKeepingInvite} loading={loggingOut}>
                        Cerrar sesión y continuar
                    </Button>
                </div>
            )
        }

        if (screen === 'login_required') {
            return (
                <div className="space-y-4">
                    {renderSummary()}
                    <Alert
                        variant="info"
                        title="Ya tenés una cuenta"
                        description={`Iniciá sesión con ${preview.email} para aceptar. Después vas a volver a esta pantalla.`}
                    />
                    <Button
                        className="w-full"
                        onClick={() => navigate('/login', { state: { from: { pathname: '/invite' } } })}
                    >
                        Iniciar sesión
                    </Button>
                </div>
            )
        }

        if (screen === 'superadmin') {
            return (
                <div className="space-y-4">
                    {renderSummary()}
                    <Alert
                        variant="warning"
                        title="Sesión de superadmin"
                        description={`Los superadmins no se suman a organizaciones. Cerrá sesión e ingresá con ${preview.email} para aceptar.`}
                    />
                    <Button className="w-full" onClick={handleLogoutKeepingInvite} loading={loggingOut}>
                        Cerrar sesión
                    </Button>
                </div>
            )
        }

        if (screen === 'accept_with_session') {
            return (
                <div className="space-y-4">
                    {renderSummary()}
                    {acceptError ? (
                        <Alert variant="error" title="No se pudo aceptar la invitación" description={acceptError} />
                    ) : null}
                    <Button className="w-full" onClick={handleAcceptWithSession} loading={accepting}>
                        Aceptar invitación
                    </Button>
                </div>
            )
        }

        if (screen === 'wrong_account') {
            return (
                <div className="space-y-4">
                    {renderSummary()}
                    <Alert
                        variant="warning"
                        title="Sesión con otra cuenta"
                        description={`Estás logueado como ${auth.user?.email}, pero la invitación es para ${preview.email}. Cerrá sesión e ingresá con la cuenta correcta.`}
                    />
                    <Button className="w-full" onClick={handleLogoutKeepingInvite} loading={loggingOut}>
                        Cerrar sesión
                    </Button>
                </div>
            )
        }

        return (
            <Alert
                variant="error"
                title="No se pudo procesar la invitación"
                description="Ocurrió un caso inesperado. Intentá abrir el link de nuevo."
            />
        )
    }

    return (
        <AuthLayout title="Invitación" subtitle="Unite a una organización en M-Connect.">
            {renderContent()}
        </AuthLayout>
    )
}

export default InvitePage