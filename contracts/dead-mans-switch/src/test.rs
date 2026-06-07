#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::testutils::{Address as _, Events, Ledger, LedgerInfo};
use soroban_sdk::{token, Address, Env};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (token::TokenClient<'a>, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    (
        token::TokenClient::new(env, &sac.address()),
        token::StellarAssetClient::new(env, &sac.address()),
    )
}

#[test]
fn test_happy_path_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token, sac) = create_token_contract(&env, &admin);
    sac.mint(&owner, &1000);

    let contract_id = env.register(DeadMansSwitch, ());
    let client = DeadMansSwitchClient::new(&env, &contract_id);

    assert_eq!(client.get_deadline(), 0);
    assert_eq!(client.get_contract_balance(), 0);
    assert_eq!(client.get_switch_status(), 0);

    let now = env.ledger().timestamp();
    client.setup_switch(&owner, &beneficiary, &token.address, &100);

    assert_eq!(client.get_deadline(), now + 100);
    assert_eq!(client.get_switch_status(), 100);

    client.deposit_funds(&500);
    assert_eq!(client.get_contract_balance(), 500);
    assert_eq!(token.balance(&contract_id), 500);
    assert_eq!(token.balance(&owner), 500);

    env.ledger().set(LedgerInfo {
        timestamp: now + 101,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    assert_eq!(client.get_switch_status(), 0);

    client.claim_inheritance();

    let _events = env.events().all();
    assert_eq!(token.balance(&beneficiary), 500);
    assert_eq!(client.get_contract_balance(), 0);
}

#[test]
#[should_panic(expected = "Owner is still alive")]
fn test_failed_claim_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token, sac) = create_token_contract(&env, &admin);
    sac.mint(&owner, &1000);

    let contract_id = env.register(DeadMansSwitch, ());
    let client = DeadMansSwitchClient::new(&env, &contract_id);

    let now = env.ledger().timestamp();
    client.setup_switch(&owner, &beneficiary, &token.address, &100);

    env.ledger().set(LedgerInfo {
        timestamp: now + 50,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    client.claim_inheritance();
}

#[test]
fn test_ping_extension() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token, sac) = create_token_contract(&env, &admin);
    sac.mint(&owner, &1000);

    let contract_id = env.register(DeadMansSwitch, ());
    let client = DeadMansSwitchClient::new(&env, &contract_id);

    let now = env.ledger().timestamp();
    client.setup_switch(&owner, &beneficiary, &token.address, &100);
    client.deposit_funds(&1000);

    env.ledger().set(LedgerInfo {
        timestamp: now + 50,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    client.ping_alive();

    let _events = env.events().all();
    assert_eq!(client.get_deadline(), now + 50 + 100);
    assert_eq!(client.get_switch_status(), 100);

    env.ledger().set(LedgerInfo {
        timestamp: now + 151,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    client.claim_inheritance();
    assert_eq!(token.balance(&beneficiary), 1000);
}

#[test]
#[should_panic(expected = "Owner is still alive")]
fn test_failed_claim_at_old_deadline_after_ping() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token, sac) = create_token_contract(&env, &admin);
    sac.mint(&owner, &1000);

    let contract_id = env.register(DeadMansSwitch, ());
    let client = DeadMansSwitchClient::new(&env, &contract_id);

    let now = env.ledger().timestamp();
    client.setup_switch(&owner, &beneficiary, &token.address, &100);
    client.deposit_funds(&1000);

    env.ledger().set(LedgerInfo {
        timestamp: now + 50,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    client.ping_alive();

    assert_eq!(client.get_deadline(), now + 150);

    env.ledger().set(LedgerInfo {
        timestamp: now + 101,
        protocol_version: 26,
        sequence_number: 100,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10000,
    });

    client.claim_inheritance();
}

#[test]
fn test_unauthorized_access() {
    let env = Env::default();

    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token, _sac) = create_token_contract(&env, &admin);

    let contract_id = env.register(DeadMansSwitch, ());
    let client = DeadMansSwitchClient::new(&env, &contract_id);

    client.setup_switch(&owner, &beneficiary, &token.address, &100);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.ping_alive();
    }));
    assert!(result.is_err(), "Non-owner should not be able to ping");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.deposit_funds(&500);
    }));
    assert!(result.is_err(), "Non-owner should not be able to deposit");
}
