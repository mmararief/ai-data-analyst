import logging
import sys
import time

from backend.core.job_store import dequeue_job, finish_job
from backend.worker_service import process_automl_job, process_job

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def _worker_loop() -> None:
    """Single worker loop that blocks on Redis and processes jobs until interrupted."""
    logger.info("=" * 60)
    logger.info("AI Data Analyst Worker Started")
    logger.info("=" * 60)
    logger.info("Connecting to Redis queue...")
    logger.info("Waiting for jobs from queue:jobs...")

    while True:
        payload = dequeue_job(timeout=5)
        if payload is None:
            # Timeout reached, no job available - just continue waiting
            continue

        job_id = payload.get("job_id", "unknown")
        user_id = payload.get("user_id", "unknown")
        question = payload.get("question", "")[:50]

        logger.info(f"📥 Received job {job_id} from user {user_id[:8]}...")
        logger.info(f"   Question: {question}...")

        start = time.monotonic()
        try:
            job_type = payload.get("type", "chat")
            if job_type == "automl_train":
                process_automl_job(payload)
            else:
                process_job(payload)
            elapsed = time.monotonic() - start
            logger.info(f"✅ Job {job_id} completed successfully in {elapsed:.1f}s")
        except Exception as exc:
            elapsed = time.monotonic() - start
            logger.error(f"❌ Job {job_id} failed after {elapsed:.1f}s: {str(exc)}", exc_info=True)
            # Pastikan status job di-update ke error agar frontend mendapat sinyal yang jelas
            try:
                if user_id != "unknown" and job_id != "unknown":
                    finish_job(user_id, job_id, error=str(exc))
            except Exception:
                # Jangan biarkan error status-update mematikan worker loop
                logger.warning("Gagal mengupdate status job setelah error", exc_info=True)


def run_worker_forever() -> None:
    """Run worker loop with crash-restart logic."""
    while True:
        try:
            _worker_loop()
        except KeyboardInterrupt:
            logger.info("\n🛑 Worker stopped by user (Ctrl+C)")
            break
        except Exception as exc:
            logger.error(f"💥 Worker crashed: {str(exc)}", exc_info=True)
            logger.info("🔁 Restarting worker in 5 seconds...")
            time.sleep(5)


if __name__ == "__main__":
    run_worker_forever()
