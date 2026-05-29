# AI Data Analyst - Scalable Architecture

## Arsitektur Baru (Queue-Based)

```
Frontend (React)
    ↓
FastAPI (stateless API) ← menerima request, enqueue job
    ↓
Redis Queue (job buffer + event stream)
    ↓
Worker Service (N replicas) ← eksekusi AI job
    ↓
Docker Sandbox (isolated Python execution)
```

## Komponen

- **API Service**: Autentikasi, upload dataset, job management, SSE streaming
- **Worker Service**: Consume queue, jalankan agent pipeline, emit progress
- **Redis**: Job queue + event buffer (replayable SSE)
- **MySQL**: User database
- **MinIO**: Object storage untuk dataset
- **Docker Sandbox**: Container terisolasi untuk eksekusi kode AI

## Quick Start (Development)

### 1. Build Sandbox Image

```bash
docker build -f Dockerfile.sandbox -t ai-sandbox:latest .
```

### 2. Start Infrastructure

```bash
docker-compose up -d mysql redis minio
```

### 3. Setup Environment

Buat file `.env` di root project:

```env
SUMOPOD_API_KEY=your_sumopod_api_key_here
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
SECRET_KEY=your-secret-key-change-in-production
MYSQL_URL=mysql+pymysql://analyst:analyst_password@localhost:3306/ai_analyst
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
AI_PROVIDER=sumopod
MODEL_CHAT=gpt-4o-mini
MODEL_DEEP=gpt-4o
```

### 4. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 5. Run API Server

```bash
uvicorn backend.main:app --reload --port 8000
```

### 6. Run Worker (Terminal Terpisah)

```bash
python -m backend.worker_main
```

### 7. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment Production (Docker Compose)

### Build & Start Semua Service

```bash
docker-compose up --build -d
```

Service yang berjalan:

- `ai_analyst_api` (port 8000)
- `ai_analyst_worker` (background, 1 replica default)
- `ai_analyst_mysql` (port 3306)
- `ai_analyst_redis` (port 6379)
- `ai_analyst_minio` (port 9000 API, 9001 console)

### Scale Worker Horizontal

```bash
docker-compose up -d --scale worker=3
```

### Monitor Logs

```bash
# API logs
docker logs -f ai_analyst_api

# Worker logs (semua replicas)
docker-compose logs -f worker

# Queue depth (via redis-cli)
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs
```

## Cara Kerja Request Flow

1. User kirim question via frontend → `POST /chat/start`
2. API create job, set status `queued`, push payload ke Redis list `queue:jobs`
3. Worker pop job dari queue (blocking `BLPOP`)
4. Worker set status `running`, download files dari MinIO
5. Worker execute `run_agent_stream` atau `run_pro_stream`
6. Setiap event agent disimpan ke Redis (`job:{user_id}:{job_id}:events`)
7. Frontend subscribe SSE `GET /chat/events/{job_id}` (replay + live)
8. Worker upload hasil baru ke MinIO, auto-save history, set status `done`
9. Worker clear active job marker, cleanup temp dir

## Keunggulan vs Arsitektur Lama

| Aspek              | Lama (Thread-based)             | Baru (Queue-based)                    |
| ------------------ | ------------------------------- | ------------------------------------- |
| API Scaling        | ❌ Tidak bisa (state di memory) | ✅ Horizontal (stateless)             |
| Worker Scaling     | ❌ Terbatas `MAX_WORKERS`       | ✅ Unlimited replicas                 |
| Job Persistence    | ❌ Hilang saat restart          | ✅ Survive di Redis                   |
| Resource Isolation | ⚠️ Shared thread pool           | ✅ Dedicated worker process           |
| Failure Handling   | ❌ Job hilang                   | ✅ Retry + dead letter queue (extend) |
| Monitoring         | ⚠️ Sulit                        | ✅ Queue metrics jelas                |

## Konfigurasi Penting

### Limit Concurrency per Worker

Edit `backend/worker_service.py` untuk tambah semaphore:

```python
MAX_CONCURRENT_JOBS = 2  # per worker instance
```

### Job Timeout

Set di `.env`:

```env
SANDBOX_TIMEOUT=180  # detik per tool call
JOB_MAX_TIME=600     # detik total per job (implement di worker)
```

### Redis Memory

Queue + event buffer bisa membengkak jika traffic tinggi:

```bash
# Set maxmemory di docker-compose.yml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## Troubleshooting

### Job Stuck di Queue

```bash
# Cek worker aktif
docker ps | grep worker

# Cek queue depth
docker exec -it ai_analyst_redis redis-cli LLEN queue:jobs

# Manual flush queue (HATI-HATI)
docker exec -it ai_analyst_redis redis-cli DEL queue:jobs
```

### Status Job Tidak Update

```bash
# Cek event log
docker exec -it ai_analyst_redis redis-cli LRANGE "job:{user_id}:{job_id}:events" 0 -1
```

### Worker Crash Loop

```bash
# Check logs detail
docker logs ai_analyst_worker --tail 100

# Debug mode (ganti command di docker-compose.yml)
command: python -u -m backend.worker_main  # unbuffered output
```

## Ekstension Future (Opsional)

1. **Dead Letter Queue**: Job yang fail 3x masuk `queue:jobs:failed`
2. **Priority Queue**: Separate `queue:jobs:high` dan `queue:jobs:normal`
3. **Rate Limiting**: Per-user concurrency limit via Redis counter
4. **Distributed Tracing**: OpenTelemetry untuk visualisasi bottleneck
5. **Worker Autoscaling**: Kubernetes HPA berdasarkan queue depth

## API Endpoint yang Berubah

| Endpoint                    | Perubahan                                               |
| --------------------------- | ------------------------------------------------------- |
| `POST /chat/start`          | Return langsung `{job_id, session_id}` (tidak blocking) |
| `GET /chat/events/{job_id}` | Support query param `from_idx` untuk replay             |
| `GET /chat/job/{job_id}`    | Tambah field `queued: bool` di response                 |
| `POST /chat/stream`         | Legacy endpoint (tetap ada, direct execution)           |
| `POST /chat/pro`            | Legacy endpoint (tetap ada, direct execution)           |

## Frontend Compatibility

Tidak ada perubahan breaking di frontend. Endpoint `/chat/start` + `/chat/events/{job_id}` sudah kompatibel dengan kode sekarang.

## Contact

Untuk issue atau improvement, hubungi maintainer project.
