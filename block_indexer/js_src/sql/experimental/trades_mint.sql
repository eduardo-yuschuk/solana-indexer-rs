DROP TABLE IF EXISTS public.trades_mint;

CREATE TABLE IF NOT EXISTS public.trades_mint
(
    id SERIAL PRIMARY KEY,
    mint character varying(44) COLLATE pg_catalog."default" UNIQUE NOT NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.trades_mint
    OWNER to app_indexer;

GRANT ALL ON TABLE public.trades_mint TO app_backend;

GRANT ALL ON TABLE public.trades_mint TO app_indexer;
