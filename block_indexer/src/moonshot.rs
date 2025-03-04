use sha256::digest;
use std::sync::LazyLock;
use std::{collections::HashMap, str::FromStr};

use crate::{
    Event, FunctionCallEvent, FunctionCallEventMeta, FunctionCallInstructionData, GenericEventType,
    IndexerEventSource,
};
use num_bigint::BigUint;
use num_traits::Num;
use serde_json::Value;
use solana_sdk::bs58;

mod instruction;
use instruction::process_token_mint_instruction;
use instruction::process_trade_instruction;

pub struct MoonshotParser;

pub struct MoonshotTradeFunctionCallEventMeta {
    pub block_time: u64,
    pub sender: String,
    pub mint: String,
    pub failed_transaction: bool,
    pub bonding_curve_token_post_balance: BigUint,
    pub bonding_curve_sol_post_balance: BigUint,
}

impl FunctionCallEventMeta for MoonshotTradeFunctionCallEventMeta {}

pub struct MoonshotTokenMintFunctionCallEventMeta {
    pub block_time: u64,
    pub sender: String,
    pub mint: String,
    pub failed_transaction: bool,
}

impl FunctionCallEventMeta for MoonshotTokenMintFunctionCallEventMeta {}

impl MoonshotParser {
    pub fn new() -> Self {
        MoonshotParser
    }

    pub fn parse_instruction(
        &self,
        transaction_obj: &serde_json::Map<String, serde_json::Value>,
        instruction: &Value,
        addresses: &Vec<String>,
        block_time: u64,
    ) -> Vec<Event> {
        let mut events: Vec<Event> = Vec::new();

        // Aquí iría la lógica para parsear instrucciones específicas de Moonshot
        // Por ahora retornamos un vector vacío
        println!("instruction: {:?}", instruction);
        let instruction_data = instruction.get("data").unwrap();
        println!("instruction_data: {:?}", instruction_data);
        let instruction_data_str = instruction_data.as_str().unwrap();
        let instruction_data_bytes = bs58::decode(instruction_data_str).into_vec().unwrap();

        let program_id_index = instruction.get("programIdIndex").unwrap().as_u64().unwrap();
        let program_id = addresses.get(program_id_index as usize).unwrap();

        println!("program_id: {}", program_id);

        if (program_id != "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG") {
            return events;
        }

        let decoded_instruction = decode_instruction_data(&instruction_data_bytes);
        let decoded_instruction_clone = decoded_instruction.clone();

        match decoded_instruction {
            MoonshotInstructionData::Trade(_trade) => {
                let function_call_event = process_trade_instruction(
                    transaction_obj,
                    instruction,
                    addresses,
                    block_time,
                    decoded_instruction.clone(),
                );
                events.push(function_call_event);
            }
            MoonshotInstructionData::TokenMint(_token_mint) => {
                let function_call_event = process_token_mint_instruction(
                    transaction_obj,
                    instruction,
                    addresses,
                    block_time,
                    decoded_instruction_clone,
                );
                events.push(function_call_event);
            }
            MoonshotInstructionData::MigrateFunds(_migrate_funds) => {}
            MoonshotInstructionData::ConfigInit(_config_init) => {}
            MoonshotInstructionData::ConfigUpdate(_config_update) => {}
            MoonshotInstructionData::Unknown => {
                // TODO: Implement unknown event
            }
        }

        events
    }
}

fn get_address_index(index: u64, instruction: &Value) -> u64 {
    match instruction.get("accounts") {
        Some(accounts) => {
            let accounts_as_array = accounts.as_array().unwrap();
            let account = accounts_as_array.get(index as usize).unwrap();
            let account_index = account.as_u64().unwrap();
            //let account_index = account_str.parse::<u64>().unwrap();
            account_index
        }
        None => instruction
            .get("accountKeyIndexes")
            .unwrap()
            .get(index as usize)
            .unwrap()
            .as_str()
            .unwrap()
            .parse::<u64>()
            .unwrap(),
    }
}

struct TokenBalances {
    pre_balances: Vec<serde_json::Value>,
    post_balances: Vec<serde_json::Value>,
}

fn get_token_balances(
    meta: &serde_json::Map<String, serde_json::Value>,
    account_id: u64,
) -> TokenBalances {
    let pre_balances: Vec<serde_json::Value> = meta
        .get("preTokenBalances")
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .filter(|balance| balance.get("accountIndex").unwrap().as_u64().unwrap() == account_id)
        .map(|balance| balance.clone())
        .collect();
    let post_balances: Vec<Value> = meta
        .get("postTokenBalances")
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .filter(|balance| balance.get("accountIndex").unwrap().as_u64().unwrap() == account_id)
        .map(|balance| balance.clone())
        .collect();
    TokenBalances {
        pre_balances,
        post_balances,
    }
}

fn get_sol_balances(
    meta: &serde_json::Map<String, serde_json::Value>,
    account_id: u64,
) -> TokenBalances {
    let pre_balance = meta
        .get("preBalances")
        .unwrap()
        .get(account_id as usize)
        .unwrap();
    println!("pre_balance: {}", pre_balance);
    let post_balance = meta
        .get("postBalances")
        .unwrap()
        .get(account_id as usize)
        .unwrap();
    println!("post_balance: {}", post_balance);
    TokenBalances {
        pre_balances: vec![pre_balance.clone()],
        post_balances: vec![post_balance.clone()],
    }
}

fn get_address_as_string(index: u64, addresses: &Vec<String>, instruction: &Value) -> String {
    let address_index = get_address_index(index, instruction);
    addresses.get(address_index as usize).unwrap().to_string()
}

enum MoonshotInstructionDiscriminator {
    Buy,
    Sell,
    TokenMint,
    MigrateFunds,
    ConfigInit,
    ConfigUpdate,
    Unknown,
}

fn get_discriminator(discriminator: &str) -> BigUint {
    let digest_result = digest(discriminator.as_bytes());
    let digest_big_uint = BigUint::from_str_radix(&digest_result, 16).unwrap();
    let digest_bytes = digest_big_uint.to_bytes_be();
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&digest_bytes[0..8]);
    BigUint::from_bytes_le(&bytes)
}

static MOONSHOT_BUY_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:buy"));
static MOONSHOT_SELL_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:sell"));
static MOONSHOT_TOKEN_MINT_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:token_mint"));
static MOONSHOT_MIGRATE_FUNDS_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:migrate_funds"));
static MOONSHOT_CONFIG_INIT_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:config_init"));
static MOONSHOT_CONFIG_UPDATE_INSTRUCTION_DISCRIMINATOR: LazyLock<BigUint> =
    LazyLock::new(|| get_discriminator("global:config_update"));

impl MoonshotInstructionDiscriminator {
    fn from_big_uint(value: BigUint) -> Self {
        if value == *MOONSHOT_BUY_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::Buy
        } else if value == *MOONSHOT_SELL_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::Sell
        } else if value == *MOONSHOT_TOKEN_MINT_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::TokenMint
        } else if value == *MOONSHOT_MIGRATE_FUNDS_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::MigrateFunds
        } else if value == *MOONSHOT_CONFIG_INIT_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::ConfigInit
        } else if value == *MOONSHOT_CONFIG_UPDATE_INSTRUCTION_DISCRIMINATOR {
            MoonshotInstructionDiscriminator::ConfigUpdate
        } else {
            MoonshotInstructionDiscriminator::Unknown
        }
    }
}

#[derive(Debug, Clone)]
pub struct MoonshotTokenMintValues {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub collateral_currency: u8,
    pub amount: u64,
    pub curve_type: u8,
    pub migration_target: u8,
}

#[derive(Debug, Clone)]
pub struct MoonshotMigrateFundsValues {}

#[derive(Debug, Clone)]
pub struct MoonshotConfigInitValues {}

#[derive(Debug, Clone)]
pub struct MoonshotConfigUpdateValues {}

#[derive(Debug, Clone)]
enum MoonshotInstructionData {
    Trade(MoonshotTradeValues),
    TokenMint(MoonshotTokenMintValues),
    MigrateFunds(MoonshotMigrateFundsValues),
    ConfigInit(MoonshotConfigInitValues),
    ConfigUpdate(MoonshotConfigUpdateValues),
    Unknown,
}

impl FunctionCallInstructionData for MoonshotInstructionData {}

#[derive(Debug, Clone, Copy)]
pub struct MoonshotTradeValues {
    pub token_amount: u64,
    pub collateral_amount: u64,
    pub fixed_side: u8,
    pub slippage_bps: u64,
}

fn decode_instruction_data(instruction_data: &[u8]) -> MoonshotInstructionData {
    // el primer u64 es el discriminador
    //let instruction_type = u64_bytes_to_big_int(instruction_data, 0);

    println!("instruction_data: {:?}", &instruction_data[0..8]);

    let instruction_type = BigUint::from_bytes_le(&instruction_data[0..8]);

    let instruction_type_string = instruction_type.to_string();
    println!("instruction_type_string: {}", instruction_type_string);

    match MoonshotInstructionDiscriminator::from_big_uint(instruction_type) {
        MoonshotInstructionDiscriminator::Buy => {
            let decoded_trade = decode_trade(instruction_data);
            MoonshotInstructionData::Trade(decoded_trade)
        }
        MoonshotInstructionDiscriminator::Sell => {
            let decoded_trade = decode_trade(instruction_data);
            MoonshotInstructionData::Trade(decoded_trade)
        }
        MoonshotInstructionDiscriminator::TokenMint => {
            let decoded_token_mint = decode_token_mint(instruction_data);
            MoonshotInstructionData::TokenMint(decoded_token_mint)
        }
        MoonshotInstructionDiscriminator::MigrateFunds => {
            let decoded_migrate_funds = decode_migrate_funds(instruction_data);
            MoonshotInstructionData::MigrateFunds(decoded_migrate_funds)
        }
        MoonshotInstructionDiscriminator::ConfigInit => {
            let decoded_config_init = decode_config_init(instruction_data);
            MoonshotInstructionData::ConfigInit(decoded_config_init)
        }
        MoonshotInstructionDiscriminator::ConfigUpdate => {
            let decoded_config_update = decode_config_update(instruction_data);
            MoonshotInstructionData::ConfigUpdate(decoded_config_update)
        }
        MoonshotInstructionDiscriminator::Unknown => todo!(),
    }
}

fn decode_trade(instruction_data: &[u8]) -> MoonshotTradeValues {
    let token_amount = u64::from_le_bytes(instruction_data[8..16].try_into().unwrap());
    let collateral_amount = u64::from_le_bytes(instruction_data[16..24].try_into().unwrap());
    let fixed_side = u8::from_le_bytes(instruction_data[24..25].try_into().unwrap());
    let slippage_bps = u64::from_le_bytes(instruction_data[25..33].try_into().unwrap());

    MoonshotTradeValues {
        token_amount,
        collateral_amount,
        fixed_side,
        slippage_bps,
    }
}

fn decode_token_mint(instruction_data: &[u8]) -> MoonshotTokenMintValues {
    let mut instruction_data_mut = instruction_data;
    let _discriminator: u64 =
        borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let name = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let symbol = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let uri = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let decimals = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let collateral_currency =
        borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let amount = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let curve_type = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();
    let migration_target = borsh::BorshDeserialize::deserialize(&mut instruction_data_mut).unwrap();

    // let name = String::from_utf8(instruction_data[8..].to_vec()).unwrap();
    // let symbol = String::from_utf8(instruction_data[16..].to_vec()).unwrap();
    // let uri = String::from_utf8(instruction_data[24..].to_vec()).unwrap();
    // let decimals = u8::from_le_bytes(instruction_data[32..33].try_into().unwrap());
    // let collateral_currency = u8::from_le_bytes(instruction_data[33..34].try_into().unwrap());
    // let amount = u64::from_le_bytes(instruction_data[34..42].try_into().unwrap());
    // let curve_type = u8::from_le_bytes(instruction_data[42..43].try_into().unwrap());
    // let migration_target = u8::from_le_bytes(instruction_data[43..44].try_into().unwrap());

    MoonshotTokenMintValues {
        name,
        symbol,
        uri,
        decimals,
        collateral_currency,
        amount,
        curve_type,
        migration_target,
    }
}

fn decode_migrate_funds(instruction_data: &[u8]) -> MoonshotMigrateFundsValues {
    MoonshotMigrateFundsValues {}
}

fn decode_config_init(instruction_data: &[u8]) -> MoonshotConfigInitValues {
    MoonshotConfigInitValues {}
}

fn decode_config_update(instruction_data: &[u8]) -> MoonshotConfigUpdateValues {
    MoonshotConfigUpdateValues {}
}

#[cfg(test)]
mod tests {
    use super::*;
    use dotenv::dotenv;
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::signature::Signature;
    use solana_transaction_status_client_types::UiTransactionEncoding;
    use std::str::FromStr;

    #[tokio::test]
    async fn test_parse_instruction() {
        let _parser = MoonshotParser::new();

        // Leemos una transacción de prueba
        // let _transaction =
        //     read_transaction("2F9YXqCCkWqgc6LXLRgpkYTi3Vt3CypMo8KUnbST1HMZaA1MuQkQXeydYfsVSWokpya7trDFKZQgFzpv5V93QCWz")
        //     .unwrap();

        dotenv().ok();

        let rpc_url = std::env::var("RPC_URL").expect("RPC_URL must be set.");

        let client = RpcClient::new(rpc_url);

        let transaction_id = "2F9YXqCCkWqgc6LXLRgpkYTi3Vt3CypMo8KUnbST1HMZaA1MuQkQXeydYfsVSWokpya7trDFKZQgFzpv5V93QCWz";

        let transaction = client
            .get_transaction(
                &Signature::from_str(transaction_id).unwrap(),
                UiTransactionEncoding::Json,
            )
            .unwrap();

        println!("{:?}", transaction);

        // let events = parser.parse_instruction(&transaction.transaction.transaction);

        // assert!(events.is_empty());
    }
}
