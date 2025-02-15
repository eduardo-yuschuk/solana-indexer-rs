DROP TABLE IF EXISTS public.pump_create_event;
CREATE TABLE public.pump_create_event (
    event_id BYTEA PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    uri TEXT NOT NULL,
    mint VARCHAR(44) NOT NULL,
    bonding_curve VARCHAR(44) NOT NULL,
    user_public_key VARCHAR(44) NOT NULL,
    slot BIGINT NOT NULL,
    signature VARCHAR(128) NOT NULL,
    created BIGINT NOT NULL
);
ALTER TABLE IF EXISTS public.pump_create_event OWNER to postgres;