DROP TABLE IF EXISTS public.block_json;

CREATE TABLE IF NOT EXISTS public.block_json
( 
    slot INT NOT NULL,
    compressed_json BYTEA,
    readed INT,
    recovered INT,
    verified INT,
    indexed INT,
    CONSTRAINT block_json_pkey PRIMARY KEY (slot)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.block_json
    OWNER to app_indexer;

GRANT ALL ON TABLE public.block_json TO app_backend;

GRANT ALL ON TABLE public.block_json TO app_indexer;
