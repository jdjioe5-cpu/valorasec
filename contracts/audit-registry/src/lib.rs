#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Map, String, Symbol,
    Vec,
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
    use soroban_sdk::{Address, BytesN, Env, String};

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

    #[test]
    fn test_audit_registered_and_verified_events_emission() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_id = String::from_str(&env, "proj-101");
        let report_hash = BytesN::from_array(&env, &[42u8; 32]);

        let audit_id = client.register_audit(&project_id, &report_hash, &auditor);
        let events_after_reg = env.events().all();
        assert_eq!(events_after_reg.len(), 1);

        // Verify event
        let verified = client.verify_audit(&audit_id, &report_hash);
        assert!(verified);
        let events_after_verify = env.events().all();
        assert_eq!(events_after_verify.len(), 1);
    }

    #[test]
    fn test_verify_non_existent_audit_emits_false_event() {
        let env = Env::default();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let non_existent_id = String::from_str(&env, "AUD-9999");
        let hash = BytesN::from_array(&env, &[0u8; 32]);

        let verified = client.verify_audit(&non_existent_id, &hash);
        assert!(!verified);

        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_list_project_audits_cardinality() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(AuditRegistry, ());
        let client = AuditRegistryClient::new(&env, &contract_id);

        let auditor = Address::generate(&env);
        let project_a = String::from_str(&env, "project-alpha");
        let project_b = String::from_str(&env, "project-beta");

        assert_eq!(client.list_project_audits(&project_a).len(), 0);

        let hash1 = BytesN::from_array(&env, &[1u8; 32]);
        let hash2 = BytesN::from_array(&env, &[2u8; 32]);
        let hash3 = BytesN::from_array(&env, &[3u8; 32]);

        let id1 = client.register_audit(&project_a, &hash1, &auditor);
        let id2 = client.register_audit(&project_b, &hash2, &auditor);
        let id3 = client.register_audit(&project_a, &hash3, &auditor);

        let list_a = client.list_project_audits(&project_a);
        assert_eq!(list_a.len(), 2);
        assert_eq!(list_a.get(0).unwrap(), id1);
        assert_eq!(list_a.get(1).unwrap(), id3);

        let list_b = client.list_project_audits(&project_b);
        assert_eq!(list_b.len(), 1);
        assert_eq!(list_b.get(0).unwrap(), id2);
    }
}
