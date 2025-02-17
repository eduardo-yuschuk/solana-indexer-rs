use crate::Event;
use serde_json::Value;
use solana_sdk::bs58;
use num_bigint::BigUint;
pub struct MoonshotParser;

impl MoonshotParser {
    pub fn new() -> Self {
        MoonshotParser
    }

    pub fn parse_instruction(&self, instruction: &Value) -> Vec<Event> {
        let _events = Vec::new();

        // Aquí iría la lógica para parsear instrucciones específicas de Moonshot
        // Por ahora retornamos un vector vacío

        let instruction_data = instruction.get("data").unwrap();
        let instruction_data_str = instruction_data.as_str().unwrap();
        let instruction_data_bytes = bs58::decode(instruction_data_str).into_vec().unwrap();

        let decoded_instruction = decode_instruction_data(&instruction_data_bytes);

        match decoded_instruction {
            MoonshotInstructionData::Trade(_trade) => {
                // TODO: Implement buy event
            }
            MoonshotInstructionData::TokenMint(_token_mint) => {
                // TODO: Implement sell event
            }
            MoonshotInstructionData::Unknown => {
                // TODO: Implement unknown event
            }
        }

        _events
    }
}

enum MoonshotInstructionDiscriminator {
    Buy,
    Sell,
    TokenMint,
    Unknown,
}

impl MoonshotInstructionDiscriminator {
    fn from_u64(value: u64) -> Self {
        match value {
            16927863322537952870 => MoonshotInstructionDiscriminator::Buy,
            12502976635542562355 => MoonshotInstructionDiscriminator::Sell,
            12967285527113116675 => MoonshotInstructionDiscriminator::TokenMint,
            _ => MoonshotInstructionDiscriminator::Unknown,
        }
    }
}

enum MoonshotInstructionData {
    Trade(MoonshotTradeValues),
    TokenMint(MoonshotTokenMintValues),
    Unknown,
}

pub struct MoonshotTradeValues {
    pub token_amount: u64,
    pub collateral_amount: u64,
    pub fixed_side: u8,
    pub slippage_bps: u64,
}

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

fn u64_bytes_to_big_int(bytes: &[u8], offset: usize) -> BigUint {
    let mut value = BigUint::ZERO;
    value = value | BigUint::from(bytes[offset + 7]) << 56;
    value = value | BigUint::from(bytes[offset + 6]) << 48;
    value = value | BigUint::from(bytes[offset + 5]) << 40;
    value = value | BigUint::from(bytes[offset + 4]) << 32;
    value = value | BigUint::from(bytes[offset + 3]) << 24;
    value = value | BigUint::from(bytes[offset + 2]) << 16;
    value = value | BigUint::from(bytes[offset + 1]) << 8;
    value = value | BigUint::from(bytes[offset + 0]);
    value
}

fn decode_instruction_data(instruction_data: &[u8]) -> MoonshotInstructionData {
    // el primer u64 es el discriminador
    let instruction_type = u64_bytes_to_big_int(instruction_data, 0);

    println!("instruction_type: {}", instruction_type);

    // match MoonshotInstructionDiscriminator::from_u64(instruction_type) {
    //     MoonshotInstructionDiscriminator::Buy => {
    //         let decoded_trade = decode_trade(instruction_data);
    //         MoonshotInstructionData::Trade(decoded_trade)
    //     }
    //     MoonshotInstructionDiscriminator::Sell => {
    //         let decoded_trade = decode_trade(instruction_data);
    //         MoonshotInstructionData::Trade(decoded_trade)
    //     }
    //     MoonshotInstructionDiscriminator::TokenMint => {
    //         let decoded_token_mint = decode_token_mint(instruction_data);
    //         MoonshotInstructionData::TokenMint(decoded_token_mint)
    //     }
    //     MoonshotInstructionDiscriminator::Unknown => todo!(),
    // }

    MoonshotInstructionData::Unknown
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
    let name = String::from_utf8(instruction_data[8..].to_vec()).unwrap();
    let symbol = String::from_utf8(instruction_data[16..].to_vec()).unwrap();
    let uri = String::from_utf8(instruction_data[24..].to_vec()).unwrap();
    let decimals = u8::from_le_bytes(instruction_data[32..33].try_into().unwrap());
    let collateral_currency = u8::from_le_bytes(instruction_data[33..34].try_into().unwrap());
    let amount = u64::from_le_bytes(instruction_data[34..42].try_into().unwrap());
    let curve_type = u8::from_le_bytes(instruction_data[42..43].try_into().unwrap());
    let migration_target = u8::from_le_bytes(instruction_data[43..44].try_into().unwrap());

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
