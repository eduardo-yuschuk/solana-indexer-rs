DROP TABLE IF EXISTS public.holders_zip;

CREATE TABLE IF NOT EXISTS public.holders_zip
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    holders BYTEA NOT NULL,
    updated bigint NOT NULL,
    CONSTRAINT holders_holders_zip PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.holders_zip 
    OWNER to app_indexer;

GRANT ALL ON TABLE public.holders_zip TO app_backend;

GRANT ALL ON TABLE public.holders_zip TO app_indexer;
