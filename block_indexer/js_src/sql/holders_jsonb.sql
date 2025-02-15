DROP TABLE IF EXISTS public.holders_jsonb;

CREATE TABLE IF NOT EXISTS public.holders_jsonb
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    holders jsonb NOT NULL,
    updated bigint NOT NULL,
    CONSTRAINT holders_jsonb_pkey PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.holders_jsonb 
    OWNER to app_indexer;

GRANT ALL ON TABLE public.holders_jsonb TO app_backend;

GRANT ALL ON TABLE public.holders_jsonb TO app_indexer;
