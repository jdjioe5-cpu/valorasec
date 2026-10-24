#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String,
    Symbol, Vec,
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
    /// Initialize the contract and assign the admin address at deploy time
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        if env.storage().persistent().has(&symbol_short!("admin")) {
            panic!("Already initialized");
        }
        env.storage()
            .persistent()
            .set(&symbol_short!("admin"), &admin);
    }

    /// Retrieve the admin address if initialized
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().persistent().get(&symbol_short!("admin"))
    }

    /// Upgrade the contract's executable WASM code (admin only)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&symbol_short!("admin"))
            .expect("Admin not set");
        admin.require_auth();

        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        let now = env.ledger().timestamp();
        env.events().publish(
            (Symbol::new(&env, "ContractUpgraded"),),
            (new_wasm_hash, now),
        );
    }

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
    use soroban_sdk::{Address, Bytes, BytesN, Env, String};

    const VALID_TEST_WASM: &[u8] = &[
        0, 97, 115, 109, 1, 0, 0, 0, 1, 20, 4, 96, 1, 126, 1, 126, 96, 2, 127, 126, 0, 96, 2, 126,
        126, 1, 126, 96, 0, 0, 2, 13, 2, 1, 105, 1, 48, 0, 0, 1, 105, 1, 95, 0, 0, 3, 6, 5, 1, 2,
        3, 3, 3, 5, 3, 1, 0, 16, 6, 25, 3, 127, 1, 65, 128, 128, 192, 0, 11, 127, 0, 65, 128, 128,
        192, 0, 11, 127, 0, 65, 128, 128, 192, 0, 11, 7, 47, 5, 6, 109, 101, 109, 111, 114, 121, 2,
        0, 3, 97, 100, 100, 0, 3, 1, 95, 0, 6, 10, 95, 95, 100, 97, 116, 97, 95, 101, 110, 100, 3,
        1, 11, 95, 95, 104, 101, 97, 112, 95, 98, 97, 115, 101, 3, 2, 10, 140, 2, 5, 93, 2, 1, 127,
        1, 126, 2, 64, 2, 64, 32, 1, 167, 65, 255, 1, 113, 34, 2, 65, 192, 0, 70, 13, 0, 2, 64, 32,
        2, 65, 6, 70, 13, 0, 66, 1, 33, 3, 66, 131, 144, 128, 128, 128, 1, 33, 1, 12, 2, 11, 32, 1,
        66, 8, 136, 33, 1, 66, 0, 33, 3, 12, 1, 11, 66, 0, 33, 3, 32, 1, 16, 128, 128, 128, 128, 0,
        33, 1, 11, 32, 0, 32, 1, 55, 3, 8, 32, 0, 32, 3, 55, 3, 0, 11, 153, 1, 1, 1, 127, 35, 128,
        128, 128, 128, 0, 65, 32, 107, 34, 2, 36, 128, 128, 128, 128, 0, 32, 2, 65, 16, 106, 32, 0,
        16, 130, 128, 128, 128, 0, 2, 64, 2, 64, 32, 2, 40, 2, 16, 13, 0, 32, 2, 41, 3, 24, 33, 0,
        32, 2, 32, 1, 16, 130, 128, 128, 128, 0, 32, 2, 41, 3, 0, 167, 13, 0, 32, 0, 32, 2, 41, 3,
        8, 124, 34, 1, 32, 0, 84, 13, 1, 2, 64, 2, 64, 32, 1, 66, 255, 255, 255, 255, 255, 255,
        255, 255, 0, 86, 13, 0, 32, 1, 66, 8, 134, 66, 6, 132, 33, 0, 12, 1, 11, 32, 1, 16, 129,
        128, 128, 128, 0, 33, 0, 11, 32, 2, 65, 32, 106, 36, 128, 128, 128, 128, 0, 32, 0, 15, 11,
        0, 0, 11, 16, 132, 128, 128, 128, 0, 0, 11, 9, 0, 16, 133, 128, 128, 128, 0, 0, 11, 4, 0,
        0, 0, 11, 2, 0, 11, 0, 75, 14, 99, 111, 110, 116, 114, 97, 99, 116, 115, 112, 101, 99, 118,
        48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 97, 100, 100, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
        1, 97, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 1, 98, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0,
        0, 0, 6, 0, 30, 17, 99, 111, 110, 116, 114, 97, 99, 116, 101, 110, 118, 109, 101, 116, 97,
        118, 48, 0, 0, 0, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 123, 14, 99, 111, 110, 116, 114, 97, 99,
        116, 109, 101, 116, 97, 118, 48, 0, 0, 0, 0, 0, 0, 0, 5, 114, 115, 118, 101, 114, 0, 0, 0,
        0, 0, 0, 6, 49, 46, 55, 52, 46, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 114, 115, 115, 100, 107,
        118, 101, 114, 0, 0, 0, 57, 50, 49, 46, 48, 46, 49, 45, 112, 114, 101, 118, 105, 101, 119,
        46, 49, 35, 49, 49, 54, 99, 51, 53, 98, 99, 57, 101, 48, 51, 102, 52, 98, 49, 98, 53, 101,
        54, 53, 98, 53, 101, 101, 56, 51, 49, 97, 101, 48, 102, 56, 54, 97, 97, 57, 50, 102, 100,
        0, 0, 0,
    ];

    fn install_mock_token(env: &Env, admin: &Address) -> Address {
        env.register_stellar_asset_contract_v2(admin.clone())
            .address()
    }

    #[test]
    fn test_admin_init_and_upgrade_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);
        assert_eq!(client.get_admin(), Some(admin.clone()));

        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));

        client.upgrade(&wasm_hash);
        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }

    #[test]
    #[should_panic]
    fn test_upgrade_from_non_admin_fails() {
        let env = Env::default();
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin);

        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));

        // Disable auth mocking so non-admin caller cannot sign for admin
        env.mock_auths(&[]);
        client.upgrade(&wasm_hash);
    }

    #[test]
    #[should_panic(expected = "Admin not set")]
    fn test_upgrade_uninitialized_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(&env, &contract_id);

        let dummy_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.upgrade(&dummy_hash);
    }

    #[test]
    fn test_bounty_records_survive_upgrade_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(BugBounty, ());
        let client = BugBountyClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let token_addr = install_mock_token(&env, &creator);

        client.init(&admin);

        let bounty_id = client.create_bounty(
            &creator,
            &String::from_str(&env, "C_TARGET"),
            &String::from_str(&env, "Bug Bounty"),
            &String::from_str(&env, "Test Desc"),
            &100_000,
            &token_addr,
        );

        // Perform upgrade
        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));
        client.upgrade(&wasm_hash);

        // Verify storage persisted across executable upgrade
        let persisted_bounty: Bounty = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get::<String, Bounty>(&bounty_id)
                .unwrap()
        });
        assert_eq!(persisted_bounty.id, bounty_id);
        assert_eq!(persisted_bounty.creator, creator);
        assert_eq!(persisted_bounty.reward, 100_000);
        assert_eq!(persisted_bounty.status, BountyStatus::Open);
    }
}
