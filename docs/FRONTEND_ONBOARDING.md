# Onboarding técnico del frontend de M-Connect

## 1. Qué contiene este repositorio

M-Connect es una plataforma de integraciones no-code orientada a usuarios de negocio. Permite configurar conexiones entre sistemas, mapeos, tablas de equivalencias, programaciones y consultar ejecuciones sin trabajar directamente con contratos JSON.

Este repositorio contiene únicamente el frontend. Su responsabilidad es presentar esa experiencia y convertir las acciones del usuario en llamadas a la API de M-Connect. No contiene la instalación ni la configuración del backend.

Stack comprobado en `package.json` y en el código:

- React 19 con JavaScript/JSX.
- Vite 8 y `@vitejs/plugin-react`.
- npm y `package-lock.json`.
- React Router, Axios, Tailwind CSS, PostCSS y ESLint.

## 2. Requisitos previos

### Git

Se necesita Git para clonar el repositorio. Una versión mínima de Git: **No está definido en el repositorio**.

### Node.js

El proyecto no incluye `.nvmrc`, `.node-version` o `.tool-versions`, ni declara `engines` en `package.json`. Por lo tanto, una versión única de Node.js: **No está definido en el repositorio**.

Sin embargo, las versiones resueltas en `package-lock.json` sí establecen estas restricciones:

- Vite 8.0.10 y `@vitejs/plugin-react` 6.0.1: `^20.19.0 || >=22.12.0`.
- ESLint 10.3.0: `^20.19.0 || ^22.13.0 || >=24`.

Para poder ejecutar también el lint, la intersección compatible es Node.js 20 desde 20.19.0, Node.js 22 desde 22.13.0, o Node.js 24 o superior. Una elección concreta compatible es una versión 22.x igual o posterior a 22.13.0; el repositorio no la fija como versión oficial.

Comprobar la instalación:

```powershell
node --version
npm --version
```

### npm

Una versión exacta de npm: **No está definido en el repositorio**. No hay campo `packageManager` ni archivo `.npmrc`. Debe usarse npm, porque el repositorio versiona `package-lock.json`; no se necesita instalar otro gestor de paquetes.

Para levantar sólo la interfaz no se requiere otra dependencia global. Para usar sus funciones completas también debe estar disponible la API de M-Connect; se detalla más abajo.

## 3. Clonar y entrar al proyecto

El remoto `origin` configurado en este checkout es:

```powershell
git clone https://github.com/mfoschino/m-connect-front.git
cd m-connect-front
```

La raíz clonada ya es la carpeta del frontend: allí están `package.json`, `vite.config.js` y `src/`. No hay que entrar a un subdirectorio adicional.

## 4. Instalar dependencias

Para onboarding se recomienda:

```powershell
npm ci
```

`package-lock.json` existe, está versionado y usa `lockfileVersion: 3`. `npm ci` hace una instalación reproducible a partir del lockfile, exige que sea coherente con `package.json` y reemplaza cualquier `node_modules` existente. No modifica intencionalmente `package.json` ni `package-lock.json`.

Usar `npm install` sólo cuando se esté modificando deliberadamente el árbol de dependencias y se espere actualizar el lockfile. No es el comando recomendado para el primer arranque.

## 5. Variables de entorno

El código utiliza una sola variable de entorno:

| Variable | Uso | ¿Es obligatoria? | Ejemplo seguro | Dónde configurarla |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | Es el `baseURL` del cliente Axios compartido por autenticación y servicios de API. | No para iniciar Vite o mostrar la pantalla de acceso; sí para que las llamadas al backend lleguen a la API correcta. | `http://localhost:8000` | `.env` para el valor compartido o `.env.local` para un override local no versionado. |

Fuente en código: `src/services/api/client.js` lee `import.meta.env.VITE_API_URL`. No se encontraron otras lecturas de `import.meta.env`, `process.env` ni otras variables `VITE_*` en el frontend.

Vite carga los archivos de entorno al iniciar. Después de modificar uno, detener y volver a ejecutar `npm run dev`. Como toda variable `VITE_*` queda disponible en el bundle del navegador, nunca se deben guardar tokens, passwords o secretos en ella.

### Estado real de los archivos de entorno

- `.env` está versionado y contiene `VITE_API_URL=http://localhost:8000/api`. Un clon nuevo recibe este valor automáticamente.
- En este checkout existe `.env.local` con `VITE_API_URL=http://localhost:8000`. Vite le da prioridad sobre `.env`, pero el patrón `*.local` de `.gitignore` impide que llegue a un clon nuevo.
- `.env.example` no existe.

No se detectaron credenciales en esos archivos; sólo está definida la URL anterior. Hay una diferencia de path que conviene resolver en el repositorio: con el `.env` versionado, el login apunta a `http://localhost:8000/api/auth/login`; con el override local, apunta a `http://localhost:8000/auth/login`. La documentación incluida en `docs/api` usa `http://localhost:8000` y rutas como `/auth/login`. Cuál de las dos bases es la canónica para todos los entornos: **No está definido en el repositorio**.

No editar ni versionar `.env.local` si el valor es propio de la máquina. Si se necesita el backend sin prefijo `/api`, crear o ajustar localmente:

```dotenv
VITE_API_URL=http://localhost:8000
```

## 6. Dependencia respecto del backend

El frontend puede iniciar sin backend. Al abrirlo sin una sesión guardada, las rutas protegidas redirigen a `/login`, y esa pantalla puede renderizarse aunque la API no esté disponible.

Para iniciar sesión y usar la aplicación completa, la API de M-Connect debe estar accesible en el valor efectivo de `VITE_API_URL`. El frontend consume, entre otras, funciones de autenticación y usuario actual, dashboard, integraciones, perfiles de mapeo, tablas de lookup, metadatos, ejecuciones y logs, notificaciones, perfil, administración de usuarios y credenciales Finnegans por tenant.

Configuración comprobada:

- Puerto de backend referenciado en los archivos de entorno y en `docs/api`: `8000`.
- Base efectiva en este checkout por precedencia de `.env.local`: `http://localhost:8000`.
- Base que recibirá un clon nuevo desde el `.env` versionado: `http://localhost:8000/api`.
- `vite.config.js` no configura un proxy. El navegador llama directamente a esa base URL, por lo que la API debe aceptar el origen usado por el frontend.

Para el uso completo debe estar corriendo la API de M-Connect y, para procesar integraciones y ejecuciones, la infraestructura que el backend necesite. La forma de instalar o iniciar esos componentes: **No está definido en este repositorio frontend**.

## 7. Ejecutar en desarrollo

Desde la raíz del repositorio:

```powershell
npm run dev
```

El script `dev` ejecuta `vite`. `vite.config.js` sólo activa `@vitejs/plugin-react`; no define `server.port`, `server.host`, `strictPort`, proxy ni aliases.

En consecuencia, Vite 8.0.10 usa su puerto de desarrollo predeterminado, `5173`. La URL esperada es:

```text
http://localhost:5173/
```

Como `strictPort` no está habilitado, si el puerto 5173 está ocupado Vite intenta el siguiente puerto disponible. La URL impresa por la terminal es siempre la fuente de verdad.

Para detener el servidor, volver a la terminal y presionar `Ctrl+C`.

## 8. Cómo saber que todo funciona

1. Ejecutar `npm run dev`.
2. Confirmar que la terminal muestra `VITE v8.0.10 ready` o un mensaje equivalente, sin errores, junto con una URL local.
3. Abrir la URL indicada. Con el puerto libre debería ser `http://localhost:5173/`.
4. Confirmar que la aplicación carga y redirige a `/login` si no existe una sesión local.
5. Sin backend, llegar a la pantalla de login confirma el arranque del frontend, no la integración completa.
6. Con la API disponible, un login válido y la carga del dashboard confirman también la comunicación frontend-backend.

## 9. Scripts disponibles

Todos los scripts reales de `package.json` son:

| Comando | Qué ejecuta | Para qué sirve |
| --- | --- | --- |
| `npm run dev` | `vite` | Inicia el servidor de desarrollo con HMR. |
| `npm run build` | `vite build` | Genera el build de producción en `dist/`. |
| `npm run lint` | `eslint .` | Revisa los archivos JavaScript/JSX con la configuración de ESLint. |
| `npm test` o `npm run test` | `node --test "test/*.test.js"` | Ejecuta los tests de Node ubicados en `test/`. |
| `npm run preview` | `vite preview` | Sirve localmente el contenido previamente generado en `dist/`; no sustituye a `npm run dev`. |

No existe un script específico de typecheck, formatter o test en modo watch.

## 10. Problemas comunes

### `node` o `npm` no se reconoce como comando

Node.js no está instalado o sus ejecutables no están en `PATH`. Instalar una versión compatible, abrir una terminal nueva y comprobar:

```powershell
node --version
npm --version
```

### Falta `node_modules` o Vite no se encuentra

Desde la raíz del repositorio:

```powershell
npm ci
npm run dev
```

### `EBADENGINE`, errores de sintaxis o incompatibilidad al instalar

Comprobar que Node satisface simultáneamente las restricciones de Vite y ESLint indicadas en Requisitos previos. El repositorio no fija automáticamente esa versión.

### La interfaz abre, pero el login o los datos fallan

Comprobar el valor efectivo de `VITE_API_URL`, que la API responda en ese host/path y que se haya reiniciado Vite después de cambiar el archivo de entorno. Prestar especial atención a la diferencia entre `/api` en `.env` y la ausencia de ese prefijo en `.env.local` y `docs/api`.

Como no hay proxy de Vite, un error CORS debe resolverse haciendo coincidir el origen permitido por el entorno de API con la URL mostrada por Vite; la política concreta del backend no está definida aquí.

### El puerto 5173 está ocupado

Usar la URL alternativa que Vite muestre en la terminal. Si se necesita elegir otro puerto explícitamente para esa ejecución:

```powershell
npm run dev -- --port 5174
```

Ese valor no queda guardado en el repositorio.

### La instalación quedó inconsistente después de cambiar dependencias

Realizar la instalación limpia de la siguiente sección. No borrar ni regenerar `package-lock.json` como primer intento: es la fuente reproducible del proyecto.

## 11. Instalación limpia

Detener primero `npm run dev`. `node_modules` es generado y puede reconstruirse desde el lockfile.

En Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .\node_modules
npm ci
```

En Git Bash:

```bash
rm -rf node_modules
npm ci
```

No eliminar `.env`, `.env.local`, `package.json` ni `package-lock.json`. Si `node_modules` no existe, omitir el comando de borrado y ejecutar directamente `npm ci`.

## 12. Checklist final

- [ ] Node instalado en una versión compatible.
- [ ] Repositorio clonado.
- [ ] Dependencias instaladas con `npm ci`.
- [ ] `VITE_API_URL` revisada/configurada para el entorno.
- [ ] Backend disponible si se necesita iniciar sesión y usar funciones completas.
- [ ] `npm run dev` funcionando.
- [ ] URL localhost indicada por Vite accesible.
