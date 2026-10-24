# @valorasec/sdk

Official TypeScript/JavaScript SDK client for the ValoraSec smart contract security analysis platform.

## Features

- **Exhaustive API Coverage**: Full TypeScript coverage for Authentication, Users & Profile, Notifications, Projects, Contracts, Scans, Reports, and on-chain Audit Registry.
- **Typed Error Hierarchy**: Categorized errors (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ServerError`) mapped directly to HTTP status codes with structured API error payloads.
- **Automatic Token Refresh**: Transparently handles 401 token expiration by exchanging refresh tokens and notifying listeners.
- **Full Type Definitions**: Comprehensive export of domain models, request contracts, and paginated responses.

---

## Installation

```bash
pnpm add @valorasec/sdk
# or
npm install @valorasec/sdk
```

---

## Quickstart

```typescript
import { ValoraSecClient, AuthError, NotFoundError } from '@valorasec/sdk';

const client = new ValoraSecClient({
  baseUrl: 'https://api.valorasec.com',
  accessToken: process.env.VALORASEC_ACCESS_TOKEN,
  refreshToken: process.env.VALORASEC_REFRESH_TOKEN,
});

// Update auth tokens when refreshed
client.setOnTokenRefresh((tokens) => {
  console.log('Tokens refreshed:', tokens.accessToken);
});

try {
  // Fetch current user
  const profile = await client.getProfile();
  console.log('Logged in as:', profile.data.name);

  // Update profile
  await client.updateProfile({
    name: 'Alice Cooper',
    avatarUrl: 'https://example.com/avatar.png',
  });

  // Query unread notifications
  const notifs = await client.getNotifications({ page: 1, limit: 10 });
  console.log('Notifications:', notifs.data);
} catch (err) {
  if (err instanceof AuthError) {
    console.error('Session expired, please re-authenticate');
  } else if (err instanceof NotFoundError) {
    console.error('Resource not found');
  } else {
    console.error('API call failed:', err);
  }
}
```

---

## Full Method Reference

### Authentication

| Method                        | Description                               | Path                      |
| :---------------------------- | :---------------------------------------- | :------------------------ |
| `register(data)`              | Register a new user account               | `POST /api/auth/register` |
| `login(data)`                 | Authenticate user with email and password | `POST /api/auth/login`    |
| `logout()`                    | End session and clear local tokens        | `POST /api/auth/logout`   |
| `refreshTokens(refreshToken)` | Manually exchange refresh token           | `POST /api/auth/refresh`  |

### Users & Profile

| Method                | Description                         | Path                       |
| :-------------------- | :---------------------------------- | :------------------------- |
| `getProfile()`        | Retrieve authenticated user profile | `GET /api/users/profile`   |
| `updateProfile(data)` | Update user name and avatar URL     | `PATCH /api/users/profile` |

### Notifications

| Method                       | Description                           | Path                                |
| :--------------------------- | :------------------------------------ | :---------------------------------- |
| `getNotifications(params?)`  | Get paginated notification list       | `GET /api/notifications`            |
| `markNotificationRead(id)`   | Mark a single notification as read    | `PATCH /api/notifications/:id/read` |
| `markAllNotificationsRead()` | Mark all unread notifications as read | `PATCH /api/notifications/read-all` |

### Projects

| Method                    | Description                               | Path                       |
| :------------------------ | :---------------------------------------- | :------------------------- |
| `getProjects(params?)`    | List projects with search/network filters | `GET /api/projects`        |
| `getProject(id)`          | Fetch single project by ID with contracts | `GET /api/projects/:id`    |
| `createProject(data)`     | Create a new project workspace            | `POST /api/projects`       |
| `updateProject(id, data)` | Update project name or description        | `PATCH /api/projects/:id`  |
| `deleteProject(id)`       | Delete project and associated scans       | `DELETE /api/projects/:id` |

### Contracts

| Method                            | Description                       | Path                                      |
| :-------------------------------- | :-------------------------------- | :---------------------------------------- |
| `getContracts(projectId)`         | List smart contracts in a project | `GET /api/projects/:projectId/contracts`  |
| `createContract(projectId, data)` | Register a contract to a project  | `POST /api/projects/:projectId/contracts` |

### Scans

| Method                                  | Description                           | Path                                                       |
| :-------------------------------------- | :------------------------------------ | :--------------------------------------------------------- |
| `runScan(projectId, contractId)`        | Trigger automated security scan       | `POST /api/projects/:projectId/contracts/:contractId/scan` |
| `getScanDetails(scanId)`                | Fetch scan findings and summary score | `GET /api/scans/:scanId`                                   |
| `getContractScans(contractId, params?)` | Paginated scan history for contract   | `GET /api/contracts/:contractId/scans`                     |
| `getScanHistory(contractId, params?)`   | Alias for `getContractScans`          | `GET /api/contracts/:contractId/scans`                     |

### Reports

| Method                      | Description                              | Path                                     |
| :-------------------------- | :--------------------------------------- | :--------------------------------------- |
| `getReports(params?)`       | List audit reports with filters          | `GET /api/reports`                       |
| `getReport(id)`             | Fetch full report details by ID          | `GET /api/reports/:id`                   |
| `generateReport(scanId)`    | Compile scan result into audit report    | `POST /api/reports/scans/:scanId/report` |
| `registerOnChain(reportId)` | Publish report proof to Soroban registry | `POST /api/reports/:reportId/register`   |

### Audit Registry

| Method                       | Description                                 | Path                                         |
| :--------------------------- | :------------------------------------------ | :------------------------------------------- |
| `getAuditRecords(projectId)` | List on-chain audit records for a project   | `GET /api/audit-registry/project/:projectId` |
| `getAuditRecord(reportId)`   | Fetch on-chain record for a specific report | `GET /api/audit-registry/report/:reportId`   |

---

## Error Handling

The SDK exports typed exceptions that inherit from `ValoraSecError`:

```typescript
import {
  ValoraSecError,
  ValidationError, // 400
  AuthError, // 401
  ForbiddenError, // 403
  NotFoundError, // 404
  ConflictError, // 409
  ServerError, // 5xx
} from '@valorasec/sdk';
```

Each error exposes:

- `statusCode`: HTTP status code
- `code`: Stable API error code string (e.g. `'auth_expired'`, `'validation_error'`)
- `body`: Raw parsed response JSON payload for debugging
- `cause`: Underlying transport error when available
