DROP TABLE IF EXISTS public.positions_full;

CREATE TABLE positions_full (
    user_wallet VARCHAR(44) NOT NULL,
    token_mint VARCHAR(44) NOT NULL,
    
    token_received NUMERIC(38, 0) DEFAULT 0,
    token_sent NUMERIC(38, 0) DEFAULT 0,
    sol_received NUMERIC(38, 0) DEFAULT 0,
    sol_sent NUMERIC(38, 0) DEFAULT 0,

    total_received NUMERIC(38, 0) DEFAULT 0,
    total_sent NUMERIC(38, 0) DEFAULT 0,
    net_position NUMERIC(38, 0) DEFAULT 0,
    cost_basis NUMERIC(38, 0) DEFAULT 0,
    realized_pnl NUMERIC(38, 0) DEFAULT 0,
    last_buy bigint DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_wallet, token_mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.positions_full
    OWNER to app_indexer;   

GRANT ALL ON TABLE public.positions_full TO app_backend;

GRANT ALL ON TABLE public.positions_full TO app_indexer;

CREATE INDEX ON positions_full (user_wallet);
CREATE INDEX ON positions_full (token_mint);
CREATE INDEX ON positions_full (last_buy);
