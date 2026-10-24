#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol, Vec,
};

// ─── Types ────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub enum BountyStatus {
    Open,
    InReview,
    Closed,
    Rewarded,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Submission {
    pub hunter: Address,
    pub report_hash: String,
    pub description: String,
    pub status: BountyStatus,
    pub submitted_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Bounty {
    pub id: String,
    pub creator: Address,
    pub contract_address: String,
    pub title: String,
    pub description: String,
    pub reward: i128,
    pub token: Address,
    pub status: BountyStatus,
    pub submissions: Vec<Submission>,
    pub created_at: u64,
    pub updated_at: u64,
}

// ─── Helpers ──────────────────────────────────────────────────────────

fn format_bounty_id(env: &Env, count: u32) -> String {
    let mut buf = [0u8; 20];
    let prefix = b"BTY-";
    buf[..4].copy_from_slice(prefix);
    let mut idx = 4;
    let mut n = count;
    let mut digits = [0u8; 10];
    let mut num_digits = 0;
    if n == 0 {
        digits[0] = b'0';
        num_digits = 1;
    } else {
        while n > 0 {
            digits[num_digits] = (n % 10) as u8 + b'0';
            n /= 10;
            num_digits += 1;
        }
    }
    for i in 0..num_digits {
        buf[idx] = digits[num_digits - 1 - i];
        idx += 1;
    }
    let s = core::str::from_utf8(&buf[..idx]).unwrap_or("BTY-0");
    String::from_str(env, s)
}

// ─── Contract ─────────────────────────────────────────────────────────

#[contract]
pub struct BugBounty;

#[contractimpl]
impl BugBounty {
    /// Create a new bug bounty and emit BountyCreated event
    pub fn create_bounty(
        env: Env,
        creator: Address,
        contract_address: String,
        title: String,
        description: String,
        reward: i128,
        token: Address,
    ) -> String {
        creator.require_auth();

        let bounty_count_key = symbol_short!("bty_count");
        let mut count: u32 = env
            .storage()
            .persistent()
            .get(&bounty_count_key)
            .unwrap_or(0);

        count += 1;

        let id = format_bounty_id(&env, count);
        let now = env.ledger().timestamp();

        let bounty = Bounty {
            id: id.clone(),
            creator: creator.clone(),
            contract_address,
            title,
            description,
            reward,
            token,
            status: BountyStatus::Open,
            submissions: Vec::new(&env),
            created_at: now,
            updated_at: now,
        };

        env.storage().persistent().set(&id, &bounty);
        env.storage().persistent().set(&bounty_count_key, &count);

        // Emit BountyCreated(id, creator, reward, timestamp)
        env.events().publish(
            (Symbol::new(&env, "BountyCreated"), id.clone()),
            (creator, reward, now),
        );

        id
    }

    /// Submit a bug report for a bounty and emit ReportSubmitted event
    pub fn submit_report(
        env: Env,
        bounty_id: String,
        hunter: Address,
        report_hash: String,
        description: String,
    ) {
        hunter.require_auth();

        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&bounty_id)
            .expect("Bounty not found");

        assert!(bounty.status == BountyStatus::Open, "Bounty is not open");

        let now = env.ledger().timestamp();
        let submission = Submission {
            hunter: hunter.clone(),
            report_hash,
            description,
            status: BountyStatus::InReview,
            submitted_at: now,
        };

        bounty.submissions.push_back(submission);
        bounty.updated_at = now;
        env.storage().persistent().set(&bounty_id, &bounty);

        // Emit ReportSubmitted(bounty_id, hunter, timestamp)
        env.events().publish(
            (Symbol::new(&env, "ReportSubmitted"), bounty_id),
            (hunter, now),
        );
    }

    /// Approve a report, reward the hunter, and emit ReportApproved event
    pub fn approve_report(env: Env, bounty_id: String, report_hash: String, hunter: Address) {
        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&bounty_id)
            .expect("Bounty not found");

        bounty.creator.require_auth();

        // Find and update the submission
        for i in 0..bounty.submissions.len() {
            if let Some(sub) = bounty.submissions.get(i) {
                if sub.hunter == hunter && sub.report_hash == report_hash {
                    let approved_sub = Submission {
                        status: BountyStatus::Rewarded,
                        ..sub
                    };
                    bounty.submissions.set(i, approved_sub);
                    break;
                }
            }
        }

        // Transfer reward tokens to hunter using token contract
        let token_client = token::Client::new(&env, &bounty.token);
        token_client.transfer(&bounty.creator, &hunter, &bounty.reward);

        let now = env.ledger().timestamp();
        bounty.status = BountyStatus::Rewarded;
        bounty.updated_at = now;
        env.storage().persistent().set(&bounty_id, &bounty);

        // Emit ReportApproved(bounty_id, hunter, reward, timestamp)
        env.events().publish(
            (Symbol::new(&env, "ReportApproved"), bounty_id),
            (hunter, bounty.reward, now),
        );
    }

    /// Close a bounty and emit BountyClosed event
    pub fn close_bounty(env: Env, bounty_id: String) {
        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&bounty_id)
            .expect("Bounty not found");

        bounty.creator.require_auth();
        let now = env.ledger().timestamp();
        bounty.status = BountyStatus::Closed;
        bounty.updated_at = now;
        env.storage().persistent().set(&bounty_id, &bounty);

        // Emit BountyClosed(id, timestamp)
        env.events()
            .publish((Symbol::new(&env, "BountyClosed"), bounty_id), now);
    }

    /// Get bounty details
    pub fn get_bounty(env: Env, bounty_id: String) -> Option<Bounty> {
        env.storage().persistent().get::<String, Bounty>(&bounty_id)
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::{Address, Env, String};

    fn install_mock_token(env: &Env, admin: &Address) -> Address {
        env.register_stellar_asset_contract_v2(admin.clone())
            .address()
    }

    fn setup_contract(env: &Env) -> (BugBountyClient<'_>, Address, Address, Address) {
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(env, &contract_id);
        let creator = Address::generate(env);
        let hunter = Address::generate(env);
        let token_addr = install_mock_token(env, &creator);
        (client, creator, hunter, token_addr)
    }

    #[test]
    fn test_create_bounty_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, _hunter, token_addr) = setup_contract(&env);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C...ABC"),
            &String::from_str(&env, "Find reentrancy bugs"),
            &String::from_str(&env, "Bug bounty for reentrancy vulnerabilities"),
            &100_000_000,
            &token_addr,
        );

        let events = env.events().all();
        assert_eq!(events.len(), 1);

        let bounty = client.get_bounty(&bounty_id);
        assert!(bounty.is_some());
        assert_eq!(bounty.unwrap().status, BountyStatus::Open);
    }

    #[test]
    fn test_bounty_events_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        let reward: i128 = 500_000;
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
        token_admin.mint(&creator, &reward);

        // 1. Create bounty -> emits BountyCreated
        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET"),
            &String::from_str(&env, "Audit"),
            &String::from_str(&env, "Desc"),
            &reward,
            &token_addr,
        );
        let create_events = env.events().all();
        assert_eq!(create_events.len(), 1);

        // 2. Submit report -> emits ReportSubmitted
        let report_hash = String::from_str(&env, "finding-001");
        client.submit_report(
            &bounty_id,
            &hunter,
            &report_hash,
            &String::from_str(&env, "Exploit"),
        );
        let submit_events = env.events().all();
        assert_eq!(submit_events.len(), 1);

        // 3. Approve report -> emits ReportApproved (plus token contract transfer events)
        client.approve_report(&bounty_id, &report_hash, &hunter);
        let approve_events = env.events().all();
        assert!(!approve_events.is_empty());

        // 4. Close bounty -> emits BountyClosed
        client.close_bounty(&bounty_id);
        let close_events = env.events().all();
        assert_eq!(close_events.len(), 1);
    }
}
