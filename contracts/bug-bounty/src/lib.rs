#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec,
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
    /// Create a new bug bounty
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
            creator,
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

        id
    }

    /// Submit a bug report for a bounty
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

        let submission = Submission {
            hunter,
            report_hash,
            description,
            status: BountyStatus::InReview,
            submitted_at: env.ledger().timestamp(),
        };

        bounty.submissions.push_back(submission);
        bounty.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&bounty_id, &bounty);
    }

    /// Approve a report and reward the hunter
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

        bounty.status = BountyStatus::Rewarded;
        bounty.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&bounty_id, &bounty);
    }

    /// Close a bounty
    pub fn close_bounty(env: Env, bounty_id: String) {
        let mut bounty: Bounty = env
            .storage()
            .persistent()
            .get(&bounty_id)
            .expect("Bounty not found");

        bounty.creator.require_auth();
        bounty.status = BountyStatus::Closed;
        bounty.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&bounty_id, &bounty);
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
    use soroban_sdk::testutils::Address as _;
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
    fn test_create_bounty() {
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

        let bounty = client.get_bounty(&bounty_id);
        assert!(bounty.is_some());
        let b = bounty.unwrap();
        assert_eq!(b.status, BountyStatus::Open);
        assert_eq!(b.id, bounty_id);
        assert_eq!(b.reward, 100_000_000);
        assert_eq!(b.submissions.len(), 0);
    }

    #[test]
    fn test_bounty_full_happy_path() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        let reward: i128 = 500_000;
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
        token_admin.mint(&creator, &reward);

        // 1. Create bounty
        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET_CONTRACT"),
            &String::from_str(&env, "Critical Audit"),
            &String::from_str(&env, "Report zero-day flaws"),
            &reward,
            &token_addr,
        );

        // 2. Submit report
        let report_hash = String::from_str(&env, "hash-deadbeef-001");
        let desc = String::from_str(&env, "Found integer overflow in settlement");
        client.submit_report(&bounty_id, &hunter, &report_hash, &desc);

        let bounty_after_submit = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(bounty_after_submit.status, BountyStatus::Open);
        assert_eq!(bounty_after_submit.submissions.len(), 1);
        let sub = bounty_after_submit.submissions.get(0).unwrap();
        assert_eq!(sub.hunter, hunter);
        assert_eq!(sub.report_hash, report_hash);
        assert_eq!(sub.status, BountyStatus::InReview);

        // 3. Approve and reward
        client.approve_report(&bounty_id, &report_hash, &hunter);

        // 4. Verify post-reward state
        let bounty_after_reward = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(bounty_after_reward.status, BountyStatus::Rewarded);
        let approved_sub = bounty_after_reward.submissions.get(0).unwrap();
        assert_eq!(approved_sub.status, BountyStatus::Rewarded);

        // 5. Verify token balances
        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
        assert_eq!(token_client.balance(&hunter), reward);
        assert_eq!(token_client.balance(&creator), 0);
    }

    #[test]
    #[should_panic(expected = "Bounty is not open")]
    fn test_submit_to_closed_bounty_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET"),
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
            &100_000,
            &token_addr,
        );

        // Creator closes bounty
        client.close_bounty(&bounty_id);

        let bounty = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(bounty.status, BountyStatus::Closed);

        // Hunter attempts to submit to closed bounty -> must panic
        client.submit_report(
            &bounty_id,
            &hunter,
            &String::from_str(&env, "hash-late"),
            &String::from_str(&env, "Late report"),
        );
    }

    #[test]
    #[should_panic]
    fn test_approve_from_non_creator_fails() {
        let env = Env::default();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        env.mock_all_auths();
        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET"),
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
            &100_000,
            &token_addr,
        );
        let report_hash = String::from_str(&env, "hash-001");
        client.submit_report(
            &bounty_id,
            &hunter,
            &report_hash,
            &String::from_str(&env, "Finding"),
        );

        // Mock auth ONLY for non-creator attacker, not the creator
        let attacker = Address::generate(&env);
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &attacker,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "approve_report",
                args: soroban_sdk::vec![
                    &env,
                    bounty_id.to_val(),
                    report_hash.to_val(),
                    hunter.to_val(),
                ],
                sub_invokes: &[],
            },
        }]);

        // Attacker attempts to approve -> creator.require_auth() will fail
        client.approve_report(&bounty_id, &report_hash, &hunter);
    }

    #[test]
    fn test_close_after_rewarding_works() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        let reward: i128 = 250_000;
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
        token_admin.mint(&creator, &reward);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET"),
            &String::from_str(&env, "Audit Bounty"),
            &String::from_str(&env, "Description"),
            &reward,
            &token_addr,
        );

        let report_hash = String::from_str(&env, "hash-007");
        client.submit_report(
            &bounty_id,
            &hunter,
            &report_hash,
            &String::from_str(&env, "Exploit found"),
        );

        client.approve_report(&bounty_id, &report_hash, &hunter);

        let rewarded_bounty = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(rewarded_bounty.status, BountyStatus::Rewarded);

        // Close after rewarding
        client.close_bounty(&bounty_id);

        let closed_bounty = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(closed_bounty.status, BountyStatus::Closed);
        assert_eq!(closed_bounty.submissions.len(), 1);
        assert_eq!(
            closed_bounty.submissions.get(0).unwrap().status,
            BountyStatus::Rewarded
        );
    }

    #[test]
    fn test_multiple_submissions_same_bounty() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter1, token_addr) = setup_contract(&env);
        let hunter2 = Address::generate(&env);
        let hunter3 = Address::generate(&env);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_MULTI"),
            &String::from_str(&env, "Competition Bounty"),
            &String::from_str(&env, "Open for multiple researchers"),
            &1_000_000,
            &token_addr,
        );

        client.submit_report(
            &bounty_id,
            &hunter1,
            &String::from_str(&env, "hash-1"),
            &String::from_str(&env, "Reentrancy vulnerability"),
        );
        client.submit_report(
            &bounty_id,
            &hunter2,
            &String::from_str(&env, "hash-2"),
            &String::from_str(&env, "Oracle manipulation risk"),
        );
        client.submit_report(
            &bounty_id,
            &hunter3,
            &String::from_str(&env, "hash-3"),
            &String::from_str(&env, "Access control bypass"),
        );

        let bounty = client.get_bounty(&bounty_id).unwrap();
        assert_eq!(bounty.submissions.len(), 3);
        assert_eq!(bounty.submissions.get(0).unwrap().hunter, hunter1);
        assert_eq!(bounty.submissions.get(1).unwrap().hunter, hunter2);
        assert_eq!(bounty.submissions.get(2).unwrap().hunter, hunter3);
    }

    #[test]
    fn test_token_transfer_verification() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, hunter, token_addr) = setup_contract(&env);

        let initial_creator_funds: i128 = 800_000;
        let bounty_reward: i128 = 350_000;

        let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
        token_admin.mint(&creator, &initial_creator_funds);

        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
        assert_eq!(token_client.balance(&creator), initial_creator_funds);
        assert_eq!(token_client.balance(&hunter), 0);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_ESCROW_TARGET"),
            &String::from_str(&env, "Payment Flow Test"),
            &String::from_str(&env, "Detailed flow validation"),
            &bounty_reward,
            &token_addr,
        );

        let report_hash = String::from_str(&env, "hash-proof-101");
        client.submit_report(
            &bounty_id,
            &hunter,
            &report_hash,
            &String::from_str(&env, "Proof of concept attached"),
        );

        client.approve_report(&bounty_id, &report_hash, &hunter);

        // Exact balance checks
        assert_eq!(
            token_client.balance(&creator),
            initial_creator_funds - bounty_reward,
            "Creator balance should be reduced exactly by reward amount"
        );
        assert_eq!(
            token_client.balance(&hunter),
            bounty_reward,
            "Hunter should receive exact bounty reward"
        );
    }

    #[test]
    fn test_sequential_bounty_ids() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, creator, _hunter, token_addr) = setup_contract(&env);

        let b1 = client.create_bounty(
            &creator,
            &String::from_str(&env, "C1"),
            &String::from_str(&env, "T1"),
            &String::from_str(&env, "D1"),
            &100,
            &token_addr,
        );
        let b2 = client.create_bounty(
            &creator,
            &String::from_str(&env, "C2"),
            &String::from_str(&env, "T2"),
            &String::from_str(&env, "D2"),
            &200,
            &token_addr,
        );

        assert_eq!(b1, String::from_str(&env, "BTY-1"));
        assert_eq!(b2, String::from_str(&env, "BTY-2"));
    }

    #[test]
    fn test_get_nonexistent_bounty_returns_none() {
        let env = Env::default();
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(&env, &contract_id);

        let result = client.get_bounty(&String::from_str(&env, "BTY-NONEXISTENT"));
        assert!(result.is_none());
    }
}
