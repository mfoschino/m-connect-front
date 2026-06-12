/**
 * Connector Catalog Configuration
 * Maps business-friendly system names to technical connector types
 * This configuration bridges the gap between business UX and backend technical model
 * 
 * TODO: Replace with backend-driven catalog when available
 */

export const CONNECTOR_TYPES = {
  API: 'api',
  DATABASE: 'db',
  FILE: 'file',
  WEBHOOK: 'webhook',
}

export const SYSTEM_CATALOG = [
  // API Systems
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Connect to Salesforce CRM',
    connectorType: CONNECTOR_TYPES.API,
    icon: '☁️',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    description: 'Connect to Shopify store',
    connectorType: CONNECTOR_TYPES.API,
    icon: '🛍️',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payments',
    description: 'Connect to Stripe payment platform',
    connectorType: CONNECTOR_TYPES.API,
    icon: '💳',
  },
  {
    id: 'generic-rest-api',
    name: 'REST API',
    category: 'api',
    description: 'Connect to any REST API',
    connectorType: CONNECTOR_TYPES.API,
    icon: '🔌',
  },
  
  // Database Systems
  {
    id: 'mysql',
    name: 'MySQL',
    category: 'database',
    description: 'Connect to MySQL database',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description: 'Connect to PostgreSQL database',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    category: 'database',
    description: 'Connect to Microsoft SQL Server',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'database',
    description: 'Connect to MongoDB',
    connectorType: CONNECTOR_TYPES.DATABASE,
    icon: '🗄️',
  },
  
  // File Systems
  {
    id: 'csv-file',
    name: 'CSV File',
    category: 'file',
    description: 'Upload CSV files',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '📄',
  },
  {
    id: 'ftp',
    name: 'FTP',
    category: 'file',
    description: 'Connect via FTP/SFTP',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '📁',
  },
  {
    id: 's3',
    name: 'AWS S3',
    category: 'file',
    description: 'Connect to AWS S3 bucket',
    connectorType: CONNECTOR_TYPES.FILE,
    icon: '☁️',
  },
  
  // Webhooks
  {
    id: 'webhook-listener',
    name: 'Webhook Listener',
    category: 'event',
    description: 'Receive data via webhook',
    connectorType: CONNECTOR_TYPES.WEBHOOK,
    icon: '🔔',
  },
]

export const ENTITY_CATALOG = [
  // Common business entities
  { id: 'sales_order', name: 'Orders', description: 'Customer sales orders' },
  { id: 'customer', name: 'Customers', description: 'Customer records' },
  { id: 'product', name: 'Products', description: 'Product catalog' },
  { id: 'invoice', name: 'Invoices', description: 'Invoices and billing' },
  { id: 'inventory', name: 'Inventory', description: 'Stock and inventory' },
  { id: 'payment', name: 'Payments', description: 'Payment transactions' },
  { id: 'user', name: 'Users', description: 'User accounts' },
  { id: 'contact', name: 'Contacts', description: 'Contact information' },
]

export const DESTINATION_SYSTEMS = [
  {
    id: 'mconnect-canonical',
    name: 'M-Connect Canonical Format',
    description: 'Transform data into M-Connect canonical model',
    icon: '🎯',
  },
  {
    id: 'data-warehouse',
    name: 'Data Warehouse',
    description: 'Load into data warehouse',
    icon: '📊',
  },
]

export const ENTITY_FIELD_SPECS = {
  sales_order: {
    sourceFields: [
      { id: 'order_id', label: 'Order ID' },
      { id: 'customer_email', label: 'Customer Email' },
      { id: 'order_date', label: 'Order Date' },
      { id: 'total_amount', label: 'Total Amount' },
      { id: 'status', label: 'Order Status' },
    ],
    destinationFields: [
      { id: 'OrderId', label: 'Order ID' },
      { id: 'Email', label: 'Customer Email' },
      { id: 'Date', label: 'Order Date' },
      { id: 'TotalAmount', label: 'Total Amount' },
      { id: 'Status', label: 'Status' },
    ],
  },
  customer: {
    sourceFields: [
      { id: 'customer_id', label: 'Customer ID' },
      { id: 'first_name', label: 'First Name' },
      { id: 'last_name', label: 'Last Name' },
      { id: 'email', label: 'Email' },
      { id: 'phone', label: 'Phone' },
    ],
    destinationFields: [
      { id: 'CustomerId', label: 'Customer ID' },
      { id: 'FirstName', label: 'First Name' },
      { id: 'LastName', label: 'Last Name' },
      { id: 'Email', label: 'Email' },
      { id: 'Phone', label: 'Phone' },
    ],
  },
  product: {
    sourceFields: [
      { id: 'product_id', label: 'Product ID' },
      { id: 'product_name', label: 'Product Name' },
      { id: 'sku', label: 'SKU' },
      { id: 'price', label: 'Price' },
      { id: 'inventory_quantity', label: 'Inventory Quantity' },
    ],
    destinationFields: [
      { id: 'ProductId', label: 'Product ID' },
      { id: 'Name', label: 'Product Name' },
      { id: 'SKU', label: 'SKU' },
      { id: 'Price', label: 'Price' },
      { id: 'Stock', label: 'Inventory Quantity' },
    ],
  },
  invoice: {
    sourceFields: [
      { id: 'invoice_id', label: 'Invoice ID' },
      { id: 'invoice_date', label: 'Invoice Date' },
      { id: 'customer_name', label: 'Customer Name' },
      { id: 'amount_due', label: 'Amount Due' },
      { id: 'status', label: 'Invoice Status' },
    ],
    destinationFields: [
      { id: 'InvoiceId', label: 'Invoice ID' },
      { id: 'Date', label: 'Invoice Date' },
      { id: 'CustomerName', label: 'Customer Name' },
      { id: 'Amount', label: 'Amount Due' },
      { id: 'Status', label: 'Invoice Status' },
    ],
  },
  inventory: {
    sourceFields: [
      { id: 'item_id', label: 'Item ID' },
      { id: 'item_name', label: 'Item Name' },
      { id: 'stock_level', label: 'Stock Level' },
      { id: 'location', label: 'Location' },
      { id: 'reorder_point', label: 'Reorder Point' },
    ],
    destinationFields: [
      { id: 'ItemId', label: 'Item ID' },
      { id: 'Name', label: 'Item Name' },
      { id: 'Quantity', label: 'Stock Level' },
      { id: 'Location', label: 'Location' },
      { id: 'ReorderPoint', label: 'Reorder Point' },
    ],
  },
  payment: {
    sourceFields: [
      { id: 'payment_id', label: 'Payment ID' },
      { id: 'payment_method', label: 'Payment Method' },
      { id: 'amount', label: 'Amount' },
      { id: 'currency', label: 'Currency' },
      { id: 'status', label: 'Payment Status' },
    ],
    destinationFields: [
      { id: 'PaymentId', label: 'Payment ID' },
      { id: 'Method', label: 'Payment Method' },
      { id: 'Amount', label: 'Amount' },
      { id: 'Currency', label: 'Currency' },
      { id: 'Status', label: 'Payment Status' },
    ],
  },
  user: {
    sourceFields: [
      { id: 'user_id', label: 'User ID' },
      { id: 'username', label: 'Username' },
      { id: 'email', label: 'Email' },
      { id: 'created_at', label: 'Created At' },
      { id: 'status', label: 'Status' },
    ],
    destinationFields: [
      { id: 'UserId', label: 'User ID' },
      { id: 'Username', label: 'Username' },
      { id: 'Email', label: 'Email' },
      { id: 'CreatedAt', label: 'Created At' },
      { id: 'Status', label: 'Status' },
    ],
  },
  contact: {
    sourceFields: [
      { id: 'contact_id', label: 'Contact ID' },
      { id: 'full_name', label: 'Full Name' },
      { id: 'email', label: 'Email' },
      { id: 'phone', label: 'Phone' },
      { id: 'company', label: 'Company' },
    ],
    destinationFields: [
      { id: 'ContactId', label: 'Contact ID' },
      { id: 'Name', label: 'Full Name' },
      { id: 'Email', label: 'Email' },
      { id: 'Phone', label: 'Phone' },
      { id: 'Company', label: 'Company' },
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
    label: 'API Configuration',
    fields: [
      {
        id: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://api.example.com',
        required: true,
        description: 'The API endpoint base URL',
      },
      {
        id: 'authType',
        label: 'Authentication Type',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'api_key', label: 'API Key' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'basic', label: 'Basic Auth' },
          { value: 'oauth2', label: 'OAuth 2.0' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: false,
        dependsOn: { field: 'authType', value: 'api_key' },
      },
      {
        id: 'bearerToken',
        label: 'Bearer Token',
        type: 'password',
        required: false,
        dependsOn: { field: 'authType', value: 'bearer' },
      },
      {
        id: 'basicUsername',
        label: 'Username',
        type: 'text',
        required: false,
        dependsOn: { field: 'authType', value: 'basic' },
      },
      {
        id: 'basicPassword',
        label: 'Password',
        type: 'password',
        required: false,
        dependsOn: { field: 'authType', value: 'basic' },
      },
      {
        id: 'headers',
        label: 'Custom Headers (JSON)',
        type: 'textarea',
        placeholder: '{"X-Custom-Header": "value"}',
        required: false,
        description: 'Optional custom HTTP headers',
      },
    ],
  },

  [CONNECTOR_TYPES.DATABASE]: {
    label: 'Database Configuration',
    fields: [
      {
        id: 'dbType',
        label: 'Database Type',
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
        label: 'Host',
        type: 'text',
        placeholder: 'localhost or 192.168.1.1',
        required: true,
      },
      {
        id: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '3306',
        required: true,
      },
      {
        id: 'database',
        label: 'Database Name',
        type: 'text',
        required: true,
      },
      {
        id: 'username',
        label: 'Username',
        type: 'text',
        required: true,
      },
      {
        id: 'password',
        label: 'Password',
        type: 'password',
        required: true,
      },
      {
        id: 'ssl',
        label: 'Use SSL/TLS',
        type: 'checkbox',
        required: false,
      },
    ],
  },

  [CONNECTOR_TYPES.FILE]: {
    label: 'File Configuration',
    fields: [
      {
        id: 'fileType',
        label: 'File Type',
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
        label: 'File Location or Path',
        type: 'text',
        placeholder: '/uploads/data.csv or s3://bucket/file.csv',
        required: true,
      },
      {
        id: 'delimiter',
        label: 'Delimiter (CSV)',
        type: 'text',
        placeholder: ',',
        required: false,
        dependsOn: { field: 'fileType', value: 'csv' },
      },
      {
        id: 'encoding',
        label: 'Encoding',
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
    label: 'Webhook Configuration',
    fields: [
      {
        id: 'secret',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'Optional secret for verification',
        required: false,
      },
      {
        id: 'allowedIps',
        label: 'Allowed IPs (comma-separated)',
        type: 'textarea',
        placeholder: '192.168.1.1, 10.0.0.1',
        required: false,
        description: 'Leave empty to allow from any IP',
      },
      {
        id: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Notes about this webhook',
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

/**
 * Get system by ID
 */
export const getSystem = (systemId) => {
  return SYSTEM_CATALOG.find((s) => s.id === systemId)
}

/**
 * Get entity by ID
 */
export const getEntity = (entityId) => {
  return ENTITY_CATALOG.find((e) => e.id === entityId)
}
