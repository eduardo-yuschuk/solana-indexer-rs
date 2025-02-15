DROP TABLE IF EXISTS public.trades_user;

CREATE TABLE IF NOT EXISTS public.trades_user
(
    id SERIAL PRIMARY KEY,
    wallet character varying(44) COLLATE pg_catalog."default" UNIQUE NOT NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.trades_user
    OWNER to app_indexer;

GRANT ALL ON TABLE public.trades_user TO app_backend;

GRANT ALL ON TABLE public.trades_user TO app_indexer;
