#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, panic_with_error, Address, Env, Symbol};

const ADMIN: Symbol = symbol_short!("ADMIN");

#[contract]
pub struct SecureToken;

#[contractimpl]
impl SecureToken {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        if env.storage().instance().has(&ADMIN) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be strictly positive");
        }

        let from_balance: i128 = if env.storage().persistent().has(&from) {
            env.storage().persistent().get(&from).unwrap_or(0)
        } else {
            0
        };

        if from_balance < amount {
            panic!("insufficient balance");
        }

        let to_balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        let new_from = from_balance - amount;
        let new_to = to_balance + amount;

        env.storage().persistent().set(&from, &new_from);
        env.storage().persistent().set(&to, &new_to);
    }

    pub fn get_balance(env: Env, account: Address) -> i128 {
        env.storage().persistent().get(&account).unwrap_or(0)
    }
}
