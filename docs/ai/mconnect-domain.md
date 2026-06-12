# M-Connect Domain Knowledge

## Product Vision

M-Connect is a no-code integration platform designed for business users, analysts and operations teams.

The platform allows organizations to connect systems, transform data and automate information flows without writing code.

Users should never be required to:

* Write JSON payloads
* Understand API request structures
* Configure cron expressions manually
* Build integrations through code

The platform must translate business workflows into the technical API contracts required by the backend.

---

## Core Concepts

### Integration

An Integration defines how information moves between systems.

Examples:

* Shopify Orders → ERP
* Salesforce Customers → M-Connect Canonical Model
* CSV File → Database
* Webhook → CRM

An integration consists of:

* Source System
* Destination System
* Entity
* Connection Configuration
* Mapping Rules
* Transformation Rules
* Schedule

---

### Source System

The system where data originates.

Examples:

* Shopify
* Salesforce
* VTEX
* SAP
* SQL Server
* PostgreSQL
* CSV File
* Webhook

Users should select source systems through business-friendly cards and catalogs, not technical connector definitions.

---

### Destination System

The system that receives transformed information.

Examples:

* ERP
* CRM
* Data Warehouse
* M-Connect Canonical Model

---

### Connection Profile

A reusable connection configuration.

Examples:

* Salesforce Production
* VTEX Sandbox
* SQL Server Reporting Database

Connection profiles should be reusable across multiple integrations.

---

### Entity

A business object being synchronized.

Examples:

* Orders
* Customers
* Products
* Invoices
* Inventory

Users should work with business entities instead of technical identifiers.

---

### Mapping Profile

A Mapping Profile defines how source fields are transformed into destination fields.

Examples:

Customer Name → customer_name

Order Total → total_amount

Status → order_status

Mapping profiles should be reusable and editable through visual tools.

---

### Lookup Table

A Lookup Table translates values between systems.

Examples:

Pending → In Progress

USA → United States

VTEX Status → ERP Status

Lookup tables represent business rules and should be editable through user-friendly interfaces.

---

### Transformation Rules

Transformation rules modify values during processing.

Examples:

* Date formatting
* Text normalization
* Concatenation
* Conditional logic
* Lookup transformations

These rules should be configurable without code.

---

### Schedule

Schedules define when integrations execute.

Users should interact with schedules through natural language options:

* Manual
* Every hour
* Daily
* Weekly
* Monthly

Cron expressions should only appear in advanced mode.

---

### Execution

An Execution represents a processed integration event.

Executions contain:

* Trace ID
* Status
* Timestamps
* Logs
* Error information

Executions are primarily used for monitoring and troubleshooting.

---

### Trace ID

A unique identifier used to track a message throughout the pipeline.

---

## UX Principles

The platform must prioritize:

1. Business language over technical language
2. Guided workflows over raw configuration
3. Visual mapping over JSON editing
4. Friendly scheduling over cron expressions
5. Reusable assets over repeated configuration

Users should feel they are configuring business processes rather than software integrations.

---

## Preferred Integration Creation Flow

1. Select Source System
2. Select Destination System
3. Select Entity
4. Configure Connections
5. Map Fields
6. Configure Transformations
7. Configure Schedule
8. Review and Publish

This workflow should be the primary integration creation experience.
