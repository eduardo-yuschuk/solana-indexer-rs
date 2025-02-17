// use as reference: js_src/src/fetching/block-indexer.ts

// enable unused vars
#![allow(unused)]

use flate2::read::GzDecoder;
use postgres::Client;
use serde_json;
use std::collections::HashMap;
use std::io::Read;
use std::time::Instant;

mod moonshot;
use moonshot::MoonshotParser;

mod blockchain_data;
// use blockchain_data::*;

fn main() {
    let mut client = Client::connect(
        "postgres://postgres:postgres@localhost:5432/indexer",
        postgres::NoTls,
    )
    .unwrap();

    loop {
        let query = "SELECT slot, compressed_json FROM block_json where indexed IS NULL ORDER BY slot LIMIT 10;";
        let result = client.query(query, &[]);

        if result.is_err() {
            println!("Error querying blocks: {:?}", result.err());
            continue;
        }

        let rows = result.unwrap();

        for row in rows {
            let begin = Instant::now();

            let slot: i32 = row.get("slot");
            let compressed_json: Vec<u8> = row.get("compressed_json");

            let mut decoder = GzDecoder::new(&compressed_json[..]);
            let mut decompressed_data = Vec::new();
            decoder.read_to_end(&mut decompressed_data).unwrap();

            let data_obj: serde_json::Value = serde_json::from_slice(&decompressed_data).unwrap();

            let block_time = data_obj.get("blockTime").unwrap();
            let block_time = block_time.as_i64().unwrap();

            println!("Slot: {:?}", slot);
            println!("Block time: {:?}", block_time);

            let events = parse_block(slot, &data_obj);

            let parse_time = begin.elapsed();
            println!("Parse time: {:?}", parse_time);

            let save_begin = Instant::now();

            let (_rows_count, events_by_source_and_type) = save_events(&events);

            let _report = build_events_report(&events_by_source_and_type);

            let save_time = save_begin.elapsed();
            println!("Save time: {:?}", save_time);

            let total_time = begin.elapsed();
            println!("Total time: {:?}", total_time);

            //let query = "UPDATE block_json SET indexed = TRUE WHERE slot = $1;";
            //client.execute(query, &[&slot]).unwrap();
        }
    }
}

#[derive(Debug, Clone)]
struct Event {}

fn parse_block(slot: i32, data_obj: &serde_json::Value) -> Vec<Event> {
    let mut events: Vec<Event> = Vec::new();

    let block_height = data_obj.get("blockHeight").unwrap().as_i64().unwrap();
    let block_time = data_obj.get("blockTime").unwrap().as_i64().unwrap();
    let block_hash = data_obj.get("blockhash").unwrap().as_str().unwrap();
    let parent_slot = data_obj.get("parentSlot").unwrap().as_i64().unwrap() as i32;
    let previous_block_hash = data_obj.get("previousBlockhash").unwrap().as_str().unwrap();

    println!("block_height: {:?}", block_height);
    println!("block_time: {:?}", block_time);
    println!("block_hash: {:?}", block_hash);
    println!("parent_slot: {:?}", parent_slot);
    println!("previous_block_hash: {:?}", previous_block_hash);

    let transactions = data_obj.get("transactions").unwrap();

    for transaction_obj in transactions.as_array().unwrap() {
        let meta = transaction_obj.get("meta").unwrap();
        let compute_units_consumed = meta.get("computeUnitsConsumed").unwrap().as_i64().unwrap();
        let err = meta.get("err").unwrap();
        let fee = meta.get("fee").unwrap().as_i64().unwrap();
        let inner_instructions = meta.get("innerInstructions").unwrap();
        let loaded_addresses = meta.get("loadedAddresses").unwrap();
        let log_messages = meta.get("logMessages").unwrap();
        let post_balances = meta.get("postBalances").unwrap();
        let pre_balances = meta.get("preBalances").unwrap();
        let post_token_balances = meta.get("postTokenBalances").unwrap();
        let pre_token_balances = meta.get("preTokenBalances").unwrap();
        let rewards = meta.get("rewards").unwrap();
        let status = meta.get("status").unwrap();

        let transaction: &serde_json::Map<String, serde_json::Value> =
            transaction_obj.as_object().unwrap();
        
        parse_transaction(slot, block_time, transaction)
            .iter()
            .for_each(|event| events.push(event.clone()));
    }

    events
}

// trait Parser {
//     fn parse_instruction(&self, data_obj: &serde_json::Value) -> Vec<Event>;
//     fn parse_transaction(&self, data_obj: &serde_json::Value) -> Vec<Event>;
// }

fn parse_transaction(
    slot: i32,
    block_time: i64,
    transaction_obj: &serde_json::Map<String, serde_json::Value>,
) -> Vec<Event> {
    let mut events = Vec::new();
    let moonshot_parser = MoonshotParser::new();

    let transaction = transaction_obj.get("transaction").unwrap();
    let instructions = transaction
        .get("message")
        .and_then(|msg| msg.get("instructions"))
        .and_then(|instructions| instructions.as_array());

    if let Some(instructions) = instructions {
        for instruction in instructions {
            let mut moonshot_events = moonshot_parser.parse_instruction(instruction);
            events.append(&mut moonshot_events);
        }
    }

    events
}

fn save_events(_events: &Vec<Event>) -> (i32, HashMap<String, Vec<Event>>) {
    let events_by_source_and_type = HashMap::new();
    (0, events_by_source_and_type)
}

fn build_events_report(_events_by_source_and_type: &HashMap<String, Vec<Event>>) -> String {
    let report = String::new();
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::BufReader;
    
    #[test]
    fn test_parse_transaction() {
        // read tx.json
        let file = File::open("data/moon_tx.json").unwrap();
        let reader = BufReader::new(file);
        let data_obj: serde_json::Value = serde_json::from_reader(reader).unwrap();

        let events = parse_transaction(1, 1739711240, &data_obj);
        println!("events: {:?}", events);
    }    
}
