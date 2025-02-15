DROP TABLE IF EXISTS public.positions_full;

CREATE TABLE positions_full (
    user_wallet VARCHAR(44) NOT NULL,
    token_mint VARCHAR(44) NOT NULL,
    
    token_received NUMERIC(38, 0) NOT NULL,
    token_sent NUMERIC(38, 0) NOT NULL,
    sol_received NUMERIC(38, 0) NOT NULL,
    sol_sent NUMERIC(38, 0) NOT NULL,

    updated_slot bigint NOT NULL,
    PRIMARY KEY (user_wallet, token_mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.positions_full
    OWNER to app_indexer;   

GRANT ALL ON TABLE public.positions_full TO app_backend;

GRANT ALL ON TABLE public.positions_full TO app_indexer;

CREATE INDEX ON positions_full (user_wallet);
CREATE INDEX ON positions_full (token_mint);

ALTER TABLE public.positions_full ADD COLUMN buy_count INT DEFAULT 0;
ALTER TABLE public.positions_full ADD COLUMN sell_count INT DEFAULT 0;
