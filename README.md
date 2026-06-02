# Analisai — AI Data Analyst

Platform analisis data berbasis AI yang menggunakan **single ReAct agent dengan tool calling** dan **Python sandbox** untuk exploratory data analysis (EDA), preprocessing, visualisasi, profiling, dan ekspor file secara otomatis melalui percakapan natural language.

> Proyek Skripsi — Muhammad Ammar Arief
> *"Pengembangan AI Data Analyst Berbasis Large Language Model untuk Analisis Dataset Otomatis Menggunakan Tool Calling dan Python Sandbox"*

## Fitur Utama

- **Single ReAct Agent** — LangGraph `create_react_agent` dengan 8 tools untuk analisis end-to-end
- **Upload Dataset** — CSV, XLSX, XLS, JSON, Parquet, PKL — disimpan di MinIO per user/project
- **Project Management** — Setiap user memiliki banyak project, masing-masing dengan dataset & session sendiri
- **Chat-based Analysis** — SSE streaming dengan real-time token dan event
- **Python Sandbox** — Isolated Docker container untuk eksekusi kode aman (network disabled, resource limits)
- **Auto Data Profiling** — Generate laporan profiling HTML otomatis
- **Visualisasi** — Matplotlib/seaborn charts, auto-save sebagai PNG
- **File Export** — ipynb, CSV, XLSX, JSON, MD, HTML, TXT, PY
- **Interactive Dashboard** — JSON dashboard schema dengan DuckDB SQL queries, charts, tables, filters
- **SQL Query** — DuckDB-backed SQL langsung pada dataset via endpoint API
- **Download Dataset** — URL publik, Google Sheets, Kaggle
- **Clarification Flow** — Multi-dataset auto-detection dengan dynamic questions
- **Task Widget** — To-do list real-time di UI
- **Notebook Generation** — Konversi chat history ke Jupyter notebook (.ipynb)
- **Session History** — Redis-backed, replayable, per-project
- **Queue-Based Worker** — Redis job queue dengan horizontal scaling
- **Authentication** — JWT (access + refresh tokens), bcrypt, rate limiting
- **Dark/Light Theme** — ThemeContext-based theming

## Arsitektur

```
┌──────────────┐
│   Frontend   │  React 19 + Vite 7 + TailwindCSS 4
│  (Port 5173) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  FastAPI API │  Stateless REST API + SSE streaming
│  (Port 8000) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Redis Queue  │  Job buffer + Event stream + Session store
│  (Port 6379) │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌─────────────┐
│   Worker 1   │◄─────►│    MinIO    │  Object Storage (datasets)
│   Worker 2   │       │ (Port 9000) │
│   Worker N   │       └─────────────┘
└──────┬───────┘
       │                ┌─────────────┐
       └───────────────►│    MySQL    │  User & Project database
                        │ (Port 3306) │
                        └─────────────┘
```

### Agent Pipeline (Single ReAct Agent)

```
User Input → [LLM (SumoPod/Ollama)] → Tool Calling Loop → Response
                │
                ├─ read_data_tool        — inspect dataset structure
                ├─ python_repl_tool      — execute Python/Pandas code in sandbox
                ├─ render_chart_tool     — matplotlib/seaborn visualizations
                ├─ data_profile_tool     — generate HTML profiling report
                ├─ file_export_tool      — export to ipynb/csv/xlsx/json/etc.
                ├─ bash_tool             — shell commands (ls, mv, cp, etc.)
                ├─ download_dataset_tool — download from URL/Google Sheets/Kaggle
                └─ update_task_list_tool — update UI task widget
```

## Tech Stack

### Backend
| Library | Versi |
|---|---|
| **FastAPI** | 0.115.6 |
| **LangChain Core** | 0.3.28 |
| **LangChain OpenAI** | 0.2.14 |
| **LangChain Ollama** | 0.2.2 |
| **LangGraph** | 0.2.60 |
| **SQLAlchemy** | 2.0.36 |
| **Redis** | 5.2.1 |
| **MinIO** | 7.2.13 |
| **Docker SDK** | 7.1.0 |
| **DuckDB** | 1.1.3 |
| **pandas** | 2.2.3 |

### Frontend
| Library | Versi |
|---|---|
| **React** | 19.x |
| **Vite** | 7.x |
| **TailwindCSS** | 4.x |
| **AG Grid** | 35.x |
| **Chart.js** | 4.5.x |
| **React Router** | 7.x |
| **Framer Motion** | 12.x |
| **Mermaid** | 11.x |

### Infrastructure (Docker)
| Service | Image |
|---|---|
| **MySQL** | mysql:8.0 |
| **Redis** | redis:7-alpine |
| **MinIO** | minio/minio:latest |
| **Sandbox** | python:3.10-slim (kustom) |
| **Nginx** | nginx:stable (reverse proxy) |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.10+
- API Key (SumoPod atau Ollama)

### 1. Clone & Setup

```bash
git clone https://github.com/yourusername/ai-data-analyst.git
cd ai-data-analyst
```

### 2. Environment Variables

Buat file `.env` di root project:

```env
# App
APP_ENV=development
SECRET_KEY=replace-with-a-strong-secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:80

# AI Provider
AI_PROVIDER=sumopod
SUMOPOD_API_KEY=your-sumopod-api-key
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
MODEL_CHAT=gpt-4o-mini

# Database
MYSQL_ROOT_PASSWORD=root_password
MYSQL_DATABASE=ai_analyst
MYSQL_USER=analyst
MYSQL_PASSWORD=analyst_password
MYSQL_URL=mysql+pymysql://analyst:analyst_password@localhost:3306/ai_analyst

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=ai-datasets
MINIO_SECURE=false

# Sandbox
SANDBOX_TIMEOUT=120
SANDBOX_MEM_LIMIT=512m
SANDBOX_CPU_QUOTA=100000

# Limits
MAX_UPLOAD_MB=25
MAX_UPLOAD_FILES=20
CHAT_MAX_WORKERS=4
MAX_HISTORY_MESSAGES=10
```

### 3. Build Docker Images

```bash
docker build -f Dockerfile.sandbox -t ai-sandbox:latest .
docker-compose build
```

### 4. Start Services

#### Production
```bash
docker-compose up -d --scale worker=3
```

- API: http://localhost:8000
- Frontend: http://localhost:80
- MinIO Console: http://localhost:9001

#### Development

**Terminal 1 — Infrastructure:**
```bash
docker-compose up -d mysql redis minio
```

**Terminal 2 — Backend:**
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

**Terminal 3 — Worker:**
```bash
python -m backend.worker_main
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Akses: http://localhost:5173

### 5. Create Account & Mulai

1. Buka aplikasi, klik **Register**
2. Buat akun, login
3. Buat project baru
4. Upload dataset (CSV/Excel/JSON/Parquet)
5. Mulai chat analisis

## Cara Penggunaan

### Upload Dataset
Sidebar → Upload Dataset → Drop file atau browse → Tunggu selesai

### Analisis Data
Mulai percakapan dengan AI, contoh:

- "Lakukan EDA lengkap pada dataset ini"
- "Buat visualisasi distribusi setiap kolom numerik"
- "Analisis korelasi antar variabel dan berikan insight"
- "Buat laporan profiling data"
- "Ekspor hasil analisis ke file Excel"
- "Buat dashboard interaktif dengan filter dan chart"

### Multi-Dataset
Jika ada banyak dataset, AI akan otomatis menanyakan dataset mana yang ingin dianalisis.

### SQL Query
Gunakan endpoint `/datasets/{project_id}/query` dengan DuckDB SQL.

## Project Structure

```
ai-data-analyst/
├── backend/
│   ├── agent/                  # ReAct agent, LLM client, prompts, tools
│   │   ├── pipeline.py        # Single-agent orchestrator
│   │   ├── llm.py             # LLM client (SumoPod/Ollama), retry
│   │   ├── prompts.py         # System prompts
│   │   ├── tools.py           # 8 tool definitions + create_react_agent
│   │   └── utils.py           # Helpers, regex, schema
│   ├── core/                   # Config, database, security, stores
│   │   ├── config.py          # Environment config
│   │   ├── database.py        # SQLAlchemy models
│   │   ├── security.py        # JWT auth
│   │   ├── job_store.py       # Redis job queue
│   │   ├── redis_store.py     # Session history
│   │   └── minio_store.py     # MinIO object storage
│   ├── models/                 # Pydantic models
│   ├── routers/                # API endpoints
│   │   ├── auth.py            # Register, login, refresh
│   │   ├── projects.py        # CRUD projects
│   │   ├── datasets.py        # Upload, download, preview, query
│   │   ├── chat.py            # Start analysis, SSE events, cancel
│   │   ├── notebook.py        # Generate Jupyter notebook
│   │   └── history.py         # Session CRUD
│   ├── main.py                # FastAPI app
│   ├── worker_main.py         # Worker entry point
│   └── worker_service.py      # Job processing
├── frontend/
│   ├── src/
│   │   ├── pages/             # HomePage, AuthPage, DashboardPage, ChatPage
│   │   ├── components/        # UI components (chat/, sidebar, etc.)
│   │   ├── hooks/             # useChatStream (SSE + state management)
│   │   ├── utils/             # Helpers, PDF export
│   │   ├── api.js             # Axios with JWT interceptor
│   │   └── ThemeContext.jsx   # Dark/light theme
│   ├── package.json
│   └── vite.config.js
├── sandbox.py                 # Docker sandbox (stateful kernel-loop)
├── datasets/                  # Temporary dataset storage (gitignored)
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.sandbox
├── nginx-proxy.conf
├── tests/
└── Skripsi/                   # Thesis materials
```

## Scaling & Monitoring

### Horizontal Scaling
```bash
docker-compose up -d --scale worker=5
```

### Monitoring Queue
```bash
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs
docker exec -it ai_analyst_redis redis-cli KEYS "job:*:status"
```

### Logs
```bash
docker-compose logs -f worker
docker logs -f ai_analyst_api
```

## Security

- **JWT Authentication** — Access + refresh tokens
- **Password Hashing** — bcrypt
- **Docker Sandbox** — Isolated, network disabled, resource limits
- **Rate Limiting** — slowapi
- **CORS** — Configurable allowed origins
- **SQL Injection Protection** — SQLAlchemy ORM + DuckDB parameterized queries
- **Code Validation** — Blocked dangerous patterns (os.system, subprocess, etc.)

## Troubleshooting

### Worker Tidak Memproses Jobs
```bash
docker-compose ps worker
docker exec -it ai_analyst_redis redis-cli ping
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs
```

### Sandbox Error
```bash
docker logs ai-data-analyst-sandbox-1
# Pastikan image ai-sandbox:latest sudah dibuild
```

### Frontend Cannot Connect
```bash
curl http://localhost:8000/health
# Cek VITE_API_URL di frontend
# Cek CORS settings
```

## License

MIT License — see LICENSE file.

## Author

**Muhammad Ammar Arief**  
Skripsi — Pengembangan AI Data Analyst Berbasis Large Language Model untuk Analisis Dataset Otomatis Menggunakan Tool Calling dan Python Sandbox

---

Made with ❤️ using AI agents
