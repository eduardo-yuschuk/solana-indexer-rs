DROP TABLE IF EXISTS public.holders;

CREATE TABLE IF NOT EXISTS public.holders
(
    wallet character varying(44) COLLATE pg_catalog."default" NOT NULL,
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    decimals INT NOT NULL,
    is_bonding_curve boolean,
    token_amount numeric(20,0),
    updated INT,
    CONSTRAINT holders_pkey PRIMARY KEY (wallet, mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.holders
    OWNER to app_indexer;

GRANT ALL ON TABLE public.holders TO app_backend;

GRANT ALL ON TABLE public.holders TO app_indexer;

CREATE INDEX IF NOT EXISTS idx_holders_wallet ON public.holders USING btree (wallet DESC);
CREATE INDEX IF NOT EXISTS idx_holders_mint ON public.holders USING btree (mint DESC);

ALTER TABLE IF EXISTS public.holders ADD COLUMN IF NOT EXISTS is_developer boolean;
