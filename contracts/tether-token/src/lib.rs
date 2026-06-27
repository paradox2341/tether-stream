#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

/// Storage key schema for the TetherToken contract.
#[contracttype]
#[derive(Clone)]
pub enum LedgerKey {
    Authority,
    Holding(Address),
}

/// TetherToken (TTH) — the protocol-native token for TetherStream capital channels.
/// 7 decimal places; mintable by the designated authority only.
#[contract]
pub struct TetherTokenContract;

#[contractimpl]
impl TetherTokenContract {
    /// Returns the human-readable token name.
    pub fn name(env: Env) -> String {
        String::from_str(&env, "Tether Token")
    }

    /// Returns the token ticker symbol.
    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "TTH")
    }

    /// Returns the number of decimal places (7).
    pub fn decimals(_env: Env) -> u32 {
        7
    }

    /// Initialises the contract with a designated minting authority.
    /// Can only be called once.
    pub fn initialize(env: Env, authority: Address) {
        if env.storage().instance().has(&LedgerKey::Authority) {
            panic!("already initialized");
        }
        env.storage()
            .instance()
            .set(&LedgerKey::Authority, &authority);
    }

    /// Returns the current minting authority address.
    pub fn authority(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&LedgerKey::Authority)
            .expect("authority not set")
    }

    /// Returns the TTH holding balance for a given address.
    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&LedgerKey::Holding(id))
            .unwrap_or(0)
    }

    /// Transfers `amount` TTH from `from` to `to`.
    /// Requires authorization from `from`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("transfer amount must be positive");
        }

        let from_holding = Self::balance(env.clone(), from.clone());
        if from_holding < amount {
            panic!("insufficient holding balance");
        }

        env.storage()
            .persistent()
            .set(&LedgerKey::Holding(from.clone()), &(from_holding - amount));

        let to_holding = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&LedgerKey::Holding(to.clone()), &(to_holding + amount));

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
    }

    /// Mints `amount` TTH to `recipient`. Only callable by the authority.
    pub fn mint(env: Env, recipient: Address, amount: i128) {
        let authority = Self::authority(env.clone());
        authority.require_auth();

        if amount <= 0 {
            panic!("mint amount must be positive");
        }

        let current = Self::balance(env.clone(), recipient.clone());
        env.storage()
            .persistent()
            .set(&LedgerKey::Holding(recipient.clone()), &(current + amount));

        env.events()
            .publish((Symbol::new(&env, "tth_minted"), recipient), amount);
    }
}

mod test;
