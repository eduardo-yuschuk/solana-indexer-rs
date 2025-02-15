DROP TABLE IF EXISTS public.moonshot_data;

CREATE TABLE IF NOT EXISTS public.moonshot_data
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    name character varying(255) COLLATE pg_catalog."default",
    symbol character varying(32) COLLATE pg_catalog."default",
    uri text COLLATE pg_catalog."default",
    curve_account character varying(44) COLLATE pg_catalog."default",
    sender character varying(44) COLLATE pg_catalog."default",
    amount numeric(30,0),
    collateral_currency INT,
    curve_type INT,
    decimals INT,
    migration_target INT,
    created INT,
    price numeric(18,10),
    updated INT,
    CONSTRAINT moonshot_data_pkey PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.moonshot_data
    OWNER to app_indexer;

GRANT ALL ON TABLE public.moonshot_data TO app_backend;

GRANT ALL ON TABLE public.moonshot_data TO app_indexer;

-- Add columns
ALTER TABLE public.moonshot_data ADD COLUMN total_supply numeric(30,0);
ALTER TABLE public.moonshot_data ADD COLUMN curve_amount numeric(30,0);
ALTER TABLE public.moonshot_data ADD COLUMN marketcap_threshold numeric(30,0);
ALTER TABLE public.moonshot_data ADD COLUMN marketcap_currency INT;
ALTER TABLE public.moonshot_data ADD COLUMN migration_fee INT;
ALTER TABLE public.moonshot_data ADD COLUMN coef_b INT;
ALTER TABLE public.moonshot_data ADD COLUMN bump INT;
ALTER TABLE public.moonshot_data ADD COLUMN bonding_updated INT;
ALTER TABLE public.moonshot_data ADD COLUMN marketcap numeric(30,10);
ALTER TABLE public.moonshot_data ADD COLUMN percentage numeric(30,10);
ALTER TABLE public.moonshot_data ADD COLUMN liquidity numeric(30,10);
ALTER TABLE public.moonshot_data ADD COLUMN buy_count INT;
ALTER TABLE public.moonshot_data ADD COLUMN sell_count INT;
ALTER TABLE public.moonshot_data ADD COLUMN volume numeric(30,0) DEFAULT 0;

CREATE INDEX moonshot_data_curve_account_idx ON public.moonshot_data (curve_account);

ALTER TABLE public.moonshot_data ADD COLUMN create_event_slot bigint;

CREATE INDEX moonshot_data_create_event_slot_idx ON public.moonshot_data (create_event_slot);

ALTER TABLE public.moonshot_data ADD COLUMN archived boolean DEFAULT false;

ALTER TABLE public.moonshot_data ADD COLUMN buy_volume numeric(30,0) DEFAULT 0;
ALTER TABLE public.moonshot_data ADD COLUMN sell_volume numeric(30,0) DEFAULT 0;

ALTER TABLE public.moonshot_data ADD COLUMN dev_hold_sum numeric(30,0) DEFAULT 0;
ALTER TABLE public.moonshot_data ADD COLUMN total_amount numeric(30,0) DEFAULT 0;
ALTER TABLE public.moonshot_data ADD COLUMN total_holders INT DEFAULT 0;

ALTER TABLE public.moonshot_data ADD COLUMN curve_token_amount numeric(30,0);
ALTER TABLE public.moonshot_data ADD COLUMN curve_sol_amount numeric(30,0);
ALTER TABLE public.moonshot_data ADD COLUMN curve_liquidity numeric(30,0);