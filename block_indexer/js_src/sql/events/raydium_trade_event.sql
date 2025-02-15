DROP TABLE IF EXISTS public.raydium_trade_event;
CREATE TABLE public.raydium_trade_event (
    event_id BYTEA UNIQUE,
    amm VARCHAR(44) NOT NULL,
    amount_in NUMERIC(20, 0) NOT NULL,
    minimum_out NUMERIC(20, 0) NOT NULL,
    direction BIGINT NOT NULL,
    user_source NUMERIC(20, 0) NOT NULL,
    pool_coin NUMERIC(20, 0) NOT NULL,
    pool_pc NUMERIC(20, 0) NOT NULL,
    out_amount NUMERIC(20, 0) NOT NULL,
    slot BIGINT NOT NULL,
    signature VARCHAR(128) NOT NULL,
    created BIGINT NOT NULL
);
ALTER TABLE IF EXISTS public.raydium_trade_event OWNER to postgres;