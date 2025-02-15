DROP TABLE IF EXISTS public.pump_trade;

CREATE TABLE IF NOT EXISTS public.pump_trade
(
    signer character varying(44) COLLATE pg_catalog."default" NOT NULL,
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    transaction_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    sol_amount numeric(30,0),
    token_amount numeric(30,0),
    is_buy boolean,
    timestamp INT,
    virtual_token_reserves numeric(30,0),
    virtual_sol_reserves numeric(30,0),
    real_token_reserves numeric(30,0),
    real_sol_reserves numeric(30,0),
    created INT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pump_trade
    OWNER to app_indexer;

GRANT ALL ON TABLE public.pump_trade TO app_backend;

GRANT ALL ON TABLE public.pump_trade TO app_indexer;

ALTER TABLE IF EXISTS public.pump_trade ADD COLUMN IF NOT EXISTS failed_transaction BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS pump_trade_signer_idx ON public.pump_trade (signer);
CREATE INDEX IF NOT EXISTS pump_trade_created_idx ON public.pump_trade (created);
