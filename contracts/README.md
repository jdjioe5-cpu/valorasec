# ValoraSec Smart Contracts

Soroban smart contracts powering the ValoraSec decentralized security platform on Stellar.

## Contracts Overview

- **`audit-registry`**: On-chain security audit report registration and verification.
- **`bug-bounty`**: Decentralized bug bounty creation, report submission, review, and reward distribution.
- **`reputation`**: Community contributor profiles, reputation score tracking, and achievement badges.

---

## Contract Events Specification

All state-changing operations across the contracts emit structured events following a consistent PascalCase topic naming convention, entity-scoped second topics for filtering, and UTC timestamps.

### 1. `audit-registry` Events

| Event Name            | Topics                                  | Data Payload                                             | Description                                                      |
| :-------------------- | :-------------------------------------- | :------------------------------------------------------- | :--------------------------------------------------------------- |
| **`AuditRegistered`** | `["AuditRegistered", audit_id: String]` | `(project_id: String, auditor: Address, timestamp: u64)` | Emitted when a new security audit report is registered on-chain. |
| **`AuditVerified`**   | `["AuditVerified", audit_id: String]`   | `(verified: bool, timestamp: u64)`                       | Emitted upon verifying an audit record against a report hash.    |

### 2. `bug-bounty` Events

| Event Name            | Topics                                   | Data Payload                                       | Description                                                              |
| :-------------------- | :--------------------------------------- | :------------------------------------------------- | :----------------------------------------------------------------------- |
| **`BountyCreated`**   | `["BountyCreated", id: String]`          | `(creator: Address, reward: i128, timestamp: u64)` | Emitted when a new bug bounty is published.                              |
| **`ReportSubmitted`** | `["ReportSubmitted", bounty_id: String]` | `(hunter: Address, timestamp: u64)`                | Emitted when a vulnerability report is submitted by a researcher.        |
| **`ReportApproved`**  | `["ReportApproved", bounty_id: String]`  | `(hunter: Address, reward: i128, timestamp: u64)`  | Emitted when a vulnerability report is approved and payout is disbursed. |
| **`BountyClosed`**    | `["BountyClosed", id: String]`           | `timestamp: u64`                                   | Emitted when a bounty is closed by its creator.                          |

### 3. `reputation` Events

| Event Name           | Topics                                 | Data Payload                                                    | Description                                                         |
| :------------------- | :------------------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------ |
| **`ProfileCreated`** | `["ProfileCreated", address: Address]` | `(name: String, timestamp: u64)`                                | Emitted when a user creates their researcher profile.               |
| **`PointsAdded`**    | `["PointsAdded", address: Address]`    | `(points: u32, reason: String, new_score: u32, timestamp: u64)` | Emitted when positive contribution points are awarded.              |
| **`PointsRemoved`**  | `["PointsRemoved", address: Address]`  | `(points: u32, reason: String, new_score: u32, timestamp: u64)` | Emitted when contribution points are deducted (saturating at zero). |
| **`BadgeEarned`**    | `["BadgeEarned", address: Address]`    | `(badge: Badge, timestamp: u64)`                                | Emitted when an achievement badge is conferred.                     |

---

## Frontend Integration & Event Streaming

Frontend client applications can stream and query contract events using the Soroban RPC API (`getEvents`) or Stellar Horizon event listeners.

### Soroban RPC `getEvents` Example

```typescript
import { Server } from '@stellar/stellar-sdk/rpc';

const server = new Server('https://soroban-testnet.stellar.org');

async function listenToAuditEvents(auditRegistryContractId: string, startLedger: number) {
  const response = await server.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [auditRegistryContractId],
        topics: [
          // Match all events with first topic "AuditRegistered"
          ['AuditRegistered', '*'],
        ],
      },
    ],
  });

  for (const event of response.events) {
    console.log('Contract Event Received:', {
      id: event.id,
      ledger: event.ledger,
      topics: event.topic,
      value: event.value,
    });
  }
}
```
