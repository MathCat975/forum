<div align="center">
  <h1 align="center">Meow Forum</h1>
  <p align="center">
    A lightweight, self-contained forum application built with Go and vanilla JS, featuring a retro terminal aesthetic.
      <br />
    <br />
    <a href="https://github.com/MathCat975/forum/issues">⚠️ Report Bug</a>
    ·
    <a href="https://github.com/MathCat975/forum/issues">💡 Request Feature</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/backend-Go-00ADD8?style=for-the-badge&labelColor=000000" />
    <img src="https://img.shields.io/badge/database-SQLite-003B57?style=for-the-badge&labelColor=000000" />
    <img src="https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-F7DF1E?style=for-the-badge&labelColor=000000" />
    <img src="https://img.shields.io/badge/deploy-Docker-2496ED?style=for-the-badge&labelColor=000000" />
  </p>
  <p align="center">
    <img src="./Projet/FrontEnd/assets/img/index.png" alt="Meow Forum preview" />
  </p>
</div>

---

### 🔍 Overview

**Meow Forum** is a full-stack forum web application with a terminal/protocol-inspired UI. Users can create posts, comment, vote, and manage their profiles. It supports OAuth login via GitHub and Google alongside classic email/password authentication.

The backend is written in **Go** with a **custom-built ORM** (no GORM), using **SQLite** as the database. The frontend is pure **vanilla HTML/CSS/JavaScript** — no frameworks.

### ✨ Features

- **Custom ORM**: Hand-built database layer with auto-migration, query builder, and struct-tag-based schema definition.
- **Authentication**: JWT tokens stored in HTTP-only cookies, bcrypt password hashing, OAuth2 (GitHub & Google).
- **Forum core**: Create posts, comment, like/dislike with per-user vote tracking, search, and category filtering.
- **User profiles**: Editable avatars and banners, linked OAuth accounts, post history.
- **Admin panel**: User role management (user/admin/banned), account deletion.
- **Rate limiting**: Per-IP and per-user rate limits on all sensitive endpoints.
- **Image uploads**: Local file storage served via a built-in CDN endpoint (`/api/cdn/*`).
- **Docker-ready**: Multi-stage Docker build for lightweight production images.

---

### 🏗️ Architecture

```
forum/
├── Projet/
│   ├── BackEnd/               # Go backend
│   │   ├── main.go            # Entry point & route definitions
│   │   └── pkg/
│   │       ├── auth/          # JWT generation, validation & middleware
│   │       ├── db/            # Custom ORM (SQLite, auto-migrate, query builder)
│   │       ├── oauth/         # OAuth2 providers config (GitHub, Google)
│   │       ├── ratelimit/     # Per-IP & per-user rate limiting
│   │       ├── routes/
│   │       │   ├── api/       # REST API handlers (users, posts, admin, upload…)
│   │       │   └── front/     # Serves HTML pages
│   │       └── structs/       # Data models (User, Post, Message, Vote, OAuth)
│   └── FrontEnd/
│       ├── templates/         # HTML pages (index, login, profile, post, admin…)
│       └── assets/
│           ├── css/           # Stylesheets (theme, layout, components)
│           ├── js/            # Client-side logic (API client, auth, views)
│           └── img/           # Icons, logos, profile assets
├── uploads/                   # User-uploaded images (runtime)
├── database.db                # SQLite database file (runtime)
├── Dockerfile                 # Multi-stage Go build
├── docker-compose.yml         # Container orchestration
└── .env.example               # Environment variable template
```

**Key design decisions:**
- **No external ORM** — the database layer is entirely custom-built, supporting auto-migration from Go struct tags, a fluent query builder, and nullable fields.
- **No frontend framework** — all pages are server-rendered HTML with vanilla JS calling the REST API.
- **SQLite** — zero-config, single-file database with WAL mode for concurrent reads.

---

### ⚙️ Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for signing JWT tokens | *(required)* |
| `JWT_EXPIRY_HOURS` | Token expiry duration in hours | `72` |
| `FRONTEND_URL` | Base URL of the frontend | `http://localhost:3000` |
| `OAUTH_PENDING_SECRET` | Secret for OAuth pending state encryption | *(required)* |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | *(optional)* |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | *(optional)* |
| `GITHUB_REDIRECT_URL` | GitHub OAuth callback URL | `http://localhost:8080/api/auth/github/callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID | *(optional)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret | *(optional)* |
| `GOOGLE_REDIRECT_URL` | Google OAuth callback URL | `http://localhost:8080/api/auth/google/callback` |
| `COOKIE_SECURE` | Set to `false` for local dev (HTTP) | `true` |

> OAuth variables are optional — the forum works with email/password auth alone.

---

### 🚀 Installation and Usage

#### Option 1 — Docker (recommended)

1. Clone the repository:

   ```bash
   git clone https://github.com/MathCat975/forum.git
   cd forum
   ```

2. *(Optional)* Set your OAuth credentials as environment variables or edit `docker-compose.yml`:

   ```bash
   export GITHUB_CLIENT_ID=your_id
   export GITHUB_CLIENT_SECRET=your_secret
   export GOOGLE_CLIENT_ID=your_id
   export GOOGLE_CLIENT_SECRET=your_secret
   ```

3. Build and start:

   ```bash
   docker-compose up --build
   ```

4. Open [http://localhost:8080/index](http://localhost:8080/index) in your browser.

> The `docker-compose.yml` provides default JWT and OAuth secrets suitable for local development. **Change them in production.**

#### Option 2 — Run from source

**Prerequisites:**
- Go 1.24+
- GCC (required for SQLite via CGO)
  - **Windows**: Install [MinGW-w64](https://www.mingw-w64.org/) or [TDM-GCC](https://jmeubank.github.io/tdm-gcc/)
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt install gcc` (or equivalent)

1. Clone and navigate to the backend:

   ```bash
   git clone https://github.com/MathCat975/forum.git
   cd forum/Projet/BackEnd
   ```

2. Copy and configure environment variables:

   ```bash
   cp ../../.env.example .env
   # Edit .env with your values
   ```

3. Enable CGO and build:

   ```bash
   # Linux / macOS
   CGO_ENABLED=1 go build -o forum .

   # Windows (PowerShell)
   $env:CGO_ENABLED="1"
   go build -o forum.exe .
   ```

4. Run the server:

   ```bash
   # Linux / macOS
   ./forum

   # Windows
   .\forum.exe
   ```

5. Open [http://localhost:8080/index](http://localhost:8080/index) in your browser.

---

### 📖 API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Register a new account |
| `POST` | `/api/login` | Log in with email/password |
| `POST` | `/api/logout` | Log out |
| `GET` | `/api/auth/github` | Start GitHub OAuth flow |
| `GET` | `/api/auth/google` | Start Google OAuth flow |
| `GET` | `/api/user/me` | Get current authenticated user |
| `GET` | `/api/user/profile` | Get user profile |
| `POST` | `/api/user` | Edit user profile |
| `GET/POST` | `/api/posts` | Get or create posts |
| `GET` | `/api/posts/list` | List posts by category |
| `POST` | `/api/posts/reply` | Add a comment |
| `POST` | `/api/posts/vote` | Like/dislike a post |
| `GET` | `/api/categories` | List categories |
| `GET` | `/api/search` | Search posts |
| `POST` | `/api/upload` | Upload an image |
| `GET` | `/api/admin/users` | List users (admin) |
| `POST` | `/api/admin/users/role` | Change user role (admin) |

### 📜 License

This project is licensed under the **MIT License**. See `LICENSE` for details.
