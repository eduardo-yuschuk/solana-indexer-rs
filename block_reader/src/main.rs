use dotenv::dotenv;
use futures_util::StreamExt;
use solana_client::{
    nonblocking::pubsub_client::PubsubClient,
    rpc_config::{RpcBlockSubscribeConfig, RpcBlockSubscribeFilter},
};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_transaction_status_client_types::{
    EncodedTransaction, EncodedTransactionWithStatusMeta, TransactionDetails, UiMessage,
    UiParsedMessage, UiRawMessage, UiTransaction, UiTransactionEncoding, UiTransactionStatusMeta,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let wss_url = std::env::var("WSS_URL").expect("WSS_URL must be set.");
    let ps_client = PubsubClient::new(&wss_url).await?;

    let (mut block_updates, unsubscriber) = ps_client
        .block_subscribe(
            RpcBlockSubscribeFilter::All,
            Some(RpcBlockSubscribeConfig {
                commitment: Some(CommitmentConfig::confirmed()),
                encoding: Some(UiTransactionEncoding::Json),
                transaction_details: Some(TransactionDetails::Full),
                show_rewards: Some(false),
                max_supported_transaction_version: Some(0),
                ..Default::default()
            }),
        )
        .await?;

    while let Some(response) = block_updates.next().await {
        println!("Slot: {}", response.context.slot);
        let block = response.value.block.unwrap();
        let transactions = block.transactions.unwrap();
        for transaction in transactions {
            let EncodedTransactionWithStatusMeta {
                transaction,
                meta,
                version: _,
            } = transaction;
            let addresses = match transaction {
                EncodedTransaction::Json(ui_tx) => {
                    // println!("Json: {:?}", ui_tx);
                    let UiTransaction {
                        signatures,
                        message,
                    } = ui_tx;
                    let mut addresses: Vec<String> = Vec::new();
                    match message {
                        UiMessage::Parsed(ui_parsed_message) => {
                            let UiParsedMessage {
                                account_keys,
                                recent_blockhash: _,
                                instructions: _,
                                address_table_lookups: _,
                            } = ui_parsed_message;
                            for account_key in account_keys {
                                addresses.push(account_key.pubkey);
                            }
                        }
                        UiMessage::Raw(ui_raw_message) => {
                            let UiRawMessage {
                                header: _,
                                account_keys,
                                recent_blockhash: _,
                                instructions: _,
                                address_table_lookups: _,
                            } = ui_raw_message;
                            for account_key in account_keys {
                                addresses.push(account_key);
                            }
                        }
                    };
                    addresses
                }
                _ => {
                    panic!("Unssuported transaction type");
                }
            };
            let invoked_program_address = addresses.first().unwrap();
        }
        match response.value.block {
            Some(block) => {
                match block.transactions {
                    Some(txs) => {
                        for tx in txs {
                            let EncodedTransactionWithStatusMeta {
                                transaction,
                                meta,
                                version: _,
                            } = tx;
                            
                            
                            match meta {
                                Some(meta) => {
                                    let UiTransactionStatusMeta {
                                        err,
                                        status,
                                        fee,
                                        pre_balances,
                                        post_balances,
                                        inner_instructions,
                                        log_messages,
                                        pre_token_balances,
                                        post_token_balances,
                                        rewards,
                                        loaded_addresses,
                                        return_data,
                                        compute_units_consumed,
                                    } = meta;
                                }
                                None => {
                                    println!("No meta found!");
                                }
                            }
                        }
                    }
                    None => {
                        println!("No transactions found!");
                    }
                }
            }
            None => {
                println!("No block found!");
            }
        };
    }

    unsubscriber().await;

    Ok(())
}
