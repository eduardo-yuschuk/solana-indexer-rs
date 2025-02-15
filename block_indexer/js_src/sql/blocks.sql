DROP TABLE IF EXISTS public.blocks;

CREATE TABLE IF NOT EXISTS public.blocks
(
    slot bigint NOT NULL,
    status character(1) COLLATE pg_catalog."default", -- I (indexed), E (empty slot), R (recovered)
    block_time bigint,
    indexing_time bigint,
    created bigint,
    verified bigint,
    CONSTRAINT blocks_pkey PRIMARY KEY (slot)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.blocks
    OWNER to app_indexer;

GRANT ALL ON TABLE public.blocks TO app_backend;

GRANT ALL ON TABLE public.blocks TO app_indexer;
