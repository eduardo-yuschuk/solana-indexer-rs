DROP TABLE IF EXISTS public.wallet_positions;

CREATE TABLE wallet_positions (
    wallet VARCHAR(44) NOT NULL,
    token VARCHAR(44) NOT NULL,
    sol_received NUMERIC(38,0) DEFAULT 0,
    sol_sent NUMERIC(38,0) DEFAULT 0,
    token_received NUMERIC(38,0) NOT NULL DEFAULT 0,
    token_sent NUMERIC(38,0) NOT NULL DEFAULT 0,
    token_quantity NUMERIC(38,0) NOT NULL DEFAULT 0,
    average_price NUMERIC(38,10) NOT NULL DEFAULT 0,
    realized_pnl NUMERIC(38,10) NOT NULL DEFAULT 0,
    cost_basis NUMERIC(38,10) NOT NULL DEFAULT 0,
    last_buy bigint NOT NULL,
    PRIMARY KEY (wallet, token)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.wallet_positions
    OWNER to app_indexer;   

GRANT ALL ON TABLE public.wallet_positions TO app_backend;

GRANT ALL ON TABLE public.wallet_positions TO app_indexer;
