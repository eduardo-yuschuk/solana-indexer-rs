DROP TABLE IF EXISTS public.pump_price_bar;

CREATE TABLE IF NOT EXISTS public.pump_price_bar
(
    timeframe bigint NOT NULL,
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    "timestamp" bigint NOT NULL,
    open numeric(18,10) NOT NULL,
    high numeric(18,10) NOT NULL,
    low numeric(18,10) NOT NULL,
    close numeric(18,10) NOT NULL,
    volume numeric(30,0) NOT NULL,
    buy_count bigint NOT NULL,
    sell_count bigint NOT NULL,
    created bigint NOT NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pump_price_bar
    OWNER to app_indexer;

GRANT ALL ON TABLE public.pump_price_bar TO app_backend;

GRANT ALL ON TABLE public.pump_price_bar TO app_indexer;
-- Index: idx_pump_price_bar_timeframe_mint_timestamp

-- DROP INDEX IF EXISTS public.idx_pump_price_bar_timeframe_mint_timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pump_price_bar_timeframe_mint_timestamp
    ON public.pump_price_bar USING btree
    (timeframe ASC NULLS LAST, mint COLLATE pg_catalog."default" ASC NULLS LAST, "timestamp" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_pump_price_bar_timeframe_timestamp_mint

-- DROP INDEX IF EXISTS public.idx_pump_price_bar_timeframe_timestamp_mint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pump_price_bar_timeframe_timestamp_mint
    ON public.pump_price_bar USING btree
    (timeframe ASC NULLS LAST, "timestamp" ASC NULLS LAST, mint COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS idx_pump_price_bar_mint
    ON public.pump_price_bar USING btree
    (mint COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
