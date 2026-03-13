# Crash Game — Инструкция по деплою

## Архитектура

```
┌─────────────────────────────────────────────┐
│                   Nginx (порт 80/443)       │
│    /          → Client (статика React)      │
│    /api/*     → Server API (порт 3001)      │
│    /ws        → WebSocket (порт 3002)       │
└────────┬──────────┬──────────┬──────────────┘
         │          │          │
    ┌────┴───┐ ┌────┴───┐ ┌───┴────┐
    │ Client │ │ Server │ │   WS   │
    │ Nginx  │ │ Express│ │  ws:// │
    └────────┘ └───┬────┘ └───┬────┘
                   │          │
            ┌──────┴──────────┴──────┐
            │                        │
       ┌────┴─────┐          ┌──────┴──┐
       │PostgreSQL │          │  Redis  │
       │  :5432    │          │  :6379  │
       └──────────┘          └─────────┘
```

## Требования

- Docker + Docker Compose
- Минимум 1 ГБ ОЗУ
- Домен (опционально, для SSL)

---

## 1. Быстрый старт (Docker Compose)

### Клонируем и настраиваем:

```bash
git clone <repo-url> crash-game
cd crash-game

# Создаём .env файл
cp .env.example .env
```

### Редактируем `.env`:

```env
POSTGRES_PASSWORD=your-strong-password-here
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
CORS_ORIGIN=http://your-domain.com
```

### Запускаем:

```bash
docker compose up -d --build
```

### Применяем миграции и сид:

```bash
# Миграции применяются автоматически при старте сервера
# Для первоначального сида (админ + настройки + достижения):
docker compose exec server npx prisma db seed
```

Приложение доступно на `http://localhost` (порт 80).

**Админ-аккаунт:** `admin` / `admin123`

---

## 2. Локальная разработка

### Поднимаем БД и Redis:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Сервер:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Сервер стартует на `http://localhost:3001` (API + WebSocket на том же порту, path `/ws`).

### Клиент:

```bash
cd client
npm install
npm run dev
```

Клиент стартует на `http://localhost:5173` с прокси на API и WS.

---

## 3. Продакшн деплой на VPS

### Серверные требования

| Компонент  | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU       | 1 ядро  | 2 ядра        |
| RAM       | 1 ГБ    | 2 ГБ          |
| Диск      | 10 ГБ   | 20 ГБ SSD     |
| ОС        | Ubuntu 22.04+ / Debian 12+ |

### Шаг 1: Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Перелогиниться
```

### Шаг 2: Клонируем проект

```bash
git clone <repo-url> /opt/crash-game
cd /opt/crash-game
```

### Шаг 3: Создаём `.env`

```bash
cat > .env << 'EOF'
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://your-domain.com
EOF
```

### Шаг 4: Запускаем

```bash
docker compose up -d --build
```

### Шаг 5: Сид базы данных

```bash
docker compose exec server npx prisma db seed
```

---

## 4. SSL (HTTPS) с Let's Encrypt

### Вариант А: Certbot на хосте

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Копируем сертификаты
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

В `nginx/nginx.conf` раскомментируйте секцию SSL и добавьте volume в `docker-compose.yml`:

```yaml
client:
  volumes:
    - ./nginx/ssl:/etc/nginx/ssl:ro
```

### Вариант Б: Cloudflare

Поставьте домен на Cloudflare, включите Flexible/Full SSL. Nginx остаётся на порту 80.

---

## 5. Полезные команды

```bash
# Логи
docker compose logs -f server
docker compose logs -f client

# Перезапуск
docker compose restart server

# Обновление кода
git pull
docker compose up -d --build

# Бэкап БД
docker compose exec postgres pg_dump -U postgres crash_game > backup.sql

# Восстановление БД
docker compose exec -T postgres psql -U postgres crash_game < backup.sql

# Вход в БД
docker compose exec postgres psql -U postgres crash_game

# Очистка кэша Redis
docker compose exec redis redis-cli FLUSHALL

# Статус контейнеров
docker compose ps
```

---

## 6. Мониторинг

### Healthcheck

```bash
curl http://localhost:3001/api/health
# {"status":"ok","uptime":12345}
```

### Простой мониторинг через cron

```bash
# Добавить в crontab -e:
*/5 * * * * curl -sf http://localhost:3001/api/health || docker compose -f /opt/crash-game/docker-compose.yml restart server
```

---

## 7. Структура портов

| Сервис     | Порт | Описание                       |
|-----------|------|-------------------------------|
| Nginx     | 80   | HTTP (клиент + прокси)        |
| Nginx     | 443  | HTTPS (если настроен SSL)     |
| API + WS  | 3001 | Express REST API + WebSocket  |
| PostgreSQL| 5432 | База данных (только внутри)   |
| Redis     | 6379 | Кэш/pub-sub (только внутри)  |

> В продакшне порты 3001, 3002, 5432, 6379 должны быть закрыты через firewall. Весь трафик идёт через Nginx на порту 80/443.

### Firewall (UFW)

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

---

## 8. Переменные окружения

| Переменная         | Описание                    | Пример                              |
|--------------------|-----------------------------|--------------------------------------|
| POSTGRES_PASSWORD  | Пароль PostgreSQL            | `openssl rand -hex 16`              |
| JWT_SECRET         | Секрет для access токенов    | `openssl rand -hex 32`              |
| JWT_REFRESH_SECRET | Секрет для refresh токенов   | `openssl rand -hex 32`              |
| CORS_ORIGIN        | Домен клиента               | `https://crash.example.com`          |
| PORT               | Порт API сервера            | `3001`                               |
| WS_PORT            | Порт WebSocket              | `3002`                               |
