const clone = (value) => JSON.parse(JSON.stringify(value))

export const shouldShowCreationPresets = (showPresets, resourceId) => (
  Boolean(showPresets && !resourceId)
)

export const LOOKUP_TABLE_PRESETS = [
  {
    id: 'tiendanube-status-map',
    label: 'Tienda Nube — Estados de pedido',
    description: 'Traduce open, closed y cancelled al estado canónico de sales_order.',
    values: {
      name: 'TiendaNubeStatusMap',
      entries: {
        open: 'confirmed',
        closed: 'completed',
        cancelled: 'cancelled',
      },
    },
  },
]

export const MAPPING_PROFILE_PRESETS = [
  {
    id: 'tiendanube-sales-order-inbound',
    label: 'Tienda Nube → Sales Order canónico',
    description: 'Perfil inbound basado en el payload real de Tienda Nube API 2025-03.',
    values: {
      source_system: 'tiendanube',
      entity: 'sales_order',
      version: '1.0.0',
      config: [
        { source_field: 'id', target_field: 'external_id', field_type: 'expression', expression: 'str(id)' },
        { source_field: 'number', target_field: 'order_number', field_type: 'expression', expression: 'str(number)', on_error: 'skip' },
        { source_field: 'id', target_field: 'customer_id', field_type: 'expression', expression: "str(customer['id'])" },
        {
          source_field: 'status',
          target_field: 'status',
          field_type: 'lookup',
          lookup_table_name: 'TiendaNubeStatusMap',
          on_error: 'default',
          default_value: 'pending',
        },
        { source_field: 'currency', target_field: 'currency', field_type: 'simple', on_error: 'skip' },
        { source_field: 'subtotal', target_field: 'subtotal', field_type: 'simple', on_error: 'skip' },
        { source_field: 'discount', target_field: 'discount_total', field_type: 'simple', on_error: 'skip' },
        { source_field: 'total', target_field: 'total', field_type: 'simple' },
        { source_field: 'created_at', target_field: 'ordered_at', field_type: 'datetime', on_error: 'skip' },
        { source_field: 'updated_at', target_field: 'updated_at', field_type: 'datetime', on_error: 'skip' },
        {
          source_field: 'products',
          target_field: 'lines',
          field_type: 'table',
          sub_mappings: [
            { source_field: 'product_id', target_field: 'product_id', field_type: 'expression', expression: 'str(product_id)' },
            { source_field: 'sku', target_field: 'sku', field_type: 'simple', on_error: 'skip' },
            { source_field: 'name', target_field: 'description', field_type: 'simple', on_error: 'skip' },
            { source_field: 'quantity', target_field: 'quantity', field_type: 'simple' },
            { source_field: 'price', target_field: 'unit_price', field_type: 'simple' },
            { target_field: 'total', field_type: 'expression', expression: 'float(price) * quantity' },
          ],
        },
        {
          source_field: 'shipping_address',
          target_field: 'shipping_address',
          field_type: 'nested_object',
          sub_mappings: [
            { source_field: 'shipping_address.address', target_field: 'street', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.number', target_field: 'number', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.floor', target_field: 'floor', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.city', target_field: 'city', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.province', target_field: 'state', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.country', target_field: 'country', field_type: 'path', on_error: 'skip' },
            { source_field: 'shipping_address.zipcode', target_field: 'zip_code', field_type: 'path', on_error: 'skip' },
          ],
        },
      ],
      is_active: true,
    },
  },
  {
    id: 'finnegans-pedido-venta-outbound',
    label: 'Sales Order canónico → Finnegans Pedido de Venta',
    description: 'Perfil outbound para /api/pedidoVenta; requiere completar los códigos maestros señalados.',
    values: {
      source_system: 'finnegans',
      entity: 'sales_order',
      version: '1.0.0',
      config: [
        { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
        { source_field: 'ordered_at', target_field: 'Fecha', field_type: 'datetime', target_format: 'date' },
        { source_field: 'customer_id', target_field: 'OrganizacionID', field_type: 'simple' },
        {
          source_field: 'currency',
          target_field: 'MonedaID',
          field_type: 'lookup',
          lookup_table_name: 'FinnegansMonedaMap',
          on_error: 'default',
          default_value: 'PES',
        },
        { source_field: 'external_id', target_field: 'CondicionPagoID', field_type: 'constant', value: 'CONTADO' },
        { source_field: 'external_id', target_field: 'TransaccionTipoID', field_type: 'constant', value: 'OPER' },
        { source_field: 'external_id', target_field: 'TransaccionSubtipoID', field_type: 'constant', value: '⚠️_SUBTIPO' },
        { source_field: 'external_id', target_field: 'WorkflowID', field_type: 'constant', value: 'VENTAS' },
        { source_field: 'external_id', target_field: 'EmpresaID', field_type: 'constant', value: '⚠️_EMPRESA' },
        {
          source_field: 'lines',
          target_field: 'OperacionItems',
          field_type: 'table',
          sub_mappings: [
            { source_field: 'sku', target_field: 'ProductoID', field_type: 'simple' },
            { source_field: 'quantity', target_field: 'CantidadWorkflow', field_type: 'simple' },
            { source_field: 'unit_price', target_field: 'Precio', field_type: 'simple' },
            { source_field: 'sku', target_field: 'Descuento1', field_type: 'constant', value: '0' },
            { source_field: 'sku', target_field: 'IdentificacionExterna', field_type: 'simple' },
          ],
        },
      ],
      is_active: true,
    },
  },
  {
    id: 'finnegans-punto-venta-outbound',
    label: 'Sales Order canónico → Finnegans Punto de Venta',
    description: 'El runbook identifica el profile, pero no incluye la config del seed PuntoVentaItem.',
    incomplete: true,
    note: 'Completá manualmente los mappings de PuntoVentaItem; el runbook no define su estructura exacta.',
    values: {
      source_system: 'finnegans_punto_venta',
      entity: 'sales_order',
      version: '1.0.0',
      config: [],
      is_active: true,
    },
  },
]

const getPreset = (presets, presetId) => {
  const preset = presets.find((candidate) => candidate.id === presetId)
  return preset ? clone(preset) : null
}

export const getLookupTablePreset = (presetId) => getPreset(LOOKUP_TABLE_PRESETS, presetId)

export const getMappingProfilePreset = (presetId) => getPreset(MAPPING_PROFILE_PRESETS, presetId)
