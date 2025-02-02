// use as reference: js_src/src/fetching/block-indexer.ts

use flate2::read::GzDecoder;
use postgres::Client;
use serde_json;
use std::collections::HashMap;
use std::io::Read;
use std::time::Instant;

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

            let events = parse_block(&data_obj);

            let parse_time = begin.elapsed();
            println!("Parse time: {:?}", parse_time);

            let save_begin = Instant::now();

            let (rows_count, events_by_source_and_type) = save_events(&events);

            let report = build_events_report(&events_by_source_and_type);

            let save_time = save_begin.elapsed();
            println!("Save time: {:?}", save_time);

            let total_time = begin.elapsed();
            println!("Total time: {:?}", total_time);

            let query = "UPDATE block_json SET indexed = TRUE WHERE slot = $1;";
            client.execute(query, &[&slot]).unwrap();
        }
    }
}

struct Event {}

fn parse_block(data_obj: &serde_json::Value) -> Vec<Event> {
    let events = Vec::new();

    let transactions = data_obj.get("transactions").unwrap();

    for transaction in transactions.as_array().unwrap() {
        let transaction_obj = transaction.as_object().unwrap();
        events.push(parse_transaction(&transaction_obj));
    }

    events
}

fn save_events(events: &Vec<Event>) -> (i32, HashMap<String, Vec<Event>>) {
    let mut events_by_source_and_type = HashMap::new();

    (0, events_by_source_and_type)
}

fn build_events_report(events_by_source_and_type: &HashMap<String, Vec<Event>>) -> String {
    let mut report = String::new();

    report
}
