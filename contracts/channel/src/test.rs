#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, Ledger},
    Address, Env,
};
use tether_token::{TetherTokenContract, TetherTokenContractClient};

fn setup_test_env(
    env: &Env,
) -> (
    Address,
    Address,
    Address,
    ChannelContractClient<'static>,
    TetherTokenContractClient<'static>,
) {
    env.mock_all_auths();

    // Deploy and initialise the TetherToken contract
    let authority = Address::generate(env);
    let token_id = env.register_contract(None, TetherTokenContract);
    let token_client = TetherTokenContractClient::new(env, &token_id);
    token_client.initialize(&authority);

    // Deploy the Channel contract
    let channel_id = env.register_contract(None, ChannelContract);
    let channel_client = ChannelContractClient::new(env, &channel_id);

    let originator = Address::generate(env);
    let beneficiary = Address::generate(env);

    // Pre-fund originator with 1000 TTH
    token_client.mint(&originator, &1000);

    (
        originator,
        beneficiary,
        token_id,
        channel_client,
        token_client,
    )
}

// ── Test 1 ──────────────────────────────────────────────────────────────────
#[test]
fn test_allocate_asset_stream_locks_capital() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, token_client) =
        setup_test_env(&env);

    env.ledger().set_timestamp(100);
    let ch_id = channel_client.allocate_asset_stream(
        &originator,
        &beneficiary,
        &token_id,
        &100,
        &10,
    );

    assert_eq!(ch_id, 1);
    assert_eq!(token_client.balance(&originator), 900);
    assert_eq!(token_client.balance(&channel_client.address), 100);

    let ch = channel_client.fetch_channel_state(&1);
    assert_eq!(ch.originator, originator);
    assert_eq!(ch.beneficiary, beneficiary);
    assert_eq!(ch.locked_capital, 100);
    assert_eq!(ch.epoch_start, 100);
    assert_eq!(ch.channel_duration, 10);
    assert_eq!(ch.capital_released, 0);
    assert_eq!(ch.token, token_id);
}

// ── Test 2 ──────────────────────────────────────────────────────────────────
#[test]
fn test_compute_unlocked_capital_linear_vesting() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, _) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    // At t=0 elapsed → 0 unlocked
    assert_eq!(channel_client.compute_unlocked_capital(&1), 0);

    // At t=105 → 50% elapsed → 50 unlocked
    env.ledger().set_timestamp(105);
    assert_eq!(channel_client.compute_unlocked_capital(&1), 50);

    // At t=110 → 100% elapsed → 100 unlocked
    env.ledger().set_timestamp(110);
    assert_eq!(channel_client.compute_unlocked_capital(&1), 100);

    // Past duration → still capped at 100
    env.ledger().set_timestamp(120);
    assert_eq!(channel_client.compute_unlocked_capital(&1), 100);
}

// ── Test 3 ──────────────────────────────────────────────────────────────────
#[test]
fn test_release_matured_capital_transfers_correct_amount() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, token_client) =
        setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    // 50% vested
    env.ledger().set_timestamp(105);
    let claimed = channel_client.release_matured_capital(&1);
    assert_eq!(claimed, 50);
    assert_eq!(token_client.balance(&beneficiary), 50);
    assert_eq!(token_client.balance(&channel_client.address), 50);

    // Remaining 50% vested
    env.ledger().set_timestamp(110);
    let claimed_again = channel_client.release_matured_capital(&1);
    assert_eq!(claimed_again, 50);
    assert_eq!(token_client.balance(&beneficiary), 100);
    assert_eq!(token_client.balance(&channel_client.address), 0);
}

// ── Test 4 ──────────────────────────────────────────────────────────────────
#[test]
fn test_release_matured_capital_requires_beneficiary_auth() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, _) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    env.ledger().set_timestamp(105);
    channel_client.release_matured_capital(&1);

    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    let (auth_address, invocation) = &auths[0];
    assert_eq!(auth_address, &beneficiary);

    match &invocation.function {
        AuthorizedFunction::Contract((address, name, _args)) => {
            assert_eq!(address, &channel_client.address);
            assert_eq!(
                name,
                &soroban_sdk::Symbol::new(&env, "release_matured_capital")
            );
        }
        _ => panic!("unexpected auth function"),
    }
}

// ── Test 5 ──────────────────────────────────────────────────────────────────
#[test]
#[should_panic]
fn test_allocate_asset_stream_rejects_zero_capital() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, _) = setup_test_env(&env);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &0, &10);
}

// ── Test 6 ──────────────────────────────────────────────────────────────────
#[test]
#[should_panic]
fn test_allocate_asset_stream_rejects_zero_duration() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, _) = setup_test_env(&env);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &0);
}

// ── Test 7 ──────────────────────────────────────────────────────────────────
#[test]
fn test_terminate_active_channel_splits_capital_correctly() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, token_client) =
        setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    // Cancel at 50% vested
    env.ledger().set_timestamp(105);
    channel_client.terminate_active_channel(&1);

    assert_eq!(token_client.balance(&originator), 950);
    assert_eq!(token_client.balance(&beneficiary), 50);
    assert_eq!(token_client.balance(&channel_client.address), 0);

    let ch = channel_client.fetch_channel_state(&1);
    assert_eq!(ch.locked_capital, 50);
    assert_eq!(ch.channel_duration, 5);
    assert_eq!(ch.capital_released, 50);
}

// ── Test 8 ──────────────────────────────────────────────────────────────────
#[test]
fn test_enumerate_channels_by_party_returns_correct_ids() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, _) = setup_test_env(&env);
    let other_beneficiary = Address::generate(&env);

    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);
    channel_client.allocate_asset_stream(
        &originator,
        &other_beneficiary,
        &token_id,
        &100,
        &10,
    );

    assert_eq!(
        channel_client.enumerate_channels_by_party(&originator),
        soroban_sdk::Vec::from_array(&env, [1, 2])
    );
    assert_eq!(
        channel_client.enumerate_channels_by_party(&beneficiary),
        soroban_sdk::Vec::from_array(&env, [1])
    );
    assert_eq!(
        channel_client.enumerate_channels_by_party(&other_beneficiary),
        soroban_sdk::Vec::from_array(&env, [2])
    );
}

// ── Test 9 ──────────────────────────────────────────────────────────────────
#[test]
fn test_partial_release_tracks_cumulative_capital_correctly() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, token_client) =
        setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    env.ledger().set_timestamp(103);
    assert_eq!(channel_client.release_matured_capital(&1), 30);

    env.ledger().set_timestamp(107);
    assert_eq!(channel_client.release_matured_capital(&1), 40);
    assert_eq!(token_client.balance(&beneficiary), 70);
    assert_eq!(channel_client.fetch_channel_state(&1).capital_released, 70);
}

// ── Test 10 ─────────────────────────────────────────────────────────────────
#[test]
fn test_terminate_after_partial_release_settles_remainder() {
    let env = Env::default();
    let (originator, beneficiary, token_id, channel_client, token_client) =
        setup_test_env(&env);

    env.ledger().set_timestamp(100);
    channel_client.allocate_asset_stream(&originator, &beneficiary, &token_id, &100, &10);

    env.ledger().set_timestamp(103);
    channel_client.release_matured_capital(&1);

    env.ledger().set_timestamp(106);
    channel_client.terminate_active_channel(&1);

    assert_eq!(token_client.balance(&originator), 940);
    assert_eq!(token_client.balance(&beneficiary), 60);
    assert_eq!(token_client.balance(&channel_client.address), 0);

    let ch = channel_client.fetch_channel_state(&1);
    assert_eq!(ch.locked_capital, 60);
    assert_eq!(ch.capital_released, 60);
}

// ── Test 11 ─────────────────────────────────────────────────────────────────
#[test]
fn test_self_channel_listed_once_for_same_party() {
    let env = Env::default();
    let (originator, _, token_id, channel_client, _) = setup_test_env(&env);

    channel_client.allocate_asset_stream(&originator, &originator, &token_id, &100, &10);

    assert_eq!(
        channel_client.enumerate_channels_by_party(&originator),
        soroban_sdk::Vec::from_array(&env, [1])
    );
}
