DROP TABLE IF EXISTS public.pump_data;

CREATE TABLE IF NOT EXISTS public.pump_data
(
    mint character varying(44) COLLATE pg_catalog."default" NOT NULL,
    name character varying(255) COLLATE pg_catalog."default",
    symbol character varying(32) COLLATE pg_catalog."default",
    uri text COLLATE pg_catalog."default",
    bonding_curve character varying(44) COLLATE pg_catalog."default",
    user_public_key character varying(44) COLLATE pg_catalog."default",
    created bigint,
    discriminator bigint,
    virtual_token_reserves numeric(30,0),
    virtual_sol_reserves numeric(30,0),
    real_token_reserves numeric(30,0),
    real_sol_reserves numeric(30,0),
    token_total_supply numeric(30,0),
    complete boolean,
    completed bigint,
    price numeric(18,10),
    updated bigint,
    CONSTRAINT pump_data_pkey PRIMARY KEY (mint)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pump_data
    OWNER to app_indexer;

GRANT ALL ON TABLE public.pump_data TO app_backend;

GRANT ALL ON TABLE public.pump_data TO app_indexer;

ALTER TABLE public.pump_data ADD COLUMN buy_count INT DEFAULT 0;
ALTER TABLE public.pump_data ADD COLUMN sell_count INT DEFAULT 0;
ALTER TABLE public.pump_data ADD COLUMN volume numeric(30,0) DEFAULT 0;

CREATE INDEX pump_data_bonding_curve_idx ON public.pump_data (bonding_curve);

ALTER TABLE public.pump_data ADD COLUMN create_event_slot bigint;

CREATE INDEX pump_data_create_event_slot_idx ON public.pump_data (create_event_slot);

ALTER TABLE public.pump_data ADD COLUMN archived boolean DEFAULT false;

ALTER TABLE public.pump_data ADD COLUMN buy_volume numeric(30,0) DEFAULT 0;
ALTER TABLE public.pump_data ADD COLUMN sell_volume numeric(30,0) DEFAULT 0;

ALTER TABLE public.pump_data ADD COLUMN dev_hold_sum numeric(30,0) DEFAULT 0;
ALTER TABLE public.pump_data ADD COLUMN total_amount numeric(30,0) DEFAULT 0;
ALTER TABLE public.pump_data ADD COLUMN total_holders INT DEFAULT 0;
