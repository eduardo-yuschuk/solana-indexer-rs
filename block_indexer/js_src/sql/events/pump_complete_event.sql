DROP TABLE IF EXISTS public.pump_complete_event;
CREATE TABLE public.pump_complete_event (
    event_id BYTEA PRIMARY KEY,
    user_public_key VARCHAR(44) NOT NULL,
    mint_public_key VARCHAR(44) NOT NULL,
    bonding_curve_public_key VARCHAR(44) NOT NULL,
    timestamp BIGINT NOT NULL,
    slot BIGINT NOT NULL,
    signature VARCHAR(128) NOT NULL,
    created BIGINT NOT NULL
);
ALTER TABLE IF EXISTS public.pump_complete_event OWNER to postgres;