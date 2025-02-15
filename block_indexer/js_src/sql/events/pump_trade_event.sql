DROP TABLE IF EXISTS public.pump_trade_event;
CREATE TABLE public.pump_trade_event (
    event_id BYTEA PRIMARY KEY,
    mint VARCHAR(44) NOT NULL,
    sol_amount NUMERIC(20, 0) NOT NULL,
    token_amount NUMERIC(25, 0) NOT NULL,
    is_buy BOOLEAN NOT NULL,
    user_public_key VARCHAR(44) NOT NULL,
    timestamp BIGINT NOT NULL,
    virtual_sol_reserves NUMERIC(20, 0) NOT NULL,
    virtual_token_reserves NUMERIC(25, 0) NOT NULL,
    real_sol_reserves NUMERIC(20, 0) NOT NULL,
    real_token_reserves NUMERIC(25, 0) NOT NULL,
    slot BIGINT NOT NULL,
    signature VARCHAR(128) NOT NULL,
    created BIGINT NOT NULL
);
ALTER TABLE IF EXISTS public.pump_trade_event OWNER to postgres;