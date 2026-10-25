#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

const BALANCE: Symbol = symbol_short!("BALANCE");

#[contract]
pub struct VulnerableToken;

#[contractimpl]
impl VulnerableToken {
    /// Initialize the contract with an admin
    pub fn initialize(env: Env, admin: Address) {
        // R001: Missing require_auth check on admin
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
    }

    /// Transfer tokens without verifying caller authorization
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        // R001: Missing authorization check! `from.require_auth()` is absent
        // R003: Missing input validation on amount (no amount > 0 check)
        
        // R002: Unsafe storage access directly unwrapping without .has()
        let from_balance: i128 = env.storage().persistent().get(&from).unwrap();
        let to_balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);

        // R005: Unhandled panic on arithmetic or explicit unwrap
        let new_from = from_balance.checked_sub(amount).expect("subtraction underflow");
        let new_to = to_balance.checked_add(amount).unwrap();

        env.storage().persistent().set(&from, &new_from);
        env.storage().persistent().set(&to, &new_to);
    }

    /// Distribute rewards using predictable on-chain randomness
    pub fn lucky_draw(env: Env, player: Address) -> u32 {
        player.require_auth();
        // R007: Unsafe randomness from timestamp
        let seed = env.ledger().timestamp() % 100;
        seed as u32
    }

    /// Potentially infinite loop consuming unbound gas
    pub fn process_queue(env: Env) {
        // R006: Gas inefficient loop
        let mut count = 0;
        loop {
            count += 1;
            if count > 1000000 {
                break;
            }
        }
    }

    /// Function with dead code after return
    pub fn helper_calc(x: u32) -> u32 {
        let res = x * 2;
        return res;
        let dead_val = 100; // R004: Dead code
    }
}
