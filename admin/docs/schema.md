# AVAILABLE SCHEMA

create table public.bookings (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
customer_id uuid null,
therapist_id uuid null,
service_id uuid null,
package_id uuid null,
booking_date date null,
start_time time without time zone null,
end_time time without time zone null,
location_type text null,
address text null,
status text null,
payment_status text null,
location_id uuid null,
constraint bookings_pkey primary key (id),
constraint bookings_customer_id_fkey foreign KEY (customer_id) references customer (id),
constraint bookings_location_id_fkey foreign KEY (location_id) references customer_locations (id) on delete set null,
constraint bookings_package_id_fkey foreign KEY (package_id) references packages (id),
constraint bookings_service_id_fkey foreign KEY (service_id) references services (id),
constraint bookings_therapist_id_fkey foreign KEY (therapist_id) references therapists (id)
) TABLESPACE pg_default;

---

create table public.bot_sessions (
id uuid not null default gen_random_uuid (),
customer_id uuid not null,
current_step text not null default 'welcome'::text,
session_data jsonb null default '{}'::jsonb,
created_at timestamp without time zone null default now(),
updated_at timestamp without time zone null default now(),
constraint bot_sessions_pkey primary key (id),
constraint bot_sessions_customer_id_fkey foreign KEY (customer_id) references customer (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists unique_active_session on public.bot_sessions using btree (customer_id) TABLESPACE pg_default;

create trigger trg_bot_sessions_updated BEFORE
update on bot_sessions for EACH row
execute FUNCTION update_bot_session_timestamp ();

---

create table public.business_hours (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
service_type text null,
is_ramadan boolean null,
open_time time without time zone null,
close_time time without time zone null,
constraint business_hours_pkey primary key (id),
constraint bh_type_ramadan_unique unique (service_type, is_ramadan)
) TABLESPACE pg_default;

---

create table public.customer (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
full_name character varying null,
phone text not null,
last_active_at timestamp without time zone null default now(),
constraint customer_pkey primary key (id),
constraint customer_phone_key unique (phone)
) TABLESPACE pg_default;

---

create table public.customer (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
full_name character varying null,
phone text not null,
last_active_at timestamp without time zone null default now(),
constraint customer_pkey primary key (id),
constraint customer_phone_key unique (phone)
) TABLESPACE pg_default;

---

create table public.package_services (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
package_id uuid null default gen_random_uuid (),
service_id uuid null,
sessions_allowed integer null,
constraint package_services_pkey primary key (id),
constraint package_services_package_id_fkey foreign KEY (package_id) references packages (id),
constraint package_services_service_id_fkey foreign KEY (service_id) references services (id)
) TABLESPACE pg_default;

---

create table public.package_usage (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
booking_id uuid null,
packages_id uuid null default gen_random_uuid (),
customer_id uuid null,
used_session_count integer null,
constraint package_usage_pkey primary key (id),
constraint package_usage_booking_id_fkey foreign KEY (booking_id) references bookings (id),
constraint package_usage_customer_id_fkey foreign KEY (customer_id) references customer (id),
constraint package_usage_packages_id_fkey foreign KEY (packages_id) references packages (id)
) TABLESPACE pg_default;

---

create table public.packages (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
name text null,
description text null,
total_sessions integer null,
total_price bigint null,
validity_days bigint null,
is_active boolean null,
constraint packages_pkey primary key (id),
constraint packages_name_unique unique (name)
) TABLESPACE pg_default;

---

create table public.provider_district_locks (
id uuid not null default gen_random_uuid (),
therapist_id uuid not null,
lock_date date not null,
district text not null,
created_at timestamp without time zone null default now(),
constraint provider_district_locks_pkey primary key (id),
constraint provider_district_locks_therapist_id_lock_date_key unique (therapist_id, lock_date),
constraint provider_district_locks_therapist_id_fkey foreign KEY (therapist_id) references therapists (id) on delete CASCADE
) TABLESPACE pg_default;

---

create table public.services (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
name text null,
description character varying null,
duration_minutes bigint null,
price bigint null,
oil_based boolean null,
available_for_home boolean null,
available_in_center boolean null,
is_active boolean null,
name_ar text null,
service_category text null default 'single'::text,
constraint services_pkey primary key (id),
constraint services_name_unique unique (name),
constraint services_service_category_check check (
(
service_category = any (array['single'::text, 'package'::text])
)
)
) TABLESPACE pg_default;

---

create table public.slot_holds (
id uuid not null default gen_random_uuid (),
therapist_id uuid not null,
service_id uuid null,
slot_date date not null,
slot_time time without time zone not null,
customer_id uuid null,
status text null default 'held'::text,
expires_at timestamp without time zone not null,
created_at timestamp without time zone null default now(),
constraint slot_holds_pkey primary key (id),
constraint slot_holds_customer_id_fkey foreign KEY (customer_id) references customer (id) on delete CASCADE,
constraint slot_holds_service_id_fkey foreign KEY (service_id) references services (id) on delete set null,
constraint slot_holds_therapist_id_fkey foreign KEY (therapist_id) references therapists (id) on delete CASCADE,
constraint slot_holds_status_check check (
(
status = any (array['held'::text, 'released'::text])
)
)
) TABLESPACE pg_default;

---

create table public.therapist_services (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
therapist_id uuid null,
service_id uuid null,
constraint therapist_services_pkey primary key (id),
constraint therapist_services_service_id_fkey foreign KEY (service_id) references services (id),
constraint therapist_services_therapist_id_fkey foreign KEY (therapist_id) references therapists (id)
) TABLESPACE pg_default;

---

create table public.therapists (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
full_name text null,
is_licensed boolean null,
gender text null,
is_active boolean null,
notes text null,
whatsapp_number text null,
rating numeric(3, 2) null default 5.0,
home_address text null,
home_latitude numeric(10, 7) null,
home_longitude numeric(10, 7) null,
max_slots_per_day integer null default 6,
home_district text null,
constraint therapists_pkey primary key (id)
) TABLESPACE pg_default;

---

create table public.users (
id uuid not null default gen_random_uuid (),
email text not null,
full_name text not null,
password text not null,
role text not null default 'staff'::text,
is_active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
constraint users_pkey primary key (id),
constraint users_email_key unique (email),
constraint users_role_check check (
(role = any (array['admin'::text, 'staff'::text]))
)
) TABLESPACE pg_default;

create trigger users_updated_at BEFORE
update on users for EACH row
execute FUNCTION update_updated_at ();

---

create table public.whatsapp_logs (
id uuid not null default gen_random_uuid (),
created_at timestamp with time zone not null default now(),
phone text null,
message text null,
direction text null,
customer_id uuid null,
constraint whatsapp_logs_pkey primary key (id),
constraint whatsapp_logs_customer_id_fkey foreign KEY (customer_id) references customer (id) on delete set null
) TABLESPACE pg_default;

---
