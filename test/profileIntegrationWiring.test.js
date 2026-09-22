import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (relativePath) => readFile(
  new URL(relativePath, import.meta.url),
  'utf8',
)

test('profile save wiring keeps one request in flight and leaves failures inside the open form', async () => {
  const source = await readSource('../src/pages/integrations/Integrations.jsx')
  const handlerStart = source.indexOf('const handleProfileSave = async')
  const handlerEnd = source.indexOf('const openProfileDetail = async', handlerStart)
  const handler = source.slice(handlerStart, handlerEnd)

  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart)
  assert.match(handler, /if \(profileSaveInFlightRef\.current\) return/)
  assert.match(handler, /profileSaveInFlightRef\.current = true/)
  assert.match(handler, /getApiErrorMessage\(err, 'Error al guardar el perfil\.'\)/)
  assert.match(handler, /finally \{[\s\S]*profileSaveInFlightRef\.current = false/)

  const catchBlock = handler.slice(handler.indexOf('} catch (err) {'), handler.indexOf('} finally {'))
  assert.doesNotMatch(catchBlock, /closeProfileModal|setSelectedProfile/)
  assert.match(source, /loading=\{profileModalLoading\}/)
  assert.match(source, /saveError=\{profileModalError\}/)
})

test('the reset button is wired to restore the form baseline', async () => {
  const [formSource, builderSource] = await Promise.all([
    readSource('../src/components/integrations/ProfileForm.jsx'),
    readSource('../src/components/integrations/FieldMappingBuilder.jsx'),
  ])

  assert.match(formSource, /config: getResetProfileMappings\(initialFormValues\.config\)/)
  assert.match(formSource, /onResetMappings=\{handleResetMappings\}/)
  assert.match(builderSource, /onClick=\{onResetMappings\}/)
  assert.doesNotMatch(builderSource, /onClick=\{\(\) => setFieldMappings\(\[\]\)\}/)
})

test('profile detail loading is generation-guarded and fails closed', async () => {
  const source = await readSource('../src/pages/integrations/Integrations.jsx')
  const createStart = source.indexOf('const openProfileCreate = () =>')
  const editStart = source.indexOf('const openProfileEdit = async', createStart)
  const closeStart = source.indexOf('const closeProfileModal = () =>', editStart)
  const saveStart = source.indexOf('const handleProfileSave = async', closeStart)
  const createHandler = source.slice(createStart, editStart)
  const editHandler = source.slice(editStart, closeStart)
  const closeHandler = source.slice(closeStart, saveStart)

  assert.match(createHandler, /invalidateProfileLoadRequests\(profileLoadRequestRef\)/)
  assert.match(createHandler, /setProfileModalLoading\(false\)/)
  assert.match(editHandler, /beginProfileLoadRequest\(profileLoadRequestRef, requestedProfileId\)/)
  assert.match(editHandler, /setProfileModalOpen\(true\)/)
  assert.match(editHandler, /loadProfileForEditRequest/)
  assert.match(editHandler, /onError:[\s\S]*setSelectedProfile\(null\)/)
  assert.doesNotMatch(editHandler, /response\.data \|\| profile|setSelectedProfile\(profile\)/)
  assert.match(closeHandler, /invalidateProfileLoadRequests\(profileLoadRequestRef\)/)
  assert.match(closeHandler, /setProfileModalLoading\(false\)/)
  assert.match(source, /!shouldRenderProfileForm\(profileModalMode, selectedProfile\)/)
})
