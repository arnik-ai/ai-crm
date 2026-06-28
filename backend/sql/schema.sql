-- ============================================================
-- AI CRM — اسکیمای کامل PostgreSQL (مرجع؛ مدیریت نهایی با Alembic)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Tenancy & Identity ----------
CREATE TABLE tenants (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    slug       text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
    email           text NOT NULL UNIQUE,
    mobile          text,
    hashed_password text NOT NULL,
    full_name       text NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
-- موبایل برای ورود با پیامک: یکتا فقط برای مقادیر غیرخالی
CREATE UNIQUE INDEX uq_users_mobile ON users(mobile) WHERE mobile IS NOT NULL;

CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text NOT NULL UNIQUE,
    description text
);

CREATE TABLE user_roles (
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id       uuid REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ---------- CRM ----------
CREATE TABLE courses (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title      text NOT NULL,
    slug       text NOT NULL UNIQUE,
    price      numeric(12,0),
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_stages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid,
    name        text NOT NULL,
    order_index int  NOT NULL,
    is_terminal boolean NOT NULL DEFAULT false,
    color       text DEFAULT '#888888',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE students (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid,
    full_name          text,
    mobile             text NOT NULL,
    city               text,
    field              text,
    grade              text,
    goal               text,
    gpa                numeric(4,2),
    course_interest_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    lead_source        text,
    assigned_agent_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    sales_stage_id     uuid REFERENCES sales_stages(id) ON DELETE SET NULL,
    status             text NOT NULL DEFAULT 'active',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    deleted_at         timestamptz,
    CONSTRAINT uq_student_mobile UNIQUE (tenant_id, mobile)
);
CREATE INDEX ix_students_agent  ON students(assigned_agent_id);
CREATE INDEX ix_students_stage  ON students(sales_stage_id);
CREATE INDEX ix_students_status ON students(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_students_mobile ON students(mobile);

CREATE TABLE tags (
    id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name  text NOT NULL UNIQUE,
    color text DEFAULT '#3b82f6'
);

CREATE TABLE student_tags (
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    tag_id     uuid REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, tag_id)
);

CREATE TABLE notes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notes_student ON notes(student_id);

CREATE TABLE followups (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    owner_id   uuid REFERENCES users(id) ON DELETE SET NULL,
    due_at     timestamptz NOT NULL,
    status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','done','overdue','cancelled')),
    note       text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_followups_due ON followups(due_at) WHERE status = 'pending';

CREATE TABLE activities (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type       text NOT NULL,
    payload    jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_activities_student ON activities(student_id, created_at DESC);

CREATE TABLE sales (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid,
    student_id      uuid REFERENCES students(id) ON DELETE SET NULL,
    agent_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    student_name    text,
    mobile          text,
    product         text NOT NULL,
    program_months  int,
    amount          numeric(14,0) NOT NULL DEFAULT 0,
    payment_method  text,
    payment_ref     text,
    deposited_at    timestamptz,
    payer_card      text,
    dest_account    text,
    note            text,
    sold_at         timestamptz NOT NULL DEFAULT now(),
    renewal_due_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sales_sold    ON sales(sold_at DESC);
CREATE INDEX ix_sales_agent   ON sales(agent_id);
CREATE INDEX ix_sales_student ON sales(student_id);
CREATE INDEX ix_sales_renewal ON sales(renewal_due_at) WHERE renewal_due_at IS NOT NULL;

-- آیتم‌های فیش فروش (مبلغ جدا برای هر محصول)
CREATE TABLE sale_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product         text NOT NULL,
    program_months  int,
    amount          numeric(14,0) NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX ix_sale_items_product ON sale_items(product);

CREATE TABLE messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE SET NULL,
    sender_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    mobile     text,
    channel    text NOT NULL CHECK (channel IN ('sms','whatsapp','telegram')),
    body       text NOT NULL,
    status     text NOT NULL DEFAULT 'sent',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_messages_student ON messages(student_id);
CREATE INDEX ix_messages_created ON messages(created_at DESC);

-- ---------- Telephony ----------
CREATE TABLE calls (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid,
    student_id    uuid REFERENCES students(id) ON DELETE SET NULL,
    agent_id      uuid REFERENCES users(id) ON DELETE SET NULL,
    provider      text NOT NULL DEFAULT 'workano',
    external_id   text NOT NULL,
    direction     text NOT NULL CHECK (direction IN ('inbound','outbound')),
    status        text NOT NULL CHECK (status IN ('ringing','answered','missed','finished','failed')),
    outcome       text,
    caller_number text,
    callee_number text,
    duration_sec  int DEFAULT 0,
    recording_url text,
    started_at    timestamptz,
    ended_at      timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_call_external UNIQUE (provider, external_id)
);
CREATE INDEX ix_calls_student ON calls(student_id);
CREATE INDEX ix_calls_started ON calls(started_at DESC);

CREATE TABLE recordings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id         uuid NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    storage_key     text,
    format          text DEFAULT 'mp3',
    size_bytes      int,
    download_status text NOT NULL DEFAULT 'pending'
                    CHECK (download_status IN ('pending','downloaded','failed')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transcripts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id uuid NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
    language     text DEFAULT 'fa',
    content      text,
    segments     jsonb,
    engine       text DEFAULT 'avalai-whisper',
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_transcripts_segments ON transcripts USING gin (segments);

-- ---------- AI Analysis ----------
CREATE TABLE lead_scores (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id               uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    call_id                  uuid REFERENCES calls(id) ON DELETE SET NULL,
    score                    int NOT NULL CHECK (score BETWEEN 0 AND 100),
    registration_probability numeric(4,3) CHECK (registration_probability BETWEEN 0 AND 1),
    signals                  jsonb,
    next_best_action         text,
    created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_lead_scores_student ON lead_scores(student_id, created_at DESC);
CREATE INDEX ix_lead_scores_signals ON lead_scores USING gin (signals);

-- ---------- Webhook & Audit ----------
CREATE TABLE webhook_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        text NOT NULL,
    event_type      text NOT NULL,
    external_id     text,
    payload         jsonb NOT NULL,
    signature_valid boolean,
    process_status  text NOT NULL DEFAULT 'received'
                    CHECK (process_status IN ('received','processing','done','failed','duplicate')),
    received_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_webhook_event UNIQUE (provider, event_type, external_id)
);
CREATE INDEX ix_webhook_received ON webhook_logs(received_at DESC);

CREATE TABLE audit_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
    action     text NOT NULL,
    entity     text NOT NULL,
    entity_id  uuid,
    diff       jsonb,
    ip         inet,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_logs(entity, entity_id);

-- ---------- Seed: نقش‌ها و مراحل پیش‌فرض ----------
INSERT INTO roles (name, description) VALUES
    ('admin', 'مدیر سیستم'),
    ('sales_manager', 'مدیر فروش'),
    ('sales_agent', 'کارشناس فروش'),
    ('viewer', 'فقط مشاهده')
ON CONFLICT DO NOTHING;
