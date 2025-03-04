use crate::{
    Event, FunctionCallEvent, FunctionCallEventMeta, FunctionCallInstructionData, GenericEventType,
    IndexerEventSource,
};
use num_bigint::BigUint;
use serde_json::Value;
use std::str::FromStr;

use super::{
    get_address_as_string, get_sol_balances, get_token_balances, MoonshotInstructionData,
    MoonshotTokenMintFunctionCallEventMeta, MoonshotTradeFunctionCallEventMeta,
};

pub fn process_trade_instruction(
    transaction_obj: &serde_json::Map<String, serde_json::Value>,
    instruction: &Value,
    addresses: &Vec<String>,
    block_time: u64,
    decoded_instruction: MoonshotInstructionData,
) -> Event {
    let meta = transaction_obj.get("meta").unwrap().as_object().unwrap();
    let failed_transaction = meta.get("err").unwrap().is_object();
    let signature = transaction_obj
        .get("transaction")
        .unwrap()
        .get("signatures")
        .unwrap()
        .get(0)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let sender = get_address_as_string(1, addresses, instruction);
    let mint = get_address_as_string(2, addresses, instruction);

    let bonding_curve_token_balances = get_token_balances(meta, 3);
    let bonding_curve_sol_balances = get_sol_balances(meta, 4);

    let bonding_curve_token_post_balance = BigUint::from_str(
        bonding_curve_token_balances.post_balances[0]
            .get("uiTokenAmount")
            .unwrap()
            .get("amount")
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    let bonding_curve_sol_post_balance = BigUint::from_str(
        bonding_curve_sol_balances.post_balances[0]
            .as_str()
            .unwrap(),
    )
    .unwrap();

    Event::FunctionCall(FunctionCallEvent {
        source: IndexerEventSource::Moonshot,
        event_type: GenericEventType::Trade,
        slot: 0,
        signature,
        event_obj: Box::new(decoded_instruction),
        event_meta: Box::new(MoonshotTradeFunctionCallEventMeta {
            block_time,
            sender,
            mint,
            failed_transaction,
            bonding_curve_token_post_balance,
            bonding_curve_sol_post_balance,
        }),
    })
}

pub fn process_token_mint_instruction(
    transaction_obj: &serde_json::Map<String, serde_json::Value>,
    instruction: &Value,
    addresses: &Vec<String>,
    block_time: u64,
    decoded_instruction: MoonshotInstructionData,
) -> Event {
    let meta = transaction_obj.get("meta").unwrap().as_object().unwrap();
    let failed_transaction = meta.get("err").unwrap().is_object();
    let signature = transaction_obj
        .get("transaction")
        .unwrap()
        .get("signatures")
        .unwrap()
        .get(0)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();
    let sender = get_address_as_string(1, addresses, instruction);
    let mint = get_address_as_string(2, addresses, instruction);

    Event::FunctionCall(FunctionCallEvent {
        source: IndexerEventSource::Moonshot,
        event_type: GenericEventType::TokenMint,
        slot: 0,
        signature,
        event_obj: Box::new(decoded_instruction),
        event_meta: Box::new(MoonshotTokenMintFunctionCallEventMeta {
            block_time,
            sender,
            mint,
            failed_transaction,
        }),
    })
}
