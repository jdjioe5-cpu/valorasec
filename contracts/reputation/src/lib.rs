#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Symbol, Vec,
};

// ─── Types ────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Badge {
    pub id: String,
    pub name: String,
    pub description: String,
    pub earned_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Profile {
    pub address: Address,
    pub name: String,
    pub contribution_score: u32,
    pub audit_score: u32,
    pub badges: Vec<Badge>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct Reputation;

#[contractimpl]
impl Reputation {
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

    /// Create a new reputation profile and emit ProfileCreated event
    pub fn create_profile(env: Env, address: Address, name: String) -> Profile {
        address.require_auth();

        let now = env.ledger().timestamp();
        let profile = Profile {
            address: address.clone(),
            name,
            contribution_score: 0,
            audit_score: 0,
            badges: Vec::new(&env),
            created_at: now,
            updated_at: now,
        };

        env.storage().persistent().set(&address, &profile);

        // Emit ProfileCreated(address, timestamp)
        env.events().publish(
            (Symbol::new(&env, "ProfileCreated"), address),
            (profile.name.clone(), now),
        );

        profile
    }

    /// Add points to a user's contribution score and emit PointsAdded event
    pub fn add_points(env: Env, address: Address, points: u32, reason: String) -> Profile {
        address.require_auth();

        let mut profile =
            Self::get_profile(env.clone(), address.clone()).expect("Profile not found");

        let now = env.ledger().timestamp();
        profile.contribution_score += points;
        profile.updated_at = now;

        env.storage().persistent().set(&address, &profile);

        // Emit PointsAdded(address, points, reason, new_score, timestamp)
        env.events().publish(
            (Symbol::new(&env, "PointsAdded"), address),
            (points, reason, profile.contribution_score, now),
        );

        profile
    }

    /// Remove points from a user's contribution score and emit PointsRemoved event
    pub fn remove_points(env: Env, address: Address, points: u32, reason: String) -> Profile {
        address.require_auth();

        let mut profile =
            Self::get_profile(env.clone(), address.clone()).expect("Profile not found");

        let now = env.ledger().timestamp();
        profile.contribution_score = profile.contribution_score.saturating_sub(points);
        profile.updated_at = now;

        env.storage().persistent().set(&address, &profile);

        // Emit PointsRemoved(address, points, reason, new_score, timestamp)
        env.events().publish(
            (Symbol::new(&env, "PointsRemoved"), address),
            (points, reason, profile.contribution_score, now),
        );

        profile
    }

    /// Award a badge to a user and emit BadgeEarned event
    pub fn award_badge(
        env: Env,
        address: Address,
        badge_id: String,
        badge_name: String,
        description: String,
    ) -> Profile {
        let mut profile =
            Self::get_profile(env.clone(), address.clone()).expect("Profile not found");

        let now = env.ledger().timestamp();
        let badge = Badge {
            id: badge_id,
            name: badge_name,
            description,
            earned_at: now,
        };

        profile.badges.push_back(badge.clone());
        profile.updated_at = now;

        env.storage().persistent().set(&address, &profile);

        // Emit BadgeEarned(address, badge, timestamp)
        env.events()
            .publish((Symbol::new(&env, "BadgeEarned"), address), (badge, now));

        profile
    }

    /// Retrieve a user's reputation profile
    pub fn get_profile(env: Env, address: Address) -> Option<Profile> {
        env.storage().persistent().get::<Address, Profile>(&address)
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

    #[test]
    fn test_admin_init_and_upgrade_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Reputation, ());
        let client = ReputationClient::new(&env, &contract_id);

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
        let contract_id = env.register(Reputation, ());
        let client = ReputationClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin);

        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));

        // Disable auth mocking
        env.mock_auths(&[]);
        client.upgrade(&wasm_hash);
    }

    #[test]
    #[should_panic(expected = "Admin not set")]
    fn test_upgrade_uninitialized_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Reputation, ());
        let client = ReputationClient::new(&env, &contract_id);

        let dummy_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.upgrade(&dummy_hash);
    }

    #[test]
    fn test_reputation_records_survive_upgrade_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Reputation, ());
        let client = ReputationClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);

        let user = Address::generate(&env);
        let name = String::from_str(&env, "EliteAuditor");
        client.create_profile(&user, &name);
        client.add_points(&user, &250, &String::from_str(&env, "Critical finding"));

        // Perform upgrade
        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));
        client.upgrade(&wasm_hash);

        // Verify storage persisted across executable upgrade
        let persisted_profile: Profile = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get::<Address, Profile>(&user)
                .unwrap()
        });
        assert_eq!(persisted_profile.address, user);
        assert_eq!(persisted_profile.name, name);
        assert_eq!(persisted_profile.contribution_score, 250);
    }
}
