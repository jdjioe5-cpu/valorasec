#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

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
    use soroban_sdk::{Address, Env, String};

    #[test]
    fn test_create_and_update_profile_with_events() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Reputation, ());
        let client = ReputationClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let name = String::from_str(&env, "SecurityResearcher");

        // 1. Create profile -> emits ProfileCreated
        let profile = client.create_profile(&user, &name);
        assert_eq!(profile.contribution_score, 0);
        assert_eq!(env.events().all().len(), 1);

        // 2. Add points -> emits PointsAdded
        let updated = client.add_points(&user, &100, &String::from_str(&env, "Found critical bug"));
        assert_eq!(updated.contribution_score, 100);
        assert_eq!(env.events().all().len(), 1);

        // 3. Remove points -> emits PointsRemoved
        let reduced = client.remove_points(
            &user,
            &30,
            &String::from_str(&env, "False positive penalty"),
        );
        assert_eq!(reduced.contribution_score, 70);
        assert_eq!(env.events().all().len(), 1);

        // 4. Award badge -> emits BadgeEarned
        let badge_profile = client.award_badge(
            &user,
            &String::from_str(&env, "first_audit"),
            &String::from_str(&env, "First Audit"),
            &String::from_str(&env, "Completed first security audit"),
        );
        assert_eq!(badge_profile.badges.len(), 1);
        assert_eq!(env.events().all().len(), 1);

        let retrieved = client.get_profile(&user);
        assert!(retrieved.is_some());
    }
}
