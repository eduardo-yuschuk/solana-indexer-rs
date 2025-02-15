DROP TABLE IF EXISTS public.trades;

CREATE TABLE IF NOT EXISTS public.trades
(
    user_id INT NOT NULL,
    mint_id INT NOT NULL,
    slot bigint NOT NULL,
    transaction_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    token_amount numeric(30,0)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.trades
    OWNER to app_indexer;

GRANT ALL ON TABLE public.trades TO app_backend;

GRANT ALL ON TABLE public.trades TO app_indexer;

-- index by user_id, mint_id
CREATE INDEX IF NOT EXISTS idx_trades_user_id_mint_id_slot ON public.trades (user_id, mint_id);
