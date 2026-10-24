#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Map, String, Vec,
};

// ─── Types ────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct AuditRecord {
    pub audit_id: String,
    pub project_id: String,
    pub report_hash: BytesN<32>,
    pub auditor: Address,
    pub timestamp: u64,
    pub metadata: Map<String, String>,
}

// ─── Storage Keys ──────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    AuditCount,
    Audit(String),
    ProjectAudits(String),
}

// ─── Error ────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuditRegistryError {
    AlreadyRegistered = 1,
    NotFound = 2,
}

#[contract]
pub struct AuditRegistry;

#[contractimpl]
impl AuditRegistry {
    /// Register a new audit record on-chain
    pub fn register_audit(
        env: Env,
        project_id: String,
        report_hash: BytesN<32>,
        auditor: Address,
    ) -> Result<String, AuditRegistryError> {
        auditor.require_auth();

        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::AuditCount)
            .unwrap_or(0);

        let next_count = count
            .checked_add(1)
            .ok_or(AuditRegistryError::AlreadyRegistered)?;
        let audit_id = format_audit_id(&env, next_count);

        if env
            .storage()
            .persistent()
            .has(&DataKey::Audit(audit_id.clone()))
        {
            return Err(AuditRegistryError::AlreadyRegistered);
        }

        let record = AuditRecord {
            audit_id: audit_id.clone(),
            project_id: project_id.clone(),
            report_hash,
            auditor,
            timestamp: env.ledger().timestamp(),
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
            .set(&DataKey::ProjectAudits(project_id), &audits);

        env.storage()
            .persistent()
            .set(&DataKey::AuditCount, &next_count);

        Ok(audit_id)
    }

    /// Verify that an audit record exists with the given hash
    pub fn verify_audit(env: Env, audit_id: String, report_hash: BytesN<32>) -> bool {
        if let Some(record) = env
            .storage()
            .persistent()
            .get::<DataKey, AuditRecord>(&DataKey::Audit(audit_id))
        {
            return record.report_hash == report_hash;
        }
        false
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
            .get::<DataKey, Vec<String>>(&DataKey::ProjectAudits(project_id))
            .unwrap_or_else(|| Vec::new(&env))
    }
}

fn format_audit_id(env: &Env, count: u32) -> String {
    let mut buf = [0u8; 20];
    let prefix = b"AUD-";
    buf[..4].copy_from_slice(prefix);
    let mut n = count;
    if n == 0 {
        buf[4] = b'0';
        let s = core::str::from_utf8(&buf[..5]).unwrap();
        return String::from_str(env, s);
    }
    let mut num_buf = [0u8; 10];
    let mut i = 0;
    while n > 0 {
        num_buf[i] = (n % 10) as u8 + b'0';
        n /= 10;
        i += 1;
    }
    let mut pos = 4;
    while i > 0 {
        i -= 1;
        buf[pos] = num_buf[i];
        pos += 1;
    }
    let s = core::str::from_utf8(&buf[..pos]).unwrap();
    String::from_str(env, s)
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, BytesN, Env, String};

    #[test]
    fn test_register_and_verify_audit_roundtrip() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-123");
        let report_hash = BytesN::from_array(&env, &[1u8; 32]);

        let audit_id = client.register_audit(&project_id, &report_hash, &auditor);
        assert_eq!(audit_id, String::from_str(&env, "AUD-1"));

        let verified = client.verify_audit(&audit_id, &report_hash);
        assert!(verified);

        let record = client.get_audit(&audit_id);
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record.audit_id, audit_id);
        assert_eq!(record.project_id, project_id);
        assert_eq!(record.auditor, auditor);
        assert_eq!(record.report_hash, report_hash);

        let audits = client.list_project_audits(&project_id);
        assert_eq!(audits.len(), 1);
        assert_eq!(audits.get(0).unwrap(), audit_id);
    }

    #[test]
    fn test_register_duplicate_audit_id_produces_error() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-dup-test");
        let report_hash = BytesN::from_array(&env, &[5u8; 32]);

        // Pre-populate storage with AUD-1 to simulate conflict collision
        env.as_contract(&contract_id, || {
            let conflict_id = String::from_str(&env, "AUD-1");
            let dummy_record = AuditRecord {
                audit_id: conflict_id.clone(),
                project_id: project_id.clone(),
                report_hash: report_hash.clone(),
                auditor: auditor.clone(),
                timestamp: env.ledger().timestamp(),
                metadata: Map::new(&env),
            };
            env.storage()
                .persistent()
                .set(&DataKey::Audit(conflict_id), &dummy_record);
        });

        // Attempting to register when AUD-1 already exists must return AlreadyRegistered error without panicking
        let res = client.try_register_audit(&project_id, &report_hash, &auditor);
        assert_eq!(res, Err(Ok(AuditRegistryError::AlreadyRegistered)));
    }

    #[test]
    fn test_verify_non_existent_audit_returns_false() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let non_existent_id = String::from_str(&env, "AUD-99999");
        let arbitrary_hash = BytesN::from_array(&env, &[9u8; 32]);

        // Non-existent audit ID returns false
        assert!(!client.verify_audit(&non_existent_id, &arbitrary_hash));

        // Existing audit with mismatched hash returns false
        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-hash-mismatch");
        let real_hash = BytesN::from_array(&env, &[42u8; 32]);
        let audit_id = client.register_audit(&project_id, &real_hash, &auditor);

        let wrong_hash = BytesN::from_array(&env, &[99u8; 32]);
        assert!(!client.verify_audit(&audit_id, &wrong_hash));
        assert!(client.verify_audit(&audit_id, &real_hash));
    }

    #[test]
    fn test_list_project_audits_cardinality() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_empty = String::from_str(&env, "proj-empty");
        let project_single = String::from_str(&env, "proj-single");
        let project_many = String::from_str(&env, "proj-many");

        // 0 records: returns empty Vec
        let empty_list = client.list_project_audits(&project_empty);
        assert_eq!(empty_list.len(), 0);

        // 1 record
        let hash_1 = BytesN::from_array(&env, &[11u8; 32]);
        let id_1 = client.register_audit(&project_single, &hash_1, &auditor);
        let single_list = client.list_project_audits(&project_single);
        assert_eq!(single_list.len(), 1);
        assert_eq!(single_list.get(0).unwrap(), id_1);

        // Many records (5 records)
        let mut expected_ids = Vec::new(&env);
        for i in 0..5u8 {
            let hash = BytesN::from_array(&env, &[20 + i; 32]);
            let id = client.register_audit(&project_many, &hash, &auditor);
            expected_ids.push_back(id);
        }

        let many_list = client.list_project_audits(&project_many);
        assert_eq!(many_list.len(), 5);
        for i in 0..5 {
            assert_eq!(many_list.get(i).unwrap(), expected_ids.get(i).unwrap());
        }
    }

    #[test]
    fn test_get_audit_non_existent_returns_none() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let non_existent = String::from_str(&env, "AUD-NOT-FOUND");
        let result = client.get_audit(&non_existent);
        assert!(result.is_none());
    }

    #[test]
    fn test_concurrent_registrations_different_auditors() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor_1 = Address::generate(&env);
        let auditor_2 = Address::generate(&env);
        let auditor_3 = Address::generate(&env);

        let proj_a = String::from_str(&env, "proj-alpha");
        let proj_b = String::from_str(&env, "proj-beta");

        let hash_1 = BytesN::from_array(&env, &[101u8; 32]);
        let hash_2 = BytesN::from_array(&env, &[102u8; 32]);
        let hash_3 = BytesN::from_array(&env, &[103u8; 32]);

        let id_1 = client.register_audit(&proj_a, &hash_1, &auditor_1);
        let id_2 = client.register_audit(&proj_b, &hash_2, &auditor_2);
        let id_3 = client.register_audit(&proj_a, &hash_3, &auditor_3);

        assert_eq!(id_1, String::from_str(&env, "AUD-1"));
        assert_eq!(id_2, String::from_str(&env, "AUD-2"));
        assert_eq!(id_3, String::from_str(&env, "AUD-3"));

        let rec_1 = client.get_audit(&id_1).unwrap();
        let rec_2 = client.get_audit(&id_2).unwrap();
        let rec_3 = client.get_audit(&id_3).unwrap();

        assert_eq!(rec_1.auditor, auditor_1);
        assert_eq!(rec_2.auditor, auditor_2);
        assert_eq!(rec_3.auditor, auditor_3);

        // Project Alpha has 2 audits, Project Beta has 1
        assert_eq!(client.list_project_audits(&proj_a).len(), 2);
        assert_eq!(client.list_project_audits(&proj_b).len(), 1);
    }

    #[test]
    fn test_storage_limits_registering_100_plus_audits() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-stress-100");

        // Register 105 audits continuously
        let total_audits = 105;
        let mut last_id = String::from_str(&env, "");

        for i in 1..=total_audits {
            let mut byte_arr = [0u8; 32];
            byte_arr[0] = (i % 255) as u8;
            byte_arr[1] = (i / 255) as u8;
            let hash = BytesN::from_array(&env, &byte_arr);

            let id = client.register_audit(&project_id, &hash, &auditor);
            if i == 1 {
                assert_eq!(id, String::from_str(&env, "AUD-1"));
            }
            if i == 100 {
                assert_eq!(id, String::from_str(&env, "AUD-100"));
            }
            if i == total_audits {
                assert_eq!(id, String::from_str(&env, "AUD-105"));
                last_id = id;
            }
        }

        // Verify bounds & persistence of first and last audit
        let first_id = String::from_str(&env, "AUD-1");
        let first_rec = client.get_audit(&first_id).expect("AUD-1 must exist");
        assert_eq!(first_rec.audit_id, first_id);

        let last_rec = client.get_audit(&last_id).expect("AUD-105 must exist");
        assert_eq!(last_rec.audit_id, last_id);

        // Verify project audit list contains all 105 audits
        let all_audits = client.list_project_audits(&project_id);
        assert_eq!(all_audits.len(), 105);
        assert_eq!(all_audits.get(0).unwrap(), first_id);
        assert_eq!(all_audits.get(104).unwrap(), last_id);
    }
}
