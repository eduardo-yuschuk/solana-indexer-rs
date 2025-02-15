-- Table: public.last_trades_zip

-- DROP TABLE IF EXISTS public.last_trades_zip;

CREATE TABLE IF NOT EXISTS public.last_trades_zip
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    compressed_json BYTEA NOT NULL,
    updated_slot bigint NOT NULL,
    CONSTRAINT last_trades_zip_pkey PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.last_trades_zip
    OWNER to app_indexer;

GRANT ALL ON TABLE public.last_trades_zip TO app_backend;

GRANT ALL ON TABLE public.last_trades_zip TO app_indexer;

GRANT ALL ON TABLE public.last_trades_zip TO dev;
