# 🤖 AI Data Analyst

Platform analisis data berbasis AI yang menggunakan multi-agent orchestration untuk exploratory data analysis (EDA), preprocessing, dan visualisasi data secara otomatis.

## ✨ Fitur Utama

- 🎯 **Multi-Agent AI System** - Planner, Execution, dan Insight agents bekerja secara terkoordinasi
- 📊 **Analisis Data Otomatis** - EDA, preprocessing, model training & evaluation
- 📈 **Visualisasi Interaktif** - Chart generation dengan matplotlib & seaborn
- 🎨 **Streamlit Dashboard** - Auto-generate dashboard interaktif dari analisis
- 🔄 **Parallel Execution** - Phase-based task parallelism untuk performa optimal
- ⚡ **Scalable Architecture** - Queue-based worker system dengan horizontal scaling
- 💾 **Session Management** - Riwayat chat tersimpan dengan replay capability
- 🐳 **Docker Sandbox** - Isolated Python code execution untuk keamanan
- 🔐 **Authentication** - JWT-based user authentication & authorization

## 🏗️ Arsitektur

```
┌──────────────┐
│   Frontend   │  React + Vite + TailwindCSS
│  (Port 5173) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  FastAPI API │  Stateless REST API + SSE
│  (Port 8000) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Redis Queue  │  Job buffer + Event stream
│  (Port 6379) │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌─────────────┐
│   Worker 1   │◄─────►│   MinIO     │  Object Storage
│   Worker 2   │       │ (Port 9000) │
│   Worker N   │       └─────────────┘
└──────┬───────┘
       │                ┌─────────────┐
       └───────────────►│    MySQL    │  User Database
                        │ (Port 3306) │
                        └─────────────┘
```

### Mode Operasi

#### Normal Mode (3-Agent Pipeline)

- **Planner Agent** (MODEL_CHAT) - Breakdown pertanyaan user menjadi task list
- **Execution Agent** (MODEL_CHAT) - Eksekusi Python code untuk analisis & visualisasi
- **Insight Agent** (MODEL_CHAT) - Interpretasi hasil & kesimpulan

#### Pro Mode (4-Agent Pipeline)

- **Planner Agent** (MODEL_DEEP) - Task planning dengan reasoning mendalam
- **Data Retrieval Agent** (MODEL_CHAT) - Load & explore dataset
- **Analysis/Code Agent** (MODEL_CHAT) - Statistical analysis & ML modeling
- **Insight/Report Agent** (MODEL_DEEP) - Comprehensive insights & recommendations

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (untuk development frontend)
- Python 3.10+ (untuk development backend)
- SumoPod API Key

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/ai-data-analyst.git
cd ai-data-analyst
```

### 2. Setup Environment Variables

Buat file `.env` di root project:

```env
# SumoPod API
SUMOPOD_API_KEY=your_sumopod_api_key_here
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1

# Security
SECRET_KEY=your-super-secret-key-change-in-production

# Database
MYSQL_URL=mysql+pymysql://analyst:analyst_password@localhost:3306/ai_analyst
MYSQL_ROOT_PASSWORD=root_password
MYSQL_USER=analyst
MYSQL_PASSWORD=analyst_password
MYSQL_DATABASE=ai_analyst

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO (Object Storage)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=ai-datasets

# AI Models
AI_PROVIDER=sumopod
MODEL_CHAT=gpt-4o-mini
MODEL_DEEP=gpt-4o

# Sandbox Limits
SANDBOX_TIMEOUT=120
SANDBOX_MEM_LIMIT=512m
SANDBOX_CPU_QUOTA=100000
```

### 3. Build Docker Images

```bash
# Build sandbox image untuk isolated code execution
docker build -f Dockerfile.sandbox -t ai-sandbox:latest .

# Build backend image
docker-compose build
```

### 4. Start Services

#### Production (All-in-one)

```bash
docker-compose up -d --scale worker=3
```

Services yang berjalan:

- API Server: http://localhost:8000
- Frontend: http://localhost:80
- MinIO Console: http://localhost:9001
- 3 Worker replicas untuk concurrent processing

#### Development

**Terminal 1 - Infrastructure:**

```bash
docker-compose up -d mysql redis minio
```

**Terminal 2 - Backend API:**

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

**Terminal 3 - Worker (atau lebih untuk concurrent):**

```bash
python -m backend.worker_main
```

**Terminal 4 - Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Akses aplikasi di: http://localhost:5173

### 5. Create First Account

1. Buka aplikasi di browser
2. Klik **Register** di halaman login
3. Buat akun dengan email & password
4. Login dengan kredensial yang baru dibuat

## 📖 Cara Penggunaan

### Upload Dataset

1. Di sidebar, klik **Upload Dataset**
2. Drop file CSV/Excel atau klik untuk browse
3. Tunggu hingga upload selesai

### Mulai Analisis

**Mode Normal:**

```
Buat analisis pada dataset tersebut
```

**Mode Pro (prefix dengan "pro:"):**

```
pro: Analisis mendalam dataset dengan insight bisnis
```

**Minta Streamlit Dashboard:**

```
Buat dashboard interaktif dengan Streamlit untuk visualisasi data
```

### Contoh Pertanyaan

- "Lakukan EDA lengkap pada dataset ini"
- "Buat model prediksi untuk kolom target_column"
- "Analisis korelasi antar variabel dan berikan insight"
- "pro: Identifikasi pattern tersembunyi dan anomali dalam data"
- "Buat dashboard Streamlit dengan visualisasi interaktif dan filter"

## 🔧 Scaling & Monitoring

### Horizontal Scaling

Scale worker untuk handle multiple concurrent jobs:

```bash
# Scale to 5 workers
docker-compose up -d --scale worker=5

# Check worker status
docker-compose ps worker

# View worker logs
docker-compose logs -f worker
```

### Monitoring Queue

```bash
# Check current queue depth
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs

# Monitor active jobs
docker exec -it ai_analyst_redis redis-cli KEYS "job:*:status"

# View specific job events
docker exec -it ai_analyst_redis redis-cli LRANGE job:user123:job456:events 0 -1
```

### View Logs

```bash
# API logs
docker logs -f ai_analyst_api

# All workers
docker-compose logs -f worker

# Specific worker
docker logs -f ai-data-analyst-worker-1

# Follow all services
docker-compose logs -f
```

## 🛠️ Tech Stack

### Backend

- **FastAPI** - Modern async web framework
- **LangChain** - AI agent orchestration framework
- **LangGraph** - Multi-agent workflow management
- **SumoPod** - Large Language Models
- **Redis** - Job queue & event streaming
- **MySQL** - User authentication database
- **MinIO** - S3-compatible object storage
- **Docker SDK** - Sandbox container management

### Frontend

- **React** - UI library
- **Vite** - Build tool & dev server
- **TailwindCSS** - Utility-first CSS
- **Axios** - HTTP client
- **EventSource** - SSE for real-time updates

### Data Science Libraries

- **pandas** - Data manipulation
- **numpy** - Numerical computing
- **matplotlib** - Plotting
- **seaborn** - Statistical visualization
- **plotly** - Interactive charts
- **statsmodels** - Statistical modeling

## 📁 Project Structure

```
ai-data-analyst/
├── backend/                    # FastAPI backend
│   ├── core/                  # Core modules (config, database, stores)
│   ├── models/                # SQLAlchemy models
│   ├── routers/               # API endpoints
│   ├── agent_runner.py        # Multi-agent orchestration
│   ├── worker_main.py         # Worker entry point
│   ├── worker_service.py      # Job processing logic
│   └── requirements.txt       # Python dependencies
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   └── api.js            # API client
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configuration
├── datasets/                   # User-uploaded datasets (gitignored)
├── docker-compose.yml         # Docker services orchestration
├── Dockerfile.backend         # Backend image
├── Dockerfile.sandbox         # Isolated Python sandbox
├── .env                       # Environment variables (gitignored)
├── .gitignore                # Git ignore rules
└── README.md                  # This file
```

## 🔒 Security

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt for password storage
- **Docker Sandbox** - Isolated code execution dengan resource limits
- **Environment Variables** - Sensitive data via .env
- **CORS Configuration** - Configureable allowed origins
- **SQL Injection Protection** - SQLAlchemy ORM

## 🐛 Troubleshooting

### API Container Keeps Restarting

```bash
# Check logs
docker logs ai_analyst_api

# Common issue: Missing dependencies
docker-compose up --build -d
```

### Worker Not Processing Jobs

```bash
# Check if worker is running
docker-compose ps worker

# Verify Redis connection
docker exec -it ai_analyst_redis redis-cli ping

# Check queue
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs
```

### Frontend Cannot Connect to Backend

1. Pastikan API running: `docker-compose ps api`
2. Test endpoint: `curl http://localhost:8000/`
3. Check CORS settings di `backend/main.py`
4. Verify `VITE_API_URL` di frontend

### Out of Memory Errors

1. Increase Docker resources di Docker Desktop
2. Adjust `SANDBOX_MEM_LIMIT` di .env
3. Reduce concurrent workers: `docker-compose up -d --scale worker=2`

## 📊 Performance Tips

- **Worker Scaling**: Start dengan 3 workers, scale berdasarkan load
- **Redis Memory**: Set `maxmemory` policy di redis.conf untuk production
- **Database**: Use connection pooling (`pool_size=10` di SQLAlchemy)
- **MinIO**: Configure bucket lifecycle policies untuk cleanup otomatis
- **Frontend**: Build production bundle: `npm run build`

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- SumoPod API for powerful language models
- LangChain & LangGraph teams for agent frameworks
- FastAPI for excellent async Python framework
- Open source community for amazing libraries

## 📧 Contact

- **Author**: Your Name
- **Email**: your.email@example.com
- **GitHub**: [@yourusername](https://github.com/yourusername)
- **Project Link**: [https://github.com/yourusername/ai-data-analyst](https://github.com/yourusername/ai-data-analyst)

---

Made with ❤️ using AI agents
