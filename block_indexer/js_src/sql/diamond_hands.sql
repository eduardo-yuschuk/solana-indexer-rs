DROP TABLE IF EXISTS public.diamond_hands;

CREATE TABLE diamond_hands (
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    wallet character varying(44) COLLATE pg_catalog."default" NOT NULL,
    held_batches JSONB NOT NULL,
    sold_holding_sum NUMERIC NOT NULL,
    total_tokens NUMERIC NOT NULL,
    realized_profit NUMERIC NOT NULL,
    average_holding_time NUMERIC NOT NULL,
    total_profit NUMERIC NOT NULL,
    buy_count NUMERIC NOT NULL,
    sell_count NUMERIC NOT NULL,
    updated bigint NOT NULL,
    PRIMARY KEY (mint, wallet)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.diamond_hands
    OWNER to app_indexer;   

GRANT ALL ON TABLE public.diamond_hands TO app_backend;

GRANT ALL ON TABLE public.diamond_hands TO app_indexer;
