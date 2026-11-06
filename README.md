# Refs Board — доска референсов

Одностраничный сервис (Mobile First) для управления игровыми референсами:
проекты, механики, типы ассетов и сами референсы с указанием,
для чего они (декорация / модель / механика) и к какому типу ассета или механике относятся.

Стек: **Docker Compose + PostgreSQL + FastAPI + Nginx**.

## Структура

```
refs-board/
├── docker-compose.yml      # композиция: nginx + app + postgres
├── .env.example            # шаблон переменных окружения
├── nginx/
│   └── default.conf        # раздача статики и проксирование /api
├── db/init/                # скрипты инициализации БД (выполняются при первом запуске)
│   ├── 01_schema.sql       # схема таблиц
│   └── 02_seed.sql         # демо-данные («Демо-проект»)
├── backend/                # FastAPI: REST API
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # эндпоинты
│       ├── models.py       # SQLAlchemy-модели
│       └── schemas.py      # валидация (Pydantic)
└── frontend/               # одностраничный интерфейс (без сборки)
    ├── index.html
    ├── styles.css
    └── app.js
```

## Запуск

Нужен только установленный Docker с плагином Compose.

```bash
cd refs-board
cp .env.example .env        # при желании поменяйте порт и пароли
docker compose up -d --build
```

Откройте **http://localhost:8080** (порт берётся из `APP_PORT` в `.env`).

При первом старте PostgreSQL создаёт БД, выполняет `db/init/*.sql`
и наполняет её демо-проектом. Повторные запуски данные не трогают.

## Проверка

Веб-интерфейс:

```bash
curl http://localhost:8080/ | head -n 5
```

API и связь с БД:

```bash
curl http://localhost:8080/api/health          # {"status":"ok"}
curl http://localhost:8080/api/projects         # список проектов
```

Подключение к PostgreSQL напрямую:

```bash
docker compose exec db psql -U refs -d refs -c '\dt'   # таблицы
docker compose exec db psql -U refs -d refs -c 'SELECT name FROM projects;'
```

(пользователь/база/пароль — из `.env`)

## Остановка и сброс

```bash
docker compose stop          # остановить (данные сохранятся в томе pgdata)
docker compose down          # убрать контейнеры
docker compose down -v       # убрать и удалить данные БД (полный сброс)
```

## API (кратко)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | проверка живости и связи с БД |
| GET/POST | `/api/projects` | список / создание проектов |
| PATCH/DELETE | `/api/projects/{id}` | изменение / удаление проекта |
| GET/POST | `/api/projects/{id}/mechanics` | механики проекта |
| PATCH/DELETE | `/api/mechanics/{id}` | изменение / удаление механики |
| GET/POST | `/api/projects/{id}/asset-types` | типы ассетов проекта |
| PATCH/DELETE | `/api/asset-types/{id}` | изменение / удаление типа ассета |
| GET/POST | `/api/projects/{id}/references` | референсы (фильтры: `category`, `asset_type_id`, `mechanic_id`) |
| PATCH/DELETE | `/api/references/{id}` | изменение / удаление референса |

Категории референса: `decor` (для декорации), `model` (для моделей), `mechanic` (для механики).
У референса дополнительно указывается тип ассета («какой именно»: персонаж, оружие и т.п.)
и/или механика проекта.

## Что дальше (этап 2)

Заложено поле `image_url` у референса и раздача картинок через Nginx.
Следующий этап — редактирование изображения прямо в сервисе с телефона
(загрузка файла + canvas-редактор в интерфейсе).

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `APP_PORT` | `8080` | порт nginx (веб-интерфейс) на хосте |
| `POSTGRES_USER` | `refs` | пользователь БД |
| `POSTGRES_PASSWORD` | `refspass` | пароль БД |
| `POSTGRES_DB` | `refs` | имя базы |
| `POSTGRES_PORT` | `5432` | порт БД на хосте (можно закрыть) |

Значения задаются в `.env` (compose подхватывает автоматически).
