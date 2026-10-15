# M-Connect Frontend Guide

## Overview

The frontend is responsible for translating a business-oriented no-code experience into the technical API contracts exposed by the backend.

The backend API may expose technical structures, but these structures should generally remain hidden from end users.

---

## API Contract

Official specification:

./docu_api_mconnect.json

All API communication must remain compatible with this contract.

The frontend may transform user-friendly forms into API payloads before submission.

---

## Frontend Responsibilities

The frontend should:

* Abstract technical backend structures
* Provide guided workflows
* Offer business-oriented terminology
* Hide implementation details whenever possible

The frontend should not require users to:

* Write JSON
* Understand API payloads
* Configure cron expressions
* Know connector implementation details

---

## Authentication

Endpoints:

POST /auth/login
POST /auth/refresh
POST /auth/register

Tokens:

* access_token
* refresh_token

Requirements:

* Persist tokens securely
* Refresh automatically
* Redirect to login when refresh fails

---

## Technology Stack

* React
* TypeScript
* Tailwind
* React Query
* Axios

Reusable components should be preferred over page-specific implementations.

---

## UX Principles

### Business First

Interfaces should describe business processes rather than technical implementation.

Prefer:

* Orders
* Customers
* Products
* Inventory

Instead of:

* sales_order
* customer_entity
* inventory_sync_job

---

### Connector Abstraction

Users should select systems through business-friendly representations.

Examples:

* Salesforce
* Shopify
* SQL Server
* CSV File
* Webhook

The frontend may internally translate these selections into:

* connector_type
* config
* source_entity

required by the API.

---

### Scheduling

Users should interact with scheduling through natural language.

Preferred options:

* Manual
* Hourly
* Daily
* Weekly
* Monthly

Cron expressions should be hidden behind an Advanced Mode.

---

### Mapping

Field mapping should be visual whenever possible.

Preferred experiences:

* Side-by-side mapping
* Auto-suggestions
* Required field indicators
* Lookup table integration

Avoid raw JSON mapping editors.

---

### Review Screens

Review pages should display business summaries.

Preferred:

* Source System
* Destination System
* Entity
* Schedule
* Mapping Profile

Avoid exposing raw configuration JSON as the primary summary.

---

## Integration Builder

The preferred integration workflow is:

1. Source System
2. Destination System
3. Entity
4. Connection Configuration
5. Mapping
6. Transformations
7. Schedule
8. Review and Publish

The frontend should gradually evolve toward this builder experience while maintaining compatibility with the existing API.

---

## API Compatibility Rule

The backend contract is the source of truth.

The frontend may redesign user experiences freely as long as the generated requests remain compatible with:

* POST /integrations
* PATCH /integrations
* POST /profiles
* PATCH /profiles
* POST /lookup-tables
* PATCH /lookup-tables

and all other documented endpoints.
