/**
 * Connector Catalog Configuration
 * Maps business-friendly system names to technical connector types
 * This configuration bridges the gap between business UX and backend technical model
 * 
 * External-system labels and visual configuration remain local until backend metadata exposes them.
 */

export const CONNECTOR_TYPES = {
  API: 'api',
  DATABASE: 'db',
  FILE: 'file',
  WEBHOOK: 'webhook',
}

export const TIENDANUBE_SOURCE_SYSTEM = 'tiendanube'
export const TIENDANUBE_SALES_ORDER_ENTITY = 'sales_order'

export const getSystemPresetConfig = (sourceSystem, entity) => {
  if (
    sourceSystem !== TIENDANUBE_SOURCE_SYSTEM
    || entity !== TIENDANUBE_SALES_ORDER_ENTITY
  ) {
    return null
  }

  return {
    source_system: TIENDANUBE_SOURCE_SYSTEM,
    base_url: 'https://api.tiendanube.com',
    endpoint: '/2025-03/{{store_id}}/orders?payment_status=paid',
    auth_type: 'api_key',
    api_key_header: 'Authentication',
    api_key: 'bearer {{tn_token}}',
    headers: {
      'User-Agent': 'MiIntegracion (servicios@morganatec.com)',
      Accept: 'application/json',
    },
    data_path: null,
    pagination: {
      type: 'page_number',
      page_param: 'page',
      page_size_param: 'per_page',
      page_size: 200,
    },
  }
}

export const SYSTEM_CATALOG = [
  // API Systems
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Conectá Salesforce CRM',
    connectorType: CONNECTOR_TYPES.API,
    icon: '☁️',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    description: 'Conectá tu tienda Shopify',
    connectorType: CONNECTOR_TYPES.API,
    icon: '🛍️',
  },
  {
    id: 'tiendanube',
    name: 'Tienda Nube',
    category: 'ecommerce',
    description: 'Importá pedidos de Tienda Nube al modelo canónico de M-Connect',
    connectorType: CONNECTOR_TYPES.API,
    supportedEntities: ['sales_order'],
    icon: 'TN',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payments',
    description: 'Conectá la plataforma de pagos Stripe',
    connectorType: CONNECTOR_TYPES.API,
    icon: '💳',
  },
  {
    id: 'generic-rest-api',
    name: 'REST API',
    category: 'api',
    description: 'Conectá cualquier API REST',
    connectorType: CONNECTOR_TYPES.API,
    icon: '🔌',
  },
  
  // Database Systems
  {
    id: 'mysql',
    name: 'MySQL',
    category: 'database',
    description: 'Conectá una base de datos MySQL',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description: 'Conectá una base de datos PostgreSQL',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    category: 'database',
    description: 'Conectá Microsoft SQL Server',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'database',
    description: 'Conectá MongoDB',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  
  // File Systems
  {
    id: 'csv-file',
    name: 'Archivo CSV',
    category: 'file',
    description: 'Cargá archivos CSV',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '📄',
  },
  {
    id: 'ftp',
    name: 'FTP',
    category: 'file',
    description: 'Conectá mediante FTP/SFTP',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '📁',
  },
  {
    id: 's3',
    name: 'AWS S3',
    category: 'file',
    description: 'Conectá un bucket de AWS S3',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '☁️',
  },
  
  // Webhooks
  {
    id: 'webhook-listener',
    name: 'Receptor de webhooks',
    category: 'event',
    description: 'Recibí datos mediante webhooks',
    connectorType: CONNECTOR_TYPES.WEBHOOK,
    icon: '🔔',
  },
]

export const DESTINATION_SYSTEMS = [
  {
    id: 'mconnect-canonical',
    name: 'Formato canónico de M-Connect',
    description: 'Transformá los datos al modelo canónico de M-Connect',
    icon: '🎯',
  },
  {
    id: 'data-warehouse',
    name: 'Almacén de datos',
    description: 'Cargá los datos en un almacén de datos',
    icon: '📊',
  },
]

export const ENTITY_FIELD_SPECS = {
  sales_order: {
    sourceFields: [
      { id: 'order_id', label: 'ID del pedido' },
      { id: 'customer_email', label: 'Correo electrónico del cliente' },
      { id: 'order_date', label: 'Fecha del pedido' },
      { id: 'total_amount', label: 'Importe total' },
      { id: 'status', label: 'Estado del pedido' },
    ],
    destinationFields: [
      { id: 'OrderId', label: 'ID del pedido' },
      { id: 'Email', label: 'Correo electrónico del cliente' },
      { id: 'Date', label: 'Fecha del pedido' },
      { id: 'TotalAmount', label: 'Importe total' },
      { id: 'Status', label: 'Estado' },
    ],
  },
  customer: {
    sourceFields: [
      { id: 'customer_id', label: 'ID del cliente' },
      { id: 'first_name', label: 'Nombre' },
      { id: 'last_name', label: 'Apellido' },
      { id: 'email', label: 'Correo electrónico' },
      { id: 'phone', label: 'Teléfono' },
    ],
    destinationFields: [
      { id: 'CustomerId', label: 'ID del cliente' },
      { id: 'FirstName', label: 'Nombre' },
      { id: 'LastName', label: 'Apellido' },
      { id: 'Email', label: 'Correo electrónico' },
      { id: 'Phone', label: 'Teléfono' },
    ],
  },
  product: {
    sourceFields: [
      { id: 'product_id', label: 'ID del producto' },
      { id: 'product_name', label: 'Nombre del producto' },
      { id: 'sku', label: 'SKU' },
      { id: 'price', label: 'Precio' },
      { id: 'inventory_quantity', label: 'Cantidad en inventario' },
    ],
    destinationFields: [
      { id: 'ProductId', label: 'ID del producto' },
      { id: 'Name', label: 'Nombre del producto' },
      { id: 'SKU', label: 'SKU' },
      { id: 'Price', label: 'Precio' },
      { id: 'Stock', label: 'Cantidad en inventario' },
    ],
  },
  invoice: {
    sourceFields: [
      { id: 'invoice_id', label: 'ID de la factura' },
      { id: 'invoice_date', label: 'Fecha de la factura' },
      { id: 'customer_name', label: 'Nombre del cliente' },
      { id: 'amount_due', label: 'Importe adeudado' },
      { id: 'status', label: 'Estado de la factura' },
    ],
    destinationFields: [
      { id: 'InvoiceId', label: 'ID de la factura' },
      { id: 'Date', label: 'Fecha de la factura' },
      { id: 'CustomerName', label: 'Nombre del cliente' },
      { id: 'Amount', label: 'Importe adeudado' },
      { id: 'Status', label: 'Estado de la factura' },
    ],
  },
  inventory: {
    sourceFields: [
      { id: 'item_id', label: 'ID del artículo' },
      { id: 'item_name', label: 'Nombre del artículo' },
      { id: 'stock_level', label: 'Nivel de existencias' },
      { id: 'location', label: 'Ubicación' },
      { id: 'reorder_point', label: 'Punto de reposición' },
    ],
    destinationFields: [
      { id: 'ItemId', label: 'ID del artículo' },
      { id: 'Name', label: 'Nombre del artículo' },
      { id: 'Quantity', label: 'Nivel de existencias' },
      { id: 'Location', label: 'Ubicación' },
      { id: 'ReorderPoint', label: 'Punto de reposición' },
    ],
  },
  payment: {
    sourceFields: [
      { id: 'payment_id', label: 'ID del pago' },
      { id: 'payment_method', label: 'Método de pago' },
      { id: 'amount', label: 'Importe' },
      { id: 'currency', label: 'Moneda' },
      { id: 'status', label: 'Estado del pago' },
    ],
    destinationFields: [
      { id: 'PaymentId', label: 'ID del pago' },
      { id: 'Method', label: 'Método de pago' },
      { id: 'Amount', label: 'Importe' },
      { id: 'Currency', label: 'Moneda' },
      { id: 'Status', label: 'Estado del pago' },
    ],
  },
  user: {
    sourceFields: [
      { id: 'user_id', label: 'ID del usuario' },
      { id: 'username', label: 'Nombre de usuario' },
      { id: 'email', label: 'Correo electrónico' },
      { id: 'created_at', label: 'Fecha de creación' },
      { id: 'status', label: 'Estado' },
    ],
    destinationFields: [
      { id: 'UserId', label: 'ID del usuario' },
      { id: 'Username', label: 'Nombre de usuario' },
      { id: 'Email', label: 'Correo electrónico' },
      { id: 'CreatedAt', label: 'Fecha de creación' },
      { id: 'Status', label: 'Estado' },
    ],
  },
  contact: {
    sourceFields: [
      { id: 'contact_id', label: 'ID del contacto' },
      { id: 'full_name', label: 'Nombre completo' },
      { id: 'email', label: 'Correo electrónico' },
      { id: 'phone', label: 'Teléfono' },
      { id: 'company', label: 'Empresa' },
    ],
    destinationFields: [
      { id: 'ContactId', label: 'ID del contacto' },
      { id: 'Name', label: 'Nombre completo' },
      { id: 'Email', label: 'Correo electrónico' },
      { id: 'Phone', label: 'Teléfono' },
      { id: 'Company', label: 'Empresa' },
    ],
  },
}

export const getEntityFieldSpec = (entityId) => ENTITY_FIELD_SPECS[entityId] || { sourceFields: [], destinationFields: [] }

/**
 * Connector-specific configuration
 * Defines form fields needed for each connector type
 */
export const CONNECTOR_CONFIG_SCHEMAS = {
  [CONNECTOR_TYPES.API]: {
    label: 'Configuración de API',
    fields: [
      {
        id: 'base_url',
        label: 'URL base',
        type: 'text',
        placeholder: 'https://api.example.com',
        required: true,
        description: 'URL base del servicio de API',
      },
      {
        id: 'endpoint',
        label: 'Ruta de la API',
        type: 'text',
        placeholder: '/v1/resources',
        required: true,
        description: 'Ruta y parámetros de consulta estáticos que se agregan a la URL base',
      },
      {
        id: 'auth_type',
        label: 'Tipo de autenticación',
        type: 'select',
        options: [
          { value: 'none', label: 'Ninguna' },
          { value: 'api_key', label: 'Clave de API' },
          { value: 'bearer', label: 'Token bearer' },
          { value: 'basic', label: 'Autenticación básica' },
          { value: 'oauth2', label: 'OAuth 2.0' },
        ],
        required: true,
      },
      {
        id: 'api_key_header',
        label: 'Encabezado de la clave de API',
        type: 'text',
        placeholder: 'X-API-Key',
        required: false,
        dependsOn: { field: 'auth_type', value: 'api_key' },
      },
      {
        id: 'api_key',
        label: 'Clave de API',
        type: 'password',
        required: false,
        dependsOn: { field: 'auth_type', value: 'api_key' },
      },
      {
        id: 'bearer_token',
        label: 'Token bearer',
        type: 'password',
        required: false,
        dependsOn: { field: 'auth_type', value: 'bearer' },
      },
      {
        id: 'basic_username',
        label: 'Nombre de usuario',
        type: 'text',
        required: false,
        dependsOn: { field: 'auth_type', value: 'basic' },
      },
      {
        id: 'basic_password',
        label: 'Contraseña',
        type: 'password',
        required: false,
        dependsOn: { field: 'auth_type', value: 'basic' },
      },
      {
        id: 'headers',
        label: 'Encabezados personalizados (JSON)',
        type: 'json',
        placeholder: '{"X-Custom-Header": "value"}',
        required: false,
        description: 'Encabezados HTTP personalizados opcionales',
        objectOnly: true,
      },
      {
        id: 'data_path',
        label: 'Ruta de datos',
        type: 'text',
        placeholder: 'data.items',
        required: false,
        nullable: true,
        description: 'Dejá el campo vacío si la API devuelve el arreglo directamente',
      },
      {
        id: 'pagination',
        label: 'Paginación (JSON)',
        type: 'json',
        placeholder: '{"type":"page_number","page_param":"page","page_size_param":"per_page","page_size":200}',
        required: false,
        description: 'Configuración opcional de paginación',
        objectOnly: true,
      },
    ],
  },

  [CONNECTOR_TYPES.DATABASE]: {
    label: 'Configuración de base de datos',
    fields: [
      {
        id: 'dbType',
        label: 'Tipo de base de datos',
        type: 'select',
        options: [
          { value: 'mysql', label: 'MySQL' },
          { value: 'postgresql', label: 'PostgreSQL' },
          { value: 'sqlserver', label: 'SQL Server' },
          { value: 'mongodb', label: 'MongoDB' },
        ],
        required: true,
      },
      {
        id: 'host',
        label: 'Servidor',
        type: 'text',
        placeholder: 'localhost o 192.168.1.1',
        required: true,
      },
      {
        id: 'port',
        label: 'Puerto',
        type: 'number',
        placeholder: '3306',
        required: true,
      },
      {
        id: 'database',
        label: 'Nombre de la base de datos',
        type: 'text',
        required: true,
      },
      {
        id: 'username',
        label: 'Nombre de usuario',
        type: 'text',
        required: true,
      },
      {
        id: 'password',
        label: 'Contraseña',
        type: 'password',
        required: true,
      },
      {
        id: 'ssl',
        label: 'Usar SSL/TLS',
        type: 'checkbox',
        required: false,
      },
    ],
  },

  [CONNECTOR_TYPES.FILE]: {
    label: 'Configuración de archivo',
    fields: [
      {
        id: 'fileType',
        label: 'Tipo de archivo',
        type: 'select',
        options: [
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON' },
          { value: 'xml', label: 'XML' },
          { value: 'excel', label: 'Excel' },
        ],
        required: true,
      },
      {
        id: 'filePath',
        label: 'Ubicación o ruta del archivo',
        type: 'text',
        placeholder: '/uploads/data.csv o s3://bucket/file.csv',
        required: true,
      },
      {
        id: 'delimiter',
        label: 'Delimitador (CSV)',
        type: 'text',
        placeholder: ',',
        required: false,
        dependsOn: { field: 'fileType', value: 'csv' },
      },
      {
        id: 'encoding',
        label: 'Codificación',
        type: 'select',
        options: [
          { value: 'utf-8', label: 'UTF-8' },
          { value: 'iso-8859-1', label: 'ISO-8859-1' },
          { value: 'ascii', label: 'ASCII' },
        ],
        required: false,
      },
    ],
  },

  [CONNECTOR_TYPES.WEBHOOK]: {
    label: 'Configuración del webhook',
    fields: [
      {
        id: 'secret',
        label: 'Secreto del webhook',
        type: 'password',
        placeholder: 'Secreto opcional para verificación',
        required: false,
      },
      {
        id: 'allowedIps',
        label: 'IP permitidas (separadas por comas)',
        type: 'textarea',
        placeholder: '192.168.1.1, 10.0.0.1',
        required: false,
        description: 'Dejá el campo vacío para permitir cualquier IP',
      },
      {
        id: 'description',
        label: 'Descripción',
        type: 'textarea',
        placeholder: 'Notas sobre este webhook',
        required: false,
      },
    ],
  },
}

/**
 * Get connector configuration schema by type
 */
export const getConnectorSchema = (connectorType) => {
  return CONNECTOR_CONFIG_SCHEMAS[connectorType] || null
}
