#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol, Vec};

/// Represents an active capital channel (vesting stream) on-chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Channel {
    pub originator: Address,
    pub beneficiary: Address,
    pub locked_capital: i128,
    pub epoch_start: u64,
    pub channel_duration: u64,
    pub capital_released: i128,
    pub token: Address,
}

/// Emitted when an originator opens a new capital channel. Topic: `channel_allocated`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChannelAllocated {
    #[topic]
    pub channel_id: u64,
    #[topic]
    pub originator: Address,
    #[topic]
    pub beneficiary: Address,
    pub locked_capital: i128,
}

/// Emitted when a beneficiary claims vested capital. Topic: `capital_released`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapitalReleased {
    #[topic]
    pub channel_id: u64,
    #[topic]
    pub beneficiary: Address,
    pub claimed: i128,
}

/// Emitted when an originator terminates a channel early. Topic: `channel_terminated`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChannelTerminated {
    #[topic]
    pub channel_id: u64,
    #[topic]
    pub originator: Address,
    pub returned_to_originator: i128,
}

#[contract]
pub struct ChannelContract;

#[contractimpl]
impl ChannelContract {
    /// Allocates a new linear vesting capital channel.
    /// Locks `deposit` tokens from `originator` into this contract via inter-contract call.
    pub fn allocate_asset_stream(
        env: Env,
        originator: Address,
        beneficiary: Address,
        token: Address,
        locked_capital: i128,
        channel_duration: u64,
    ) -> u64 {
        originator.require_auth();

        if locked_capital <= 0 {
            panic!("locked capital must be positive");
        }
        if channel_duration == 0 {
            panic!("channel duration must be positive");
        }

        // Increment and persist the global channel sequence counter
        let mut seq = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "channel_seq"))
            .unwrap_or(0u64);
        seq += 1;
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "channel_seq"), &seq);

        let channel = Channel {
            originator: originator.clone(),
            beneficiary: beneficiary.clone(),
            locked_capital,
            epoch_start: env.ledger().timestamp(),
            channel_duration,
            capital_released: 0,
            token: token.clone(),
        };

        env.storage().persistent().set(&seq, &channel);

        // Index this channel ID under the originator's address
        let mut originator_channels: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "originator_channels"), originator.clone()))
            .unwrap_or(Vec::new(&env));
        originator_channels.push_back(seq);
        env.storage().persistent().set(
            &(Symbol::new(&env, "originator_channels"), originator.clone()),
            &originator_channels,
        );

        // Index this channel ID under the beneficiary's address (if different)
        if originator != beneficiary {
            let mut beneficiary_channels: Vec<u64> = env
                .storage()
                .persistent()
                .get(&(
                    Symbol::new(&env, "beneficiary_channels"),
                    beneficiary.clone(),
                ))
                .unwrap_or(Vec::new(&env));
            beneficiary_channels.push_back(seq);
            env.storage().persistent().set(
                &(
                    Symbol::new(&env, "beneficiary_channels"),
                    beneficiary.clone(),
                ),
                &beneficiary_channels,
            );
        }

        // ── Inter-Contract Call ──────────────────────────────────────────────────
        // Transfers locked_capital from originator into this contract's custody
        // via soroban_sdk::token::Client (Soroban-to-Soroban invocation).
        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&originator, env.current_contract_address(), &locked_capital);
        // ────────────────────────────────────────────────────────────────────────

        ChannelAllocated {
            channel_id: seq,
            originator,
            beneficiary,
            locked_capital,
        }
        .publish(&env);

        seq
    }

    /// Returns the full channel state for a given channel ID.
    pub fn fetch_channel_state(env: Env, channel_id: u64) -> Channel {
        env.storage()
            .persistent()
            .get(&channel_id)
            .expect("channel not found")
    }

    /// Computes the linearly unlocked capital for a channel at the current ledger time.
    /// Formula: locked_capital × min(elapsed, duration) / duration
    pub fn compute_unlocked_capital(env: Env, channel_id: u64) -> i128 {
        let channel: Channel = env
            .storage()
            .persistent()
            .get(&channel_id)
            .expect("channel not found");

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(channel.epoch_start);

        if elapsed >= channel.channel_duration {
            channel.locked_capital
        } else {
            channel.locked_capital * (elapsed as i128) / (channel.channel_duration as i128)
        }
    }

    /// Claims all newly unlocked capital and transfers it to the beneficiary.
    /// Only callable by the beneficiary. Inter-contract call executes the transfer.
    pub fn release_matured_capital(env: Env, channel_id: u64) -> i128 {
        let mut channel: Channel = env
            .storage()
            .persistent()
            .get(&channel_id)
            .expect("channel not found");

        channel.beneficiary.require_auth();

        let unlocked = Self::compute_unlocked_capital(env.clone(), channel_id);
        let claimable = unlocked - channel.capital_released;

        if claimable <= 0 {
            panic!("no capital available to release");
        }

        channel.capital_released += claimable;
        env.storage().persistent().set(&channel_id, &channel);

        // ── Inter-Contract Call ──────────────────────────────────────────────────
        // Transfers claimable amount from this contract to the beneficiary
        // via soroban_sdk::token::Client (Soroban-to-Soroban invocation).
        let token_client = soroban_sdk::token::Client::new(&env, &channel.token);
        token_client.transfer(
            &env.current_contract_address(),
            &channel.beneficiary,
            &claimable,
        );
        // ────────────────────────────────────────────────────────────────────────

        CapitalReleased {
            channel_id,
            beneficiary: channel.beneficiary.clone(),
            claimed: claimable,
        }
        .publish(&env);

        claimable
    }

    /// Terminates an active channel early.
    /// Vested portion goes to beneficiary; unvested remainder returns to originator.
    /// Only callable by the originator.
    pub fn terminate_active_channel(env: Env, channel_id: u64) {
        let channel: Channel = env
            .storage()
            .persistent()
            .get(&channel_id)
            .expect("channel not found");

        channel.originator.require_auth();

        let unlocked = Self::compute_unlocked_capital(env.clone(), channel_id);
        let to_beneficiary = unlocked - channel.capital_released;
        let to_originator = channel.locked_capital - unlocked;

        let token_client = soroban_sdk::token::Client::new(&env, &channel.token);

        if to_beneficiary > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &channel.beneficiary,
                &to_beneficiary,
            );
        }

        if to_originator > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &channel.originator,
                &to_originator,
            );
        }

        // Seal the channel state: deposit frozen at vested amount
        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(channel.epoch_start);
        let mut sealed = channel.clone();
        sealed.locked_capital = unlocked;
        sealed.channel_duration = elapsed.max(1);
        sealed.capital_released = unlocked;
        env.storage().persistent().set(&channel_id, &sealed);

        ChannelTerminated {
            channel_id,
            originator: channel.originator.clone(),
            returned_to_originator: to_originator,
        }
        .publish(&env);
    }

    /// Returns all channel IDs associated with a given address (as originator or beneficiary).
    pub fn enumerate_channels_by_party(env: Env, party: Address) -> Vec<u64> {
        let originator_channels: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "originator_channels"), party.clone()))
            .unwrap_or(Vec::new(&env));

        let beneficiary_channels: Vec<u64> = env
            .storage()
            .persistent()
            .get(&(Symbol::new(&env, "beneficiary_channels"), party.clone()))
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        for id in originator_channels.iter() {
            result.push_back(id);
        }
        for id in beneficiary_channels.iter() {
            let mut duplicate = false;
            for existing_id in result.iter() {
                if existing_id == id {
                    duplicate = true;
                    break;
                }
            }
            if !duplicate {
                result.push_back(id);
            }
        }

        result
    }
}

mod test;
