# ValoraSec API Documentation

## Base URL

```
http://localhost:4000/api
```

## Authentication

All authenticated endpoints require a `Bearer` token in the `Authorization` header.

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## Role-Based Access Control (RBAC)

ValoraSec provides role-based access control with three primary roles:

- `user`: Standard platform user with access scoped to owned projects and reports.
- `auditor`: Certified security auditor with read/review access to assigned projects and reports.
- `admin`: Platform administrator with full access to user management, global report review, auditor assignments, and audit logs.

Endpoints requiring elevated permissions are protected via `@Roles(...)` and `RolesGuard`. Unauthorized requests return `403 Forbidden`.

## Admin Endpoints

All admin endpoints require an `Authorization: Bearer <token>` where the caller holds the `admin` role (or `auditor` where noted).

### List Users

```http
GET /api/admin/users?page=1&limit=20&role=auditor&search=john
Authorization: Bearer <admin-token>
```

### List All Platform Reports

```http
GET /api/admin/reports?page=1&limit=20
Authorization: Bearer <admin-or-auditor-token>
```

### Update User Role

```http
PATCH /api/admin/users/:userId/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "role": "auditor"
}
```

### Assign Auditor to Project

```http
POST /api/admin/projects/:projectId/assign-auditor
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "auditorId": "auditor-user-id"
}
```

## Projects

### List Projects

```http
GET /api/projects?page=1&limit=10&search=my&network=testnet
Authorization: Bearer <token>
```

### Create Project

```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My DeFi Protocol",
  "description": "A decentralized exchange on Stellar",
  "network": "testnet"
}
```

### Get Project

```http
GET /api/projects/:id
Authorization: Bearer <token>
```

## Contracts

### Add Contract

```http
POST /api/projects/:projectId/contracts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "LiquidityPool",
  "address": "CABC123...",
  "network": "testnet"
}
```

## Scans

### Run Scan

```http
POST /api/projects/:projectId/contracts/:contractId/scan
Authorization: Bearer <token>
```

### Get Scan

```http
GET /api/scans/:scanId
Authorization: Bearer <token>
```

## Reports

### Generate Report

```http
POST /api/scans/:scanId/report
Authorization: Bearer <token>
```

### Register On-Chain

```http
POST /api/reports/:id/register
Authorization: Bearer <token>
```

## Swagger

Full interactive API documentation is available at:

```
http://localhost:4000/api/docs
```
