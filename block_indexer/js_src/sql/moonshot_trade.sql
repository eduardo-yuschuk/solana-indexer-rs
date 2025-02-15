DROP TABLE IF EXISTS public.moonshot_trade;

CREATE TABLE IF NOT EXISTS public.moonshot_trade
(
    signer character varying(44) COLLATE pg_catalog."default" NOT NULL,
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    transaction_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    allocation numeric(30,0),
    amount numeric(30,0),
    collateral_amount numeric(30,0),
    cost_token character varying(44) COLLATE pg_catalog."default",
    curve character varying(44) COLLATE pg_catalog."default",
    dex_fee numeric(30,0),
    helio_fee numeric(30,0),
    type INT,
    is_buy boolean,
    timestamp INT,
    created INT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.moonshot_trade
    OWNER to app_indexer;

GRANT ALL ON TABLE public.moonshot_trade TO app_backend;

GRANT ALL ON TABLE public.moonshot_trade TO app_indexer;

ALTER TABLE IF EXISTS public.moonshot_trade ADD COLUMN IF NOT EXISTS failed_transaction BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS moonshot_trade_signer_idx ON public.moonshot_trade (signer);
CREATE INDEX IF NOT EXISTS moonshot_trade_created_idx ON public.moonshot_trade (created);
