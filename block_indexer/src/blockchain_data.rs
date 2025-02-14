use dotenv::dotenv;
use solana_client::rpc_client::RpcClient;
use solana_sdk::signature::Signature;
use solana_transaction_status_client_types::{
    EncodedConfirmedTransactionWithStatusMeta, UiTransactionEncoding,
};
use std::error::Error;
use std::str::FromStr;

pub fn _read_transaction(
    transaction_id: &str,
) -> Result<EncodedConfirmedTransactionWithStatusMeta, Box<dyn Error>> {
    dotenv().ok();

    let rpc_url = std::env::var("RPC_URL").expect("RPC_URL must be set.");

    let client = RpcClient::new(rpc_url);
    let transaction = client
        .get_transaction(
            &Signature::from_str(transaction_id).unwrap(),
            UiTransactionEncoding::Json,
        )
        .unwrap();

    Ok(transaction)
}
