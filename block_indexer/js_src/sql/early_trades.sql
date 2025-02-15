DROP TABLE IF EXISTS public.early_trades;

CREATE TABLE IF NOT EXISTS public.early_trades
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    mint_slot bigint NOT NULL,
    wallet character varying(44) COLLATE pg_catalog."default" NOT NULL,
    transaction_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    token_amount numeric(30,0),
    is_buy boolean,
    trade_slot bigint NOT NULL,
    created INT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.early_trades
    OWNER to app_indexer;

GRANT ALL ON TABLE public.early_trades TO app_backend;

GRANT ALL ON TABLE public.early_trades TO app_indexer;

CREATE INDEX IF NOT EXISTS early_trades_mint_mint_slot_trade_slot_idx ON public.early_trades USING btree (mint ASC, mint_slot ASC, trade_slot ASC);
