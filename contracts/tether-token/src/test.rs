#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup_tether_token(env: &Env) -> (Address, TetherTokenContractClient<'static>) {
    env.mock_all_auths();
    let authority = Address::generate(env);
    let token_id = env.register(TetherTokenContract, ());
    let token_client = TetherTokenContractClient::new(env, &token_id);
    token_client.initialize(&authority);
    (authority, token_client)
}

#[test]
fn test_tth_token_metadata_is_correct() {
    let env = Env::default();
    let (_, token_client) = setup_tether_token(&env);

    assert_eq!(token_client.name(), String::from_str(&env, "Tether Token"));
    assert_eq!(token_client.symbol(), String::from_str(&env, "TTH"));
    assert_eq!(token_client.decimals(), 7);
}

#[test]
fn test_authority_can_mint_tth() {
    let env = Env::default();
    let (_, token_client) = setup_tether_token(&env);
    let recipient = Address::generate(&env);

    token_client.mint(&recipient, &500);

    assert_eq!(token_client.balance(&recipient), 500);
}

#[test]
fn test_transfer_moves_tth_between_holdings() {
    let env = Env::default();
    let (_, token_client) = setup_tether_token(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    token_client.mint(&sender, &300);

    token_client.transfer(&sender, &receiver, &120);

    assert_eq!(token_client.balance(&sender), 180);
    assert_eq!(token_client.balance(&receiver), 120);
}

#[test]
#[should_panic(expected = "insufficient holding balance")]
fn test_transfer_panics_on_insufficient_balance() {
    let env = Env::default();
    let (_, token_client) = setup_tether_token(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);

    // sender has 0 TTH — should panic
    token_client.transfer(&sender, &receiver, &1);
}

#[test]
#[should_panic(expected = "mint amount must be positive")]
fn test_mint_panics_on_zero_amount() {
    let env = Env::default();
    let (_, token_client) = setup_tether_token(&env);
    let recipient = Address::generate(&env);
    token_client.mint(&recipient, &0);
}
