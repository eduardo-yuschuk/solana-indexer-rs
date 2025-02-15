DROP TABLE IF EXISTS public.last_trades_json;

CREATE TABLE IF NOT EXISTS public.last_trades_json
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    trades json NOT NULL,
    updated_slot bigint NOT NULL,
    PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.last_trades_json
    OWNER to app_indexer;

GRANT ALL ON TABLE public.last_trades_json TO app_backend;

GRANT ALL ON TABLE public.last_trades_json TO app_indexer;
