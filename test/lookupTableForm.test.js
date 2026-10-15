import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('LookupTableForm renders from scratch with initialValues={}', async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const { default: LookupTableForm } = await vite.ssrLoadModule(
      '/src/components/integrations/LookupTableForm.jsx',
    )
    const html = renderToString(React.createElement(LookupTableForm, {
      initialValues: {},
      onCancel: () => {},
      onSubmit: () => {},
      showPresets: true,
      submitLabel: 'Crear tabla',
    }))

    assert.match(html, /Código/)
    assert.match(html, /Nombre descriptivo/)
    assert.match(html, /Tabla activa/)
    assert.match(html, /Entradas de la tabla/)
    assert.match(html, /Crear tabla/)
  } finally {
    await vite.close()
  }
})
