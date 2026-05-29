import logging
import sys
import time

from backend.core.job_store import dequeue_job, finish_job
from backend.worker_service import JobPayloadError, process_job

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
    
    # Cleanup any orphaned sandbox containers from previous runs
    try:
        from sandbox import cleanup_all_sandboxes
        cleanup_all_sandboxes()
    except Exception as e:
        logger.warning(f"Gagal menjalankan cleanup awal: {e}")

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
            process_job(payload)
            elapsed = time.monotonic() - start
            logger.info(f"✅ Job {job_id} completed successfully in {elapsed:.1f}s")
        except JobPayloadError as exc:
            elapsed = time.monotonic() - start
            # process_job already cleaned up Redis state for invalid payloads.
            logger.error(
                f"❌ Job {job_id} dropped after {elapsed:.1f}s (invalid payload): {exc}"
            )
        except Exception as exc:
            elapsed = time.monotonic() - start
            logger.error(f"❌ Job {job_id} failed after {elapsed:.1f}s: {str(exc)}", exc_info=True)
            # process_job already calls finish_job(error=...) before re-raising,
            # but we keep this defensive call as a fallback in case the failure
            # happened *before* finish_job ran (e.g. import error).
            try:
                if user_id != "unknown" and job_id != "unknown":
                    finish_job(user_id, job_id, error=str(exc))
            except Exception:
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
