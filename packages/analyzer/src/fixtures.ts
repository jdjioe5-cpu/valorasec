export interface RuleFixture {
  ruleId: string;
  ruleName: string;
  cwe?: string;
  swc?: string;
  vulnerable: {
    title: string;
    description: string;
    code: string;
  };
  safe: {
    title: string;
    description: string;
    code: string;
  };
  edgeCase: {
    title: string;
    description: string;
    code: string;
  };
}

export const SOROBAN_RULE_FIXTURES: Record<string, RuleFixture> = {
  R009: {
    ruleId: 'R009',
    ruleName: 'cross-contract-reentrancy',
    cwe: 'CWE-841',
    swc: 'SWC-107',
    vulnerable: {
      title: 'State mutation after external contract invocation',
      description:
        'The contract transfers reward tokens before updating the bounty status to Rewarded, permitting reentrancy through a malicious token or recipient hook.',
      code: `
pub fn approve_report(env: Env, bounty_id: String, hunter: Address) {
    let mut bounty: Bounty = env.storage().persistent().get(&bounty_id).unwrap();
    bounty.creator.require_auth();

    // VULNERABLE: External contract call occurs before internal state mutation
    let token_client = token::Client::new(&env, &bounty.token);
    token_client.transfer(&bounty.creator, &hunter, &bounty.reward);

    bounty.status = BountyStatus::Rewarded;
    env.storage().persistent().set(&bounty_id, &bounty);
}
      `.trim(),
    },
    safe: {
      title: 'Checks-Effects-Interactions pattern applied',
      description:
        'The contract strictly mutates and writes state to persistent storage prior to triggering the external token contract transfer.',
      code: `
pub fn approve_report(env: Env, bounty_id: String, hunter: Address) {
    let mut bounty: Bounty = env.storage().persistent().get(&bounty_id).unwrap();
    bounty.creator.require_auth();
    assert!(bounty.status == BountyStatus::Open, "Bounty is not open");

    // SAFE: Mutate and persist state first
    bounty.status = BountyStatus::Rewarded;
    bounty.updated_at = env.ledger().timestamp();
    env.storage().persistent().set(&bounty_id, &bounty);

    // External interaction performed as the final step
    let token_client = token::Client::new(&env, &bounty.token);
    token_client.transfer(&bounty.creator, &hunter, &bounty.reward);
}
      `.trim(),
    },
    edgeCase: {
      title: 'Read-only external query without state mutation',
      description:
        'Invoking a read-only query on an external contract (e.g. balance check) without subsequent state changes does not trigger reentrancy risk.',
      code: `
pub fn verify_hunter_eligibility(env: Env, token: Address, hunter: Address) -> bool {
    // SAFE EDGE CASE: Read-only query without storage side-effects
    let token_client = token::Client::new(&env, &token);
    token_client.balance(&hunter) >= 1_000_000
}
      `.trim(),
    },
  },

  R010: {
    ruleId: 'R010',
    ruleName: 'storage-collision-overlapping-keys',
    cwe: 'CWE-1258',
    swc: 'SWC-124',
    vulnerable: {
      title: 'Raw string concatenation for storage keys',
      description:
        'Using raw unnamespaced strings or ambiguous string concatenation can result in key collisions between different entity types.',
      code: `
pub fn save_record(env: Env, prefix: String, id: String, data: String) {
    // VULNERABLE: Ambiguous string concatenation can produce identical keys
    // e.g. prefix="user", id="1_admin" vs prefix="user_1", id="admin"
    let mut key = prefix;
    key.push_str(&id);
    env.storage().persistent().set(&key, &data);
}
      `.trim(),
    },
    safe: {
      title: 'Strongly typed enum DataKeys with distinct variants',
      description:
        'Using Soroban contracttype enums guarantees cryptographic namespace isolation for every key type.',
      code: `
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Bounty(String),
    ProjectAudits(String),
    UserProfile(Address),
}

pub fn save_user(env: Env, user: Address, profile: Profile) {
    // SAFE: Distinct enum variant isolates storage key namespace
    env.storage().persistent().set(&DataKey::UserProfile(user), &profile);
}
      `.trim(),
    },
    edgeCase: {
      title: 'Composite tuple keys with isolated instance address',
      description:
        'Combining an explicit Symbol domain tag with entity Address in a tuple key prevents cross-contract or cross-user collision.',
      code: `
pub fn record_vote(env: Env, proposal_id: u32, voter: Address, support: bool) {
    // SAFE EDGE CASE: Tuple key with domain symbol and composite typed components
    let key = (symbol_short!("vote"), proposal_id, voter);
    env.storage().persistent().set(&key, &support);
}
      `.trim(),
    },
  },

  R011: {
    ruleId: 'R011',
    ruleName: 'unbounded-host-iteration',
    cwe: 'CWE-400',
    swc: 'SWC-128',
    vulnerable: {
      title: 'Unbounded loop over on-chain persistent vector',
      description:
        'Iterating through an unconstrained vector on-chain can exceed CPU metering and gas limits as elements accumulate.',
      code: `
pub fn count_flagged_reports(env: Env, all_reports: Vec<Report>) -> u32 {
    let mut flagged = 0;
    // VULNERABLE: Unbounded loop over growing collection exhausts Soroban gas budget
    for i in 0..all_reports.len() {
        if all_reports.get(i).unwrap().flagged {
            flagged += 1;
        }
    }
    flagged
}
      `.trim(),
    },
    safe: {
      title: 'Cursor-based pagination with bounded batch size',
      description:
        'Enforcing maximum batch limits (e.g. max 50 items) ensures predictable gas consumption within budget.',
      code: `
pub const MAX_BATCH_SIZE: u32 = 50;

pub fn get_reports_page(env: Env, reports: Vec<Report>, offset: u32, limit: u32) -> Vec<Report> {
    let effective_limit = core::cmp::min(limit, MAX_BATCH_SIZE);
    let mut page = Vec::new(&env);
    let total = reports.len();

    let end = core::cmp::min(offset + effective_limit, total);
    for i in offset..end {
        if let Some(r) = reports.get(i) {
            page.push_back(r);
        }
    }
    page
}
      `.trim(),
    },
    edgeCase: {
      title: 'Fixed-size array iteration with compile-time known bound',
      description:
        'Iterating over fixed-size stack arrays (e.g. [u8; 32] hash bytes) has a constant cost and is safe from gas exhaustion.',
      code: `
pub fn xor_hash_bytes(a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
    let mut res = [0u8; 32];
    // SAFE EDGE CASE: Fixed 32-element loop with constant, deterministic gas usage
    for i in 0..32 {
        res[i] = a[i] ^ b[i];
    }
    res
}
      `.trim(),
    },
  },

  R012: {
    ruleId: 'R012',
    ruleName: 'sep41-token-interface-compliance',
    cwe: 'CWE-573',
    vulnerable: {
      title: 'Non-compliant token transfer signature missing caller auth',
      description:
        'Custom transfer method uses u64 instead of standard i128 amount and omits standard SEP-41 Interface error semantics.',
      code: `
#[contractimpl]
impl NonStandardToken {
    // VULNERABLE: Amount should be i128 per SEP-41, and require_auth must be checked
    pub fn transfer(env: Env, from: Address, to: Address, amount: u64) {
        // Missing from.require_auth()
        let mut balance = Self::get_balance(&env, &from);
        balance -= amount;
        // ...
    }
}
      `.trim(),
    },
    safe: {
      title: 'Standard SEP-41 Interface implementation',
      description:
        'Implementing standard Interface with i128 amounts and strict authentication per Stellar SEP-41.',
      code: `
use soroban_sdk::token::Interface;

#[contractimpl]
impl Interface for Sep41Token {
    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount >= 0, "amount cannot be negative");
        let from_balance = Self::balance(env.clone(), from.clone());
        assert!(from_balance >= amount, "insufficient balance");

        Self::set_balance(&env, &from, from_balance - amount);
        Self::set_balance(&env, &to, Self::balance(env.clone(), to.clone()) + amount);
    }
    // Standard allowance, approve, balance, burn...
}
      `.trim(),
    },
    edgeCase: {
      title: 'Sep41 token extension with authorized minting',
      description:
        'Administrative minting function properly delegates to internal accounting and enforces admin authorization.',
      code: `
pub fn admin_mint(env: Env, admin: Address, recipient: Address, amount: i128) {
    admin.require_auth();
    assert!(amount > 0, "mint amount must be positive");
    let current = Self::balance(env.clone(), recipient.clone());
    Self::set_balance(&env, &recipient, current + amount);
}
      `.trim(),
    },
  },

  R013: {
    ruleId: 'R013',
    ruleName: 'missing-overflow-protection',
    cwe: 'CWE-190',
    swc: 'SWC-101',
    vulnerable: {
      title: 'Unchecked raw integer arithmetic in user balance updates',
      description:
        'Direct addition and subtraction on primitive integers can overflow in debug mode or wrap unpredictably.',
      code: `
pub fn add_reward(mut user_score: u32, bonus: u32) -> u32 {
    // VULNERABLE: Direct addition may overflow u32::MAX
    user_score + bonus
}

pub fn deduct_penalty(mut user_score: u32, penalty: u32) -> u32 {
    // VULNERABLE: Direct subtraction underflows when penalty > user_score
    user_score - penalty
}
      `.trim(),
    },
    safe: {
      title: 'Checked and saturating arithmetic operations',
      description:
        'Using checked_add and saturating_sub ensures robust arithmetic bounds checking without panicking.',
      code: `
pub fn add_reward_safe(user_score: u32, bonus: u32) -> Result<u32, Error> {
    // SAFE: Explicit checked arithmetic
    user_score.checked_add(bonus).ok_or(Error::Overflow)
}

pub fn deduct_penalty_safe(user_score: u32, penalty: u32) -> u32 {
    // SAFE: Saturating subtraction prevents underflow below zero
    user_score.saturating_sub(penalty)
}
      `.trim(),
    },
    edgeCase: {
      title: 'Safe small constant increment bounded by invariant',
      description:
        'Counter increment with guarded precondition or checked increment up to u32::MAX.',
      code: `
pub fn increment_counter(current: u32) -> u32 {
    // SAFE EDGE CASE: Precondition assertion preventing integer overflow
    assert!(current < u32::MAX, "counter reached maximum limit");
    current + 1
}
      `.trim(),
    },
  },
};
