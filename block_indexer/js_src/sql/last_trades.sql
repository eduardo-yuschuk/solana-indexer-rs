DROP TABLE IF EXISTS public.last_trades;

CREATE TABLE IF NOT EXISTS public.last_trades
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    trades jsonb NOT NULL,
    updated_slot bigint NOT NULL,
    PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.last_trades
    OWNER to app_indexer;

GRANT ALL ON TABLE public.last_trades TO app_backend;

GRANT ALL ON TABLE public.last_trades TO app_indexer;
