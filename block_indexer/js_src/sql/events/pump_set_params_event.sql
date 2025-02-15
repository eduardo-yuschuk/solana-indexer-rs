DROP TABLE IF EXISTS public.pump_set_params_event;
CREATE TABLE public.pump_set_params_event (
    event_id BYTEA PRIMARY KEY,
    fee_recipient VARCHAR(44) NOT NULL,
    initial_virtual_token_reserves NUMERIC(30, 0) NOT NULL,
    initial_virtual_sol_reserves NUMERIC(30, 0) NOT NULL,
    initial_real_token_reserves NUMERIC(30, 0) NOT NULL,
    token_total_supply NUMERIC(30, 0) NOT NULL,
    fee_basis_points NUMERIC(10, 0) NOT NULL,
    slot BIGINT NOT NULL,
    signature VARCHAR(128) NOT NULL,
    created BIGINT NOT NULL
);
ALTER TABLE IF EXISTS public.pump_set_params_event OWNER to postgres;