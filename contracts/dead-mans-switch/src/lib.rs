#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env};

#[contracttype]
pub enum DataKey {
    Owner,
    Beneficiary,
    TokenId,
    TimeoutDuration,
    Deadline,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PingEvent {
    pub deadline: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimedEvent {
    pub amount: i128,
}

#[contract]
pub struct DeadMansSwitch;

#[contractimpl]
impl DeadMansSwitch {
    pub fn setup_switch(
        env: Env,
        owner: Address,
        beneficiary: Address,
        token_id: Address,
        timeout: u64,
    ) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }
        let deadline = env.ledger().timestamp() + timeout;
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Beneficiary, &beneficiary);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::TimeoutDuration, &timeout);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
    }

    pub fn deposit_funds(env: Env, amount: i128) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token = token::TokenClient::new(&env, &token_id);
        token.transfer(&owner, &env.current_contract_address(), &amount);
    }

    pub fn ping_alive(env: Env) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        let timeout: u64 = env.storage().instance().get(&DataKey::TimeoutDuration).unwrap();
        let deadline = env.ledger().timestamp() + timeout;
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        PingEvent { deadline }.publish(&env);
    }

    pub fn claim_inheritance(env: Env) {
        let beneficiary: Address = env.storage().instance().get(&DataKey::Beneficiary).unwrap();
        beneficiary.require_auth();
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() <= deadline {
            panic!("Owner is still alive");
        }
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token = token::TokenClient::new(&env, &token_id);
        let balance = token.balance(&env.current_contract_address());
        token.transfer(&env.current_contract_address(), &beneficiary, &balance);
        ClaimedEvent { amount: balance }.publish(&env);
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap_or(0)
    }

    pub fn get_contract_balance(env: Env) -> i128 {
        if !env.storage().instance().has(&DataKey::TokenId) {
            return 0;
        }
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token = token::TokenClient::new(&env, &token_id);
        token.balance(&env.current_contract_address())
    }

    pub fn get_switch_status(env: Env) -> u64 {
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap_or(0);
        if deadline == 0 {
            return 0;
        }
        let now = env.ledger().timestamp();
        if now >= deadline {
            0
        } else {
            deadline - now
        }
    }
}

mod test;
