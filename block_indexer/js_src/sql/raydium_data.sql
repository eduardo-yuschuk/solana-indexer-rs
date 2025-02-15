DROP TABLE IF EXISTS public.raydium_data;

CREATE TABLE IF NOT EXISTS public.raydium_data
(
    amm character varying(44) COLLATE pg_catalog."default" NOT NULL,
    amm_open_orders character varying(44) COLLATE pg_catalog."default",
    lp_mint character varying(44) COLLATE pg_catalog."default",
    coin_mint character varying(44) COLLATE pg_catalog."default",
    pc_mint character varying(44) COLLATE pg_catalog."default",
    pool_coin_token_account character varying(44) COLLATE pg_catalog."default",
    pool_pc_token_account character varying(44) COLLATE pg_catalog."default",
    pool_withdraw_queue character varying(44) COLLATE pg_catalog."default",
    amm_target_orders character varying(44) COLLATE pg_catalog."default",
    pool_temp_lp character varying(44) COLLATE pg_catalog."default",
    open_time bigint,
    init_pc_amount numeric(30,0),
    init_coin_amount numeric(30,0),
    pc_decimals integer,
    coin_decimals integer,
    pc_lot_size numeric(30,0),
    coin_lot_size numeric(30,0),
    pc_amount numeric(30,0),
    coin_amount numeric(30,0),
    market character varying(44) COLLATE pg_catalog."default",
    price numeric(30,10),
    created bigint NOT NULL,
    updated bigint,
    CONSTRAINT raydium_data_pkey PRIMARY KEY (amm)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.raydium_data
    OWNER to app_indexer;

GRANT ALL ON TABLE public.raydium_data TO app_backend;

GRANT ALL ON TABLE public.raydium_data TO app_indexer;

GRANT ALL ON TABLE public.raydium_data TO dev;
-- Index: raydium_data_coin_mint_idx

-- DROP INDEX IF EXISTS public.raydium_data_coin_mint_idx;

CREATE INDEX IF NOT EXISTS raydium_data_coin_mint_idx
    ON public.raydium_data USING btree
    (coin_mint COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: raydium_data_pc_mint_idx

-- DROP INDEX IF EXISTS public.raydium_data_pc_mint_idx;

CREATE INDEX IF NOT EXISTS raydium_data_pc_mint_idx
    ON public.raydium_data USING btree
    (pc_mint COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

ALTER TABLE public.raydium_data ADD COLUMN buy_count INT;
ALTER TABLE public.raydium_data ADD COLUMN sell_count INT;
ALTER TABLE public.raydium_data ADD COLUMN volume numeric(30,0) DEFAULT 0;

ALTER TABLE public.raydium_data ADD COLUMN create_event_slot bigint;

CREATE INDEX raydium_data_create_event_slot_idx ON public.raydium_data (create_event_slot);

ALTER TABLE public.raydium_data ADD COLUMN archived boolean DEFAULT false;

ALTER TABLE public.raydium_data ADD COLUMN buy_volume numeric(30,0) DEFAULT 0;
ALTER TABLE public.raydium_data ADD COLUMN sell_volume numeric(30,0) DEFAULT 0;

ALTER TABLE public.raydium_data ALTER COLUMN buy_count SET DEFAULT 0;
ALTER TABLE public.raydium_data ALTER COLUMN sell_count SET DEFAULT 0;

UPDATE public.raydium_data SET buy_count = 0 WHERE buy_count IS NULL;
UPDATE public.raydium_data SET sell_count = 0 WHERE sell_count IS NULL;

ALTER TABLE public.raydium_data ADD COLUMN dev_hold_sum numeric(30,0) DEFAULT 0;
ALTER TABLE public.raydium_data ADD COLUMN total_amount numeric(30,0) DEFAULT 0;
ALTER TABLE public.raydium_data ADD COLUMN total_holders INT DEFAULT 0;