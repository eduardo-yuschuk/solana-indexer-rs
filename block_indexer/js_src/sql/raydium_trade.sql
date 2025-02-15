DROP TABLE IF EXISTS public.raydium_trade;

CREATE TABLE IF NOT EXISTS public.raydium_trade
(
    signer character varying(44) COLLATE pg_catalog."default" NOT NULL,
    amm character varying(44) COLLATE pg_catalog."default" NOT NULL,
    transaction_id VARCHAR(128) NOT NULL,
    log_type VARCHAR(20) NOT NULL,
    amount_in NUMERIC(20, 0) NOT NULL,
    minimum_out NUMERIC(20, 0) NOT NULL,
    direction BIGINT NOT NULL,
    user_source NUMERIC(20, 0) NOT NULL,
    pool_coin NUMERIC(20, 0) NOT NULL,
    pool_pc NUMERIC(20, 0) NOT NULL,
    out_amount NUMERIC(20, 0) NOT NULL,
    created INT NOT NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.raydium_trade
    OWNER to app_indexer;

GRANT ALL ON TABLE public.raydium_trade TO app_backend;

GRANT ALL ON TABLE public.raydium_trade TO app_indexer;

GRANT ALL ON TABLE public.raydium_trade TO dev;

ALTER TABLE IF EXISTS public.raydium_trade ADD COLUMN IF NOT EXISTS deduct_in NUMERIC(20, 0);
ALTER TABLE IF EXISTS public.raydium_trade ADD COLUMN IF NOT EXISTS amount_out NUMERIC(20, 0);

ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN amount_in DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN out_amount DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN minimum_out DROP NOT NULL;

ALTER TABLE IF EXISTS public.raydium_trade ADD COLUMN IF NOT EXISTS failed_transaction BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN direction DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN user_source DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN pool_coin DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN pool_pc DROP NOT NULL;
ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN out_amount DROP NOT NULL;

ALTER TABLE IF EXISTS public.raydium_trade ADD COLUMN IF NOT EXISTS max_in NUMERIC(20, 0);

CREATE INDEX IF NOT EXISTS raydium_trade_signer_idx ON public.raydium_trade (signer);
CREATE INDEX IF NOT EXISTS raydium_trade_created_idx ON public.raydium_trade (created);

ALTER TABLE IF EXISTS public.raydium_trade ALTER COLUMN direction TYPE SMALLINT USING direction::SMALLINT;

CREATE INDEX IF NOT EXISTS raydium_trade_log_type_idx ON public.raydium_trade (log_type);
CREATE INDEX IF NOT EXISTS raydium_trade_direction_idx ON public.raydium_trade (direction);
