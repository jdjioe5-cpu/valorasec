#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Map,
    String, Symbol, Vec,
};

// ─── Types ────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct AuditRecord {
    pub audit_id: String,
    pub project_id: String,
    pub report_hash: BytesN<32>,
    pub auditor: Address,
    pub timestamp: u64,
    pub metadata: Map<String, String>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    AuditCount,
    Audit(String),
    ProjectAudits(String),
}

// ─── Error ────────────────────────────────────────────────────────────

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[contracterror]
#[repr(u32)]
pub enum AuditRegistryError {
    AlreadyRegistered = 1,
    NotFound = 2,
}

// ─── Helpers ──────────────────────────────────────────────────────────

fn format_audit_id(env: &Env, count: u32) -> String {
    let mut buf = [0u8; 20];
    let prefix = b"AUD-";
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
    let s = core::str::from_utf8(&buf[..idx]).unwrap_or("AUD-0");
    String::from_str(env, s)
}

// ─── Contract ─────────────────────────────────────────────────────────

#[contract]
pub struct AuditRegistry;

#[contractimpl]
impl AuditRegistry {
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

    /// Register a new audit record on-chain and emit AuditRegistered event
    pub fn register_audit(
        env: Env,
        project_id: String,
        report_hash: BytesN<32>,
        auditor: Address,
    ) -> Result<String, AuditRegistryError> {
        auditor.require_auth();

        let mut count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::AuditCount)
            .unwrap_or(0);

        count += 1;
        let audit_id = format_audit_id(&env, count);

        // Prevent duplicate registration
        if env
            .storage()
            .persistent()
            .has(&DataKey::Audit(audit_id.clone()))
        {
            return Err(AuditRegistryError::AlreadyRegistered);
        }

        let now = env.ledger().timestamp();
        let record = AuditRecord {
            audit_id: audit_id.clone(),
            project_id: project_id.clone(),
            report_hash,
            auditor: auditor.clone(),
            timestamp: now,
            metadata: Map::new(&env),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Audit(audit_id.clone()), &record);

        // Update project audit list
        let mut audits: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectAudits(project_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        audits.push_back(audit_id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ProjectAudits(project_id.clone()), &audits);

        env.storage().persistent().set(&DataKey::AuditCount, &count);

        // Emit AuditRegistered(audit_id, project_id, auditor, timestamp)
        env.events().publish(
            (Symbol::new(&env, "AuditRegistered"), audit_id.clone()),
            (project_id, auditor, now),
        );

        Ok(audit_id)
    }

    /// Verify that an audit record exists with the given hash and emit AuditVerified event
    pub fn verify_audit(env: Env, audit_id: String, report_hash: BytesN<32>) -> bool {
        let now = env.ledger().timestamp();
        let verified = if let Some(record) = env
            .storage()
            .persistent()
            .get::<DataKey, AuditRecord>(&DataKey::Audit(audit_id.clone()))
        {
            record.report_hash == report_hash
        } else {
            false
        };

        // Emit AuditVerified(audit_id, verified) with timestamp
        env.events().publish(
            (Symbol::new(&env, "AuditVerified"), audit_id),
            (verified, now),
        );

        verified
    }

    /// Retrieve a specific audit record
    pub fn get_audit(env: Env, audit_id: String) -> Option<AuditRecord> {
        env.storage()
            .persistent()
            .get::<DataKey, AuditRecord>(&DataKey::Audit(audit_id))
    }

    /// List all audit IDs for a project
    pub fn list_project_audits(env: Env, project_id: String) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::ProjectAudits(project_id))
            .unwrap_or_else(|| Vec::new(&env))
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
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);
        assert_eq!(client.get_admin(), Some(admin.clone()));

        // Upload minimal valid WASM blob to get a valid wasm hash
        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));

        // Admin upgrades contract successfully
        client.upgrade(&wasm_hash);

        // Verify ContractUpgraded event
        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }

    #[test]
    #[should_panic]
    fn test_upgrade_from_non_admin_fails() {
        let env = Env::default();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin);

        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));

        // Clear auth mocking so non-admin caller cannot sign for admin
        env.mock_auths(&[]);
        client.upgrade(&wasm_hash);
    }

    #[test]
    #[should_panic(expected = "Admin not set")]
    fn test_upgrade_uninitialized_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let dummy_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.upgrade(&dummy_hash);
    }

    #[test]
    fn test_records_survive_upgrade_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-survive-upgrade");
        let report_hash = BytesN::from_array(&env, &[9u8; 32]);

        let audit_id = client.register_audit(&project_id, &report_hash, &auditor);

        // Perform upgrade
        let wasm_hash = env
            .deployer()
            .upload_contract_wasm(Bytes::from_slice(&env, VALID_TEST_WASM));
        client.upgrade(&wasm_hash);

        // Verify storage persisted across executable upgrade
        let persisted_record: AuditRecord = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::Audit(audit_id.clone()))
                .unwrap()
        });
        assert_eq!(persisted_record.audit_id, audit_id);
        assert_eq!(persisted_record.project_id, project_id);
        assert_eq!(persisted_record.auditor, auditor);
        assert_eq!(persisted_record.report_hash, report_hash);
    }

    #[test]
    fn test_register_and_verify_audit_roundtrip() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-stellar-guard");
        let report_hash = BytesN::from_array(&env, &[7u8; 32]);

        let audit_id = client.register_audit(&project_id, &report_hash, &auditor);
        assert_eq!(audit_id, String::from_str(&env, "AUD-1"));

        // Verify audit
        let is_valid = client.verify_audit(&audit_id, &report_hash);
        assert!(is_valid);

        // Record check
        let record = client.get_audit(&audit_id).unwrap();
        assert_eq!(record.audit_id, audit_id);
        assert_eq!(record.project_id, project_id);
        assert_eq!(record.auditor, auditor);
        assert_eq!(record.report_hash, report_hash);

        // Check project audit list
        let project_audits = client.list_project_audits(&project_id);
        assert_eq!(project_audits.len(), 1);
        assert_eq!(project_audits.get(0).unwrap(), audit_id);
    }
}
