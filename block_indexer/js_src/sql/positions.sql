-- TODO: Remove this table and use wallet_positions instead

DROP TABLE IF EXISTS public.positions;

CREATE TABLE positions (
    user_wallet VARCHAR(44) NOT NULL,
    token_mint VARCHAR(44) NOT NULL,
    token_received NUMERIC(38, 0) DEFAULT 0,
    sol_received NUMERIC(38, 0) DEFAULT 0,
    token_sent NUMERIC(38, 0) DEFAULT 0,
    sol_sent NUMERIC(38, 0) DEFAULT 0,
    net_position NUMERIC(38, 10) DEFAULT 0,
    cost_basis NUMERIC(38, 10) DEFAULT 0,
    realized_pnl NUMERIC(38, 10) DEFAULT 0,
    unrealized_pnl NUMERIC(38, 10) DEFAULT 0,
    current_price NUMERIC(38, 10) DEFAULT 0,
    last_buy bigint DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_wallet, token_mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.positions
    OWNER to app_indexer;   

GRANT ALL ON TABLE public.positions TO app_backend;

GRANT ALL ON TABLE public.positions TO app_indexer;

-- Index: positions_last_buy_idx

-- DROP INDEX IF EXISTS public.positions_last_buy_idx;

CREATE INDEX IF NOT EXISTS positions_last_buy_idx
    ON public.positions USING btree
    (last_buy ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: positions_token_mint_idx

-- DROP INDEX IF EXISTS public.positions_token_mint_idx;

CREATE INDEX IF NOT EXISTS positions_token_mint_idx
    ON public.positions USING btree
    (token_mint COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: positions_user_wallet_idx

-- DROP INDEX IF EXISTS public.positions_user_wallet_idx;

CREATE INDEX IF NOT EXISTS positions_user_wallet_idx
    ON public.positions USING btree
    (user_wallet COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;