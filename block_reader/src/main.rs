use std::collections::HashSet;

use dotenv::dotenv;
use futures_util::StreamExt;
use solana_client::{
    nonblocking::pubsub_client::PubsubClient,
    rpc_config::{RpcBlockSubscribeConfig, RpcBlockSubscribeFilter},
    rpc_response::{Response, RpcBlockUpdate},
};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_transaction_status_client_types::{
    EncodedTransaction, EncodedTransactionWithStatusMeta, ParsedInstruction, TransactionDetails,
    UiCompiledInstruction, UiInstruction, UiMessage, UiParsedInstruction, UiParsedMessage,
    UiPartiallyDecodedInstruction, UiRawMessage, UiTransaction, UiTransactionEncoding,
    UiTransactionStatusMeta,
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
        parse_block(&response);
    }

    unsubscriber().await;

    Ok(())
}

fn parse_block(response: &Response<RpcBlockUpdate>) -> Option<()> {
    let context = &response.context;
    let value = &response.value;
    let slot = context.slot;
    println!("Slot: {}", slot);
    let block = value.block.as_ref()?;
    let transactions = block.transactions.as_ref()?;

    let mut useful_txs = HashSet::new();

    for (index, transaction) in transactions.iter().enumerate() {
        let EncodedTransactionWithStatusMeta {
            transaction, meta, ..
        } = transaction;
        let addresses = extract_addresses(&transaction);
        let invoked_program_address = addresses.first().unwrap();
        if is_useful(invoked_program_address) {
            println!("Invoked program address: {}", invoked_program_address);
            useful_txs.insert(index);
        }

        let UiTransactionStatusMeta {
            inner_instructions: inner_instructions_opt,
            ..
        } = meta.as_ref()?;

        if inner_instructions_opt.is_none() {
            continue;
        }

        let inner_instructions = inner_instructions_opt.as_ref().unwrap();

        let inner_group_index = inner_instructions
            .iter()
            .position(|group| group.index as usize == index);

        if inner_group_index.is_none() {
            continue;
        }

        let inner_group = inner_instructions.get(inner_group_index.unwrap()).unwrap();

        for (_, inner_instruction) in inner_group.instructions.iter().enumerate() {
            let invoked_program = match inner_instruction {
                UiInstruction::Compiled(ui_compiled_instruction) => {
                    let UiCompiledInstruction {
                        program_id_index, ..
                    } = ui_compiled_instruction;
                    let invoked_program = addresses[*program_id_index as usize].clone();
                    invoked_program
                }
                UiInstruction::Parsed(ui_parsed_instruction) => match ui_parsed_instruction {
                    UiParsedInstruction::Parsed(parsed_instruction) => {
                        let ParsedInstruction { program, .. } = parsed_instruction;
                        program.clone()
                    }
                    UiParsedInstruction::PartiallyDecoded(ui_partially_decoded_instruction) => {
                        let UiPartiallyDecodedInstruction { program_id, .. } =
                            ui_partially_decoded_instruction;
                        program_id.clone()
                    }
                },
                _ => {
                    continue;
                }
            };

            if is_useful(&invoked_program) {
                println!("INNER Invoked program: {}", invoked_program);
                useful_txs.insert(index);
            }
        }
    }
    /*
    match response.value.block {
        Some(block) => match block.transactions {
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
        },
        None => {
            println!("No block found!");
        }
    };
    */
    Some(())
}

const VOTE_PROGRAM_ID: &str = "Vote111111111111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";

fn is_useful(invoked_program_address: &str) -> bool {
    invoked_program_address != VOTE_PROGRAM_ID
        && invoked_program_address != COMPUTE_BUDGET_PROGRAM_ID
}

fn extract_addresses(transaction: &EncodedTransaction) -> Vec<String> {
    match transaction {
        EncodedTransaction::Json(ui_tx) => {
            let UiTransaction {
                signatures,
                message,
            } = ui_tx;
            let mut addresses: Vec<String> = Vec::new();
            match message {
                UiMessage::Parsed(ui_parsed_message) => {
                    let UiParsedMessage { account_keys, .. } = ui_parsed_message;
                    for account_key in account_keys {
                        addresses.push(account_key.pubkey.to_string());
                    }
                }
                UiMessage::Raw(ui_raw_message) => {
                    let UiRawMessage { account_keys, .. } = ui_raw_message;
                    for account_key in account_keys {
                        addresses.push(account_key.to_string());
                    }
                }
            };
            addresses
        }
        _ => {
            panic!("Unssuported transaction type");
        }
    }
}
