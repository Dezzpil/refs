# PostgreSQL + Docker Compose — готовый стартовый проект

Изолированная база данных PostgreSQL 16 в контейнере: переменные окружения через `.env`, автоматическая инициализация схемы и тестовых данных, healthcheck и проверка подключения.

## Структура проекта

```
postgres-starter/
├── docker-compose.yml   # Описание сервисов (db + psql-check)
├── .env.example         # Шаблон переменных окружения
├── .gitignore
├── init/
│   ├── 01-schema.sql    # Схема: app_schema, таблицы users и notes
│   └── 02-seed.sql      # Тестовые данные
└── README.md
```

## Быстрый запуск

Требуется Docker и Docker Compose v2 (`docker compose ...` с пробелом).

```bash
cd postgres-starter

# 1. Создать .env из шаблона и задать пароль
cp .env.example .env

# 2. Запустить контейнер (в фоне)
docker compose up -d

# 3. Дождаться статуса healthy
docker compose ps
```

## Переменные окружения

| Переменная              | По умолчанию    | Назначение                  |
|-------------------------|-----------------|-----------------------------|
| `POSTGRES_CONTAINER_NAME`| `postgres_dev`  | Имя контейнера              |
| `POSTGRES_USER`         | `app_user`      | Пользователь БД             |
| `POSTGRES_PASSWORD`     | `app_password`  | Пароль (смените в `.env`)   |
| `POSTGRES_DB`           | `app_db`        | Имя базы                    |
| `POSTGRES_PORT`         | `5432`          | Порт на хосте               |

## Инициализация БД

Скрипты из `init/` монтируются в `/docker-entrypoint-initdb.d` и выполняются автоматически **только при первом запуске** (когда volume `db_data` пуст), в алфавитном порядке. Чтобы применить их заново:

```bash
docker compose down -v   # Удалит контейнер и ДАННЫЕ
docker compose up -d
```

## Проверка подключения

```bash
# Из запущенного контейнера
docker compose exec db psql -U app_user -d app_db -c "SELECT version();"

# Список таблиц и тестовые данные
docker compose exec db psql -U app_user -d app_db \
  -c "\dt app_schema.*" -c "SELECT * FROM app_schema.users;"

# Одноразовый контейнер-проверка (сервис psql-check)
docker compose run --rm psql-check

# С хоста (если установлен psql)
psql -h localhost -p 5432 -U app_user -d app_db
```

Подключение из кода: `postgresql://app_user:app_password@localhost:5432/app_db`.

## Полезные команды

```bash
docker compose logs -f db      # Логи PostgreSQL
docker compose restart db      # Перезапуск
docker compose down            # Остановка (данные сохранятся)
docker compose down -v         # Остановка с удалением данных
```
