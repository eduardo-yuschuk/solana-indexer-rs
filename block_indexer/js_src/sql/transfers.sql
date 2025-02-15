-- This table stores the token and SOL transfers made by our users' wallets

DROP TABLE IF EXISTS public.transfers;

CREATE TABLE IF NOT EXISTS public.transfers
(
    from_address character varying(44) COLLATE pg_catalog."default",
    from_token_account character varying(44) COLLATE pg_catalog."default", 
    to_address character varying(44) COLLATE pg_catalog."default",
    to_token_account character varying(44) COLLATE pg_catalog."default",
    mint character varying(44) COLLATE pg_catalog."default",
    decimals INT,
    amount numeric(30,0),
    created INT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.transfers
    OWNER to app_indexer;

GRANT ALL ON TABLE public.transfers TO app_backend;

GRANT ALL ON TABLE public.transfers TO app_indexer;

CREATE INDEX IF NOT EXISTS idx_transfers_from_address ON public.transfers USING btree (from_address DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_to_address ON public.transfers USING btree (to_address DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_mint ON public.transfers USING btree (mint DESC);

ALTER TABLE IF EXISTS public.transfers ADD COLUMN IF NOT EXISTS slot INT;
ALTER TABLE IF EXISTS public.transfers ADD COLUMN IF NOT EXISTS transaction_id character varying(255) COLLATE pg_catalog."default";

ALTER TABLE IF EXISTS public.transfers ADD COLUMN IF NOT EXISTS failed_transaction BOOLEAN NOT NULL DEFAULT FALSE;
