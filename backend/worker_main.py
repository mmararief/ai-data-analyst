import logging
import sys
import time

from backend.core.job_store import dequeue_job
from backend.worker_service import process_job

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def run_worker_forever() -> None:
    """Continuously consume queued jobs from Redis and process them."""
    logger.info("=" * 60)
    logger.info("AI Data Analyst Worker Started")
    logger.info("=" * 60)
    logger.info("Connecting to Redis queue...")
    
    try:
        # Test Redis connection by attempting first dequeue
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
            
            try:
                process_job(payload)
                logger.info(f"✅ Job {job_id} completed successfully")
            except Exception as exc:
                logger.error(f"❌ Job {job_id} failed: {str(exc)}", exc_info=True)
                time.sleep(0.2)
                
    except KeyboardInterrupt:
        logger.info("\n🛑 Worker stopped by user (Ctrl+C)")
    except Exception as exc:
        logger.error(f"💥 Worker crashed: {str(exc)}", exc_info=True)
        raise


if __name__ == "__main__":
    run_worker_forever()
