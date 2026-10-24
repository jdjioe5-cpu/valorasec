# @valorasec/analyzer

Security analysis engine for Soroban smart contracts on the Stellar network.

## Rules Overview

The analyzer features 13 comprehensive rules spanning core smart contract hygiene and Soroban-specific runtime security concerns.

### Soroban-Specific Detection Rules (R009 - R013)

| Rule ID    | Name                                 | Category           | Severity     | Standard Mappings | Description                                                                            |
| :--------- | :----------------------------------- | :----------------- | :----------- | :---------------- | :------------------------------------------------------------------------------------- |
| **`R009`** | `cross-contract-reentrancy`          | `authorization`    | **Critical** | SWC-107, CWE-841  | Detects state mutations occurring after external contract invocations.                 |
| **`R010`** | `storage-collision-overlapping-keys` | `storage`          | **High**     | SWC-124, CWE-1258 | Detects ambiguous string keys and un-namespaced storage operations.                    |
| **`R011`** | `unbounded-host-iteration`           | `gas-optimization` | **High**     | SWC-128, CWE-400  | Flags unconstrained loops over on-chain vectors or dynamic storage entries.            |
| **`R012`** | `sep41-token-interface-compliance`   | `input-validation` | **High**     | CWE-573, SEP-41   | Enforces standard Stellar SEP-41 Token Interface signatures and caller authorization.  |
| **`R013`** | `missing-overflow-protection`        | `panic-safety`     | **High**     | SWC-101, CWE-190  | Flags primitive integer addition/subtraction without checked or saturating arithmetic. |

---

## Detailed Rule Specifications & Examples

### R009: Cross-Contract Call Reentrancy

- **Problem**: In Soroban, calling external contracts before updating local persistent storage allows malicious recipients or custom tokens to re-enter the calling contract while internal state remains stale.
- **Pattern**: Follow the **Checks-Effects-Interactions** pattern.

```rust
// ❌ VULNERABLE
let token_client = token::Client::new(&env, &bounty.token);
token_client.transfer(&bounty.creator, &hunter, &bounty.reward);
bounty.status = BountyStatus::Rewarded;
env.storage().persistent().set(&bounty_id, &bounty);

// ✅ SAFE
bounty.status = BountyStatus::Rewarded;
env.storage().persistent().set(&bounty_id, &bounty);
let token_client = token::Client::new(&env, &bounty.token);
token_client.transfer(&bounty.creator, &hunter, &bounty.reward);
```

---

### R010: Storage Collision (Overlapping Keys)

- **Problem**: Raw string concatenation or ad-hoc prefixes can produce colliding storage keys across different entity domains (e.g., `user` + `1_admin` vs `user_1` + `admin`).
- **Fix**: Use typed enum `DataKey` variants with explicit discriminants.

```rust
// ❌ VULNERABLE
let mut key = String::from_str(&env, "user:");
key.push_str(&id);
env.storage().persistent().set(&key, &user_data);

// ✅ SAFE
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Bounty(String),
    UserProfile(Address),
}

env.storage().persistent().set(&DataKey::UserProfile(user_address), &user_data);
```

---

### R011: Unbounded Host Iteration

- **Problem**: Iterating over dynamic, growing storage collections on-chain quickly exhausts Soroban host CPU and memory metering allocations.
- **Fix**: Enforce pagination with fixed batch boundaries (`MAX_BATCH_SIZE = 50`).

```rust
// ❌ VULNERABLE
for i in 0..reports.len() {
    process_report(reports.get(i).unwrap());
}

// ✅ SAFE
pub const MAX_BATCH_SIZE: u32 = 50;
let end = core::cmp::min(offset + core::cmp::min(limit, MAX_BATCH_SIZE), reports.len());
for i in offset..end {
    process_report(reports.get(i).unwrap());
}
```

---

### R012: SEP-41 Token Interface Compliance

- **Problem**: Non-standard token implementations cause broken integrations with AMMs, lending protocols, and escrow contracts in the Stellar ecosystem.
- **Fix**: Implement the official `soroban_sdk::token::Interface` trait strictly.

```rust
// ❌ VULNERABLE
pub fn transfer(env: Env, from: Address, to: Address, amount: u64) {
    // Missing from.require_auth() and non-standard u64 amount
}

// ✅ SAFE
use soroban_sdk::token::Interface;

impl Interface for CustomToken {
    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        // Checked balance transfer logic
    }
}
```

---

### R013: Missing Overflow Protection

- **Problem**: Raw primitive integer arithmetic wraps in release mode or triggers unexpected panics under extreme values.
- **Fix**: Use `checked_add`, `saturating_sub`, and `checked_mul`.

```rust
// ❌ VULNERABLE
score = score - penalty; // Underflows if penalty > score

// ✅ SAFE
score = score.saturating_sub(penalty);
total_reward = balance.checked_add(reward).ok_or(Error::Overflow)?;
```
