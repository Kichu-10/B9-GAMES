# B9 Game — Deployment Package

Everything needed to run the site on your own server.

```
b9game-deploy/
├── DEPLOY.md                  ← this file
├── env.production.example     environment template, copy to .env.local
├── sql/
│   ├── 01-b9game-mysql.sql    MySQL 8 schema + data (for the Laravel backend, later)
│   └── 02-b9game-legacy-sqlite.sql  SQLite schema + data (for the Node backend, now)
├── vue-app/
│   ├── dist/                  production frontend build (ready to serve)
│   ├── server/                Express API source
│   ├── src/                   Vue source (only needed if you rebuild)
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
└── CHECKSUMS.txt              SHA-256 of every file
```

**What runs today:** the Node/Express API plus the prebuilt Vue frontend. That is
the complete, working application.

**What is not in this package:** the Laravel backend. It is mid-migration (only
health, payment-details and platform-settings endpoints exist), so it cannot
serve the site yet. The MySQL dump is included so it is ready when that work
finishes — see the end of this file.

---

## 1. Server requirements

| Item | Version |
| --- | --- |
| Node.js | 22 or newer (24 tested) |
| npm | 10 or newer |
| OS | Ubuntu 22.04/24.04, Debian 12, or similar |
| Web server | nginx (or Apache) for TLS and static files |
| CPU / RAM | 1 vCPU / 1 GB is enough for a small site |
| Disk | 5 GB free (app ~10 MB, uploads, database, backups) |

You need HTTPS. Google Sign-In and secure tokens should not run over plain HTTP.

---

## 2. Upload and unpack

```bash
# on your machine
scp b9game-deploy.zip user@your-server:/tmp/

# on the server
sudo mkdir -p /var/www/b9game
sudo chown "$USER":"$USER" /var/www/b9game
cd /var/www/b9game
unzip /tmp/b9game-deploy.zip
cd vue-app
```

Verify the package arrived intact (optional but recommended):

```bash
cd .. && sha256sum -c CHECKSUMS.txt
```

---

## 3. Install dependencies

```bash
cd /var/www/b9game/vue-app
npm ci --omit=dev
```

`npm ci` installs exactly the versions in `package-lock.json`. Skip `--omit=dev`
if you plan to rebuild the frontend on the server.

---

## 4. Create the environment file

```bash
cp ../env.production.example .env.local
nano .env.local
```

Minimum values you must set:

| Variable | What to put |
| --- | --- |
| `JWT_SECRET` | 32+ random characters. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PASSWORD` | A strong, unique password. Also update `ADMIN_USERNAME` if you want a different login name |
| `SQLITE_PATH` | `/var/www/b9game/data/database.sqlite` (or leave blank to use `server/database.sqlite`) |
| `HUIDU_*` | Your provider credentials |
| `MANUAL_PAYMENT_*` | The real deposit account details your players should see |
| `GOOGLE_CLIENT_ID` | Only if you use Google Sign-In |

The server reads **`.env.local`**, not `.env`. Both are ignored by git.

Create the data directory if you set `SQLITE_PATH` outside the app:

```bash
sudo mkdir -p /var/www/b9game/data
sudo chown "$USER":"$USER" /var/www/b9game/data
```

---

## 5. Restore the database — which SQL file?

Two dumps are provided. **Use the one that matches the backend you run.**

### Option A — Node backend (this package, use this now)

```bash
cd /var/www/b9game/vue-app

# the file in the dump is created at SQLITE_PATH, so point the path at the same place
sqlite3 /var/www/b9game/data/database.sqlite < ../sql/02-b9game-legacy-sqlite.sql
```

If `sqlite3` is not installed:

```bash
sudo apt update && sudo apt install -y sqlite3
```

Check it worked:

```bash
sqlite3 /var/www/b9game/data/database.sqlite \
  "SELECT (SELECT COUNT(*) FROM users) AS users,
          (SELECT COUNT(*) FROM managed_games) AS games,
          (SELECT COUNT(*) FROM game_providers) AS providers;"
```

Expected: **2 users, 96 games, 9 providers**.

The dump includes the schema, all data, and all indexes — it is a complete
rebuild of the database, not just data.

### Option B — MySQL (only for the future Laravel backend)

```bash
sudo mysql -e "CREATE DATABASE b9game CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
sudo mysql -e "CREATE USER 'b9game'@'localhost' IDENTIFIED BY 'strong-password-here';"
sudo mysql -e "GRANT ALL PRIVILEGES ON b9game.* TO 'b9game'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql b9game < ../sql/01-b9game-mysql.sql
```

**Do not import both.** The Node backend uses SQLite; the Laravel backend uses
MySQL. Pointing the Node server at a MySQL dump will not work.

> The MySQL dump was taken before one account (`amit8982`) existed in SQLite.
> When the Laravel backend goes live, re-import from the live SQLite file instead
> of using this dump:
> `php artisan migrate:from-sqlite /path/to/database.sqlite --fresh`

---

## 6. Start the API

### With systemd (recommended)

```bash
sudo tee /etc/systemd/system/b9game.service > /dev/null <<'EOF'
[Unit]
Description=B9 Game API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/b9game/vue-app
EnvironmentFile=/var/www/b9game/vue-app/.env.local
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/b9game.log
StandardError=append:/var/log/b9game.log

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R www-data:www-data /var/www/b9game
sudo systemctl daemon-reload
sudo systemctl enable --now b9game
sudo systemctl status b9game --no-pager
```

> If you use `EnvironmentFile=`, note that Node's `dotenv` reads `.env.local`
> anyway — both working together is fine, but make sure the values match.
> The file must be readable by `www-data`.

### With pm2 (alternative)

```bash
sudo npm install -g pm2
cd /var/www/b9game/vue-app
pm2 start server/index.js --name b9game
pm2 save && pm2 startup
```

### Check it is alive

```bash
curl -s http://127.0.0.1:3001/api/health
# {"ok":true}
```

---

## 7. Serve the site with nginx

The frontend is already built in `vue-app/dist`. nginx serves those files and
forwards `/api/*` and `/uploads/*` to Node.

```bash
sudo tee /etc/nginx/sites-available/b9game > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/b9game/vue-app/dist;
    index index.html;

    client_max_body_size 12M;

    # API and uploaded documents go to Node
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Vue Router history mode: unknown paths fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long cache for hashed assets, no cache for the HTML shell
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/b9game /etc/nginx/sites-enabled/b9game
sudo nginx -t && sudo systemctl reload nginx
```

Then add TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Behind Cloudflare or another proxy

`ADMIN_ALLOWED_IPS` is compared against the address Node sees. If you sit behind
a proxy, that is the proxy's IP, not the admin's. Either leave the allowlist
empty and rely on the JWT + password, or configure the proxy to preserve the
real client address and set the allowlist accordingly.

---

## 8. First-run checklist

Work through this on the live server.

| # | Check | Expected |
| --- | --- | --- |
| 1 | `curl https://your-domain/api/health` | `{"ok":true}` |
| 2 | Open `https://your-domain/` | Home page renders, banner carousel works |
| 3 | `https://your-domain/games` | Game grid, 86 games across 8 enabled providers |
| 4 | `https://your-domain/control-your-private-admin-path` | Admin sign-in screen |
| 5 | Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Dashboard loads |
| 6 | Admin → Games | 9 providers, 96 games, "Provider API configured" |

> **EZUGI is imported but disabled in this dataset.** Its 10 games are stored and
> visible in Admin → Games, but the public catalog only shows enabled providers,
> so the storefront lists 86 games. Enable it in Admin → Games → Providers →
> EZUGI → tick *Enabled* → Save if you want those titles public.
>
> Four WG titles (Fortune Snake, Duo Bao, Candy Party, Treasure Bowl) have no
> artwork — their cards render the game name instead of an image. Upload artwork
> from Admin → Games if you want covers there.
| 7 | Admin → Promotions → Add offer → upload banner | Image preview appears, Save works |
| 8 | Admin → Settings | Announcement and payment details save |
| 9 | Register a test customer account | Sign-in works, wallet page loads |
| 10 | Upload a game thumbnail | Appears on the game card |
| 11 | A KYC or deposit-proof upload | Reachable by admin only |

### Change the admin URL (optional)

The admin route is baked into the frontend at build time. The bundled build uses
`/control-your-private-admin-path`:

```bash
cd /var/www/b9game/vue-app
VITE_ADMIN_PANEL_PATH=/your-new-secret-path npm ci
VITE_ADMIN_PANEL_PATH=/your-new-secret-path npm run build
sudo systemctl restart b9game
```

This is obscurity, not security. The real barriers are the admin password, the
JWT and `ADMIN_ALLOWED_IPS`.

---

## 9. Backups on the server

The app writes a SQLite snapshot at startup and every `DB_BACKUP_INTERVAL_MS`
(default 24 h) into `server/backups/`, keeping the newest
`DB_BACKUP_RETENTION` (default 14).

Also back up **uploads** — database snapshots do not include them.

A simple nightly job:

```bash
sudo tee /etc/cron.daily/b9game-backup > /dev/null <<'EOF'
#!/bin/sh
set -e
STAMP=$(date +%F_%H%M)
DEST=/var/backups/b9game
mkdir -p "$DEST"
sqlite3 /var/www/b9game/data/database.sqlite ".backup '$DEST/db-$STAMP.sqlite'"
tar czf "$DEST/uploads-$STAMP.tar.gz" -C /var/www/b9game/vue-app/server uploads
find "$DEST" -type f -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/b9game-backup
```

Copy `/var/backups/b9game` off the server (object storage, another host, or an
encrypted archive). A backup that lives only on the same disk does not survive a
disk failure.

---

## 10. Updating the site later

```bash
cd /var/www/b9game
# back up first
sqlite3 /var/www/b9game/data/database.sqlite ".backup '/var/backups/b9game/pre-update-$(date +%F).sqlite'"

# replace the application files, keep data
unzip -o /tmp/b9game-deploy-new.zip -d /var/www/b9game-new
rsync -a --exclude 'server/uploads' --exclude 'server/backups' --exclude '.env.local' \
      /var/www/b9game-new/vue-app/ /var/www/b9game/vue-app/

cd /var/www/b9game/vue-app
npm ci --omit=dev
sudo systemctl restart b9game
```

The database file is never touched by a code update.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `{"error":"Internal server error"}` on every API call | `JWT_SECRET` or `ADMIN_PASSWORD` missing in `.env.local`; check `journalctl -u b9game -n 50` |
| Server exits at start with `ADMIN_USERNAME and ADMIN_PASSWORD are required` | Those two variables are empty |
| Admin page is a 404 | URL does not match the built path; use `/control-your-private-admin-path` or rebuild with your own |
| API calls return 404 from nginx | `/api/` and `/uploads/` proxy blocks missing from the nginx config |
| Refreshing `/games` shows nginx 404 | Missing `try_files ... /index.html` fallback |
| Game thumbnails or banners broken | `server/uploads/` not restored, or not writable by the service user |
| `Provider API configured` shows false | `HUIDU_*` variables are incomplete |
| Uploads rejected | File larger than the limit (3 MB artwork, 5 MB KYC/proof) or wrong type |
| Google Sign-In button missing | `GOOGLE_CLIENT_ID` not set, or the domain is not an authorised origin in the OAuth client |
| Admin login says `temporarily locked` | 5 failed attempts → 15-minute lockout; wait or restart after correcting the password in `.env.local` |

Logs:

```bash
sudo journalctl -u b9game -f          # systemd
tail -f /var/log/b9game.log           # if you used the log file above
```

---

## 12. Security notes

- `.env.local` holds every secret. Keep permissions at `600` and never commit it:
  `chmod 600 /var/www/b9game/vue-app/.env.local`
- Uploaded KYC documents and payment proofs live in `server/uploads/` and are
  served only through an authenticated admin endpoint. Do not expose that folder
  directly from nginx.
- Restrict `ADMIN_ALLOWED_IPS` if your admins work from fixed addresses.
- Rotate `ADMIN_PASSWORD`, `JWT_SECRET` and the HUIDU keys if they are ever shared.
- Real-money gaming requires local licensing, age verification and KYC rules.
  Configure and confirm those before opening the site to players.

---

## 13. About the Laravel backend (future)

The migration target is in the source repository under `backend/`, not in this
package. It currently implements:

- `/api/health`, `/api/payment/details`, `/api/platform/settings`
- the full MySQL schema and the SQLite → MySQL importer

It does **not** yet implement authentication, wallet, games or admin routes, so
it cannot replace the Node backend. When those phases land, hosting it needs PHP
8.3+, MySQL 8 and Redis, and the frontend origin/proxy simply points at it
instead — the API paths and JSON shapes are designed to stay identical.

The `sql/01-b9game-mysql.sql` dump is provided so the database is ready for that
step.
