-- Схема БД сервиса референсов.
-- Выполняется автоматически при ПЕРВОМ запуске контейнера PostgreSQL
-- (пока том pgdata пуст).

CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mechanics (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_types (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference (
    id            SERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    -- Для чего референс: decor = для декорации, model = для моделей, mechanic = для механики
    category      TEXT NOT NULL CHECK (category IN ('decor', 'model', 'mechanic')),
    -- «Какой именно»: конкретный тип ассета проекта (Персонаж, Оружие, ...)
    asset_type_id INTEGER REFERENCES asset_types (id) ON DELETE SET NULL,
    -- Связка с механикой проекта (для категории mechanic)
    mechanic_id   INTEGER REFERENCES mechanics (id) ON DELETE SET NULL,
    image_url     TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mechanics_project   ON mechanics (project_id);
CREATE INDEX IF NOT EXISTS idx_asset_types_project ON asset_types (project_id);
CREATE INDEX IF NOT EXISTS idx_reference_project   ON reference (project_id);
CREATE INDEX IF NOT EXISTS idx_reference_category  ON reference (category);
