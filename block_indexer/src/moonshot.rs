use crate::Event;
use serde_json::Value;

pub struct MoonshotParser;

impl MoonshotParser {
    pub fn new() -> Self {
        MoonshotParser
    }

    pub fn parse_instruction(&self, _instruction: &Value) -> Vec<Event> {
        let _events = Vec::new();

        // Aquí iría la lógica para parsear instrucciones específicas de Moonshot
        // Por ahora retornamos un vector vacío

        _events
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
