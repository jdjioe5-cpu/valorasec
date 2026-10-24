# ValoraSec Contracts Deployment & Upgrade Guide

This guide details the procedures for initial deployment, admin assignment, and hot-upgrading Soroban smart contracts (`audit-registry`, `bug-bounty`, and `reputation`) on Stellar Testnet and Mainnet.

---

## 1. Initial Deployment & Admin Initialization

Each contract features an `init` method to permanently register the contract admin address in persistent state.

### Step 1: Install Contract WASM

Install the compiled contract WASM code on the Stellar network:

```bash
# Upload WASM code
WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/audit_registry.wasm \
  --source <DEPLOYER_KEY> \
  --network testnet)

echo "Installed WASM Hash: $WASM_HASH"
```

### Step 2: Deploy Contract Instance

Create an instance with a derived address:

```bash
CONTRACT_ID=$(soroban contract deploy \
  --wasm-hash $WASM_HASH \
  --source <DEPLOYER_KEY> \
  --network testnet)

echo "Deployed Contract ID: $CONTRACT_ID"
```

### Step 3: Initialize Admin

Assign the contract admin address:

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source <ADMIN_KEY> \
  --network testnet \
  -- \
  init \
  --admin <ADMIN_ADDRESS>
```

---

## 2. Contract Upgrade Mechanism

All three contracts implement the native Soroban `update_current_contract_wasm` hot-upgrade pattern. When upgraded:

- Contract ID and address remain identical.
- All persistent storage (audits, bounties, profiles, scores) remains intact and accessible.
- Only the authorized Admin can execute the upgrade.
- A `ContractUpgraded` event is emitted.

### Step 1: Build & Upload New WASM

Compile the updated contract code and install the new WASM on-chain:

```bash
# Build optimized release WASM
cargo build --target wasm32-unknown-unknown --release

# Install new WASM to obtain its hash
NEW_WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/audit_registry.wasm \
  --source <ADMIN_KEY> \
  --network testnet)

echo "New WASM Hash: $NEW_WASM_HASH"
```

### Step 2: Execute Upgrade

Invoke the `upgrade` function as Admin:

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source <ADMIN_KEY> \
  --network testnet \
  -- \
  upgrade \
  --new_wasm_hash $NEW_WASM_HASH
```

### Step 3: Verify Upgrade & Event Emission

Verify that the `ContractUpgraded` event was published with topics `["ContractUpgraded"]` and data `(new_wasm_hash, timestamp)`:

```typescript
import { Server } from '@stellar/stellar-sdk/rpc';

const server = new Server('https://soroban-testnet.stellar.org');

const events = await server.getEvents({
  startLedger: latestLedger - 10,
  filters: [
    {
      type: 'contract',
      contractIds: [CONTRACT_ID],
      topics: [['ContractUpgraded']],
    },
  ],
});

console.log('Contract Upgrade Event:', events.events[0]);
```
