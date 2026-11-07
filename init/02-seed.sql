-- Тестовые данные
INSERT INTO app_schema.users (username, email) VALUES
    ('alice', 'alice@example.com'),
    ('bob',   'bob@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO app_schema.notes (user_id, title, body)
SELECT u.id, 'Первая заметка', 'Проверка кириллицы в БД'
FROM app_schema.users u
WHERE u.username = 'alice'
  AND NOT EXISTS (SELECT 1 FROM app_schema.notes);
