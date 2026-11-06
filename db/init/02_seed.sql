-- Демо-данные, чтобы интерфейс не был пустым при первом запуске.
-- Проект «Демо-проект» можно удалить прямо из веб-интерфейса.

INSERT INTO projects (name, description)
SELECT 'Демо-проект', 'Пример проекта: механики, типы ассетов и референсы.'
WHERE NOT EXISTS (SELECT 1 FROM projects);

INSERT INTO mechanics (project_id, name, description)
SELECT p.id, v.name, v.description
FROM projects p
CROSS JOIN (VALUES
    ('Двойной прыжок', 'Персонаж прыгает второй раз в воздухе.'),
    ('Рывок-уклонение', 'Короткий рывок с неуязвимостью.')
) AS v(name, description)
WHERE p.name = 'Демо-проект'
  AND NOT EXISTS (SELECT 1 FROM mechanics m WHERE m.project_id = p.id AND m.name = v.name);

INSERT INTO asset_types (project_id, name, description)
SELECT p.id, v.name, v.description
FROM projects p
CROSS JOIN (VALUES
    ('Персонаж', 'Силуэты, позы, одежда.'),
    ('Окружение', 'Фоны, декорации, атмосфера локаций.')
) AS v(name, description)
WHERE p.name = 'Демо-проект'
  AND NOT EXISTS (SELECT 1 FROM asset_types a WHERE a.project_id = p.id AND a.name = v.name);

INSERT INTO reference (project_id, title, description, category, asset_type_id, mechanic_id, image_url)
SELECT p.id, v.title, v.description, v.category,
       (SELECT a.id FROM asset_types a WHERE a.project_id = p.id AND a.name = v.asset_type),
       (SELECT m.id FROM mechanics  m WHERE m.project_id = p.id AND m.name  = v.mechanic),
       ''
FROM projects p
CROSS JOIN (VALUES
    ('Референс силуэта героя', 'Общий силуэт и пропорции.', 'model',    'Персонаж', NULL,               ''),
    ('Референс палитры локации', 'Цветовая палитра и свет.', 'decor',   'Окружение', NULL,              ''),
    ('Референс рывка', 'Смазанность и следы при рывке.', 'mechanic',  NULL,       'Рывок-уклонение', '')
) AS v(title, description, category, asset_type, mechanic, image_url)
WHERE p.name = 'Демо-проект'
  AND NOT EXISTS (SELECT 1 FROM reference r WHERE r.project_id = p.id AND r.title = v.title);
