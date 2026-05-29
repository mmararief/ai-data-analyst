import docker
import os
import threading
import time
import json
import logging

logger = logging.getLogger(__name__)

try:
    from backend.core.config import SANDBOX_TIMEOUT, SANDBOX_MEM_LIMIT, SANDBOX_CPU_QUOTA
except ImportError:
    SANDBOX_TIMEOUT = 120
    SANDBOX_MEM_LIMIT = "512m"
    SANDBOX_CPU_QUOTA = 100000

_active_containers = {}
_sandbox_locks = {}

def _get_lock(absolute_data_path):
    if absolute_data_path not in _sandbox_locks:
        _sandbox_locks[absolute_data_path] = threading.Lock()
    return _sandbox_locks[absolute_data_path]

KERNEL_LOOP_CODE = """
import os
import time
import sys
import json
import traceback
import io
import contextlib

data_dir = "/app/data"
req_file = os.path.join(data_dir, "_req.json")
res_file = os.path.join(data_dir, "_res.json")
stop_file = os.path.join(data_dir, "_stop.txt")

global_ctx = {}

def main():
    if os.path.exists(res_file): os.remove(res_file)
    if os.path.exists(req_file): os.remove(req_file)
    if os.path.exists(stop_file): os.remove(stop_file)

    last_active = time.time()
    
    while True:
        # Auto-exit if idle for 10 minutes to prevent zombie containers (nyampah)
        if time.time() - last_active > 600:
            break
            
        if os.path.exists(stop_file):
            break
            
        if os.path.exists(req_file):
            last_active = time.time()
            try:
                with open(req_file, "r", encoding="utf-8") as f:
                    req = json.load(f)
            except Exception:
                time.sleep(0.05)
                continue
                
            code = req.get("code", "")
            
            stdout_cap = io.StringIO()
            stderr_cap = io.StringIO()
            status = "success"
            
            try:
                with contextlib.redirect_stdout(stdout_cap), contextlib.redirect_stderr(stderr_cap):
                    exec(code, global_ctx)
            except Exception:
                stderr_cap.write(traceback.format_exc())
                status = "error"
                
            res = {
                "status": status,
                "stdout": stdout_cap.getvalue(),
                "stderr": stderr_cap.getvalue()
            }
            
            with open(res_file, "w", encoding="utf-8") as f:
                json.dump(res, f)
                
            try:
                os.remove(req_file)
            except Exception:
                pass
            
        time.sleep(0.05)

if __name__ == '__main__':
    main()
"""

def _ensure_sandbox_started(data_folder_path: str):
    absolute_data_path = os.path.abspath(data_folder_path)
    os.makedirs(absolute_data_path, exist_ok=True)
    if absolute_data_path in _active_containers:
        return _active_containers[absolute_data_path]
        
    client = docker.from_env()
    
    script_path = os.path.join(absolute_data_path, "_kernel_loop.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(KERNEL_LOOP_CODE)
        
    # Create unique name based on directory
    container_name = f"ai-sandbox-{os.path.basename(absolute_data_path)}"
    
    # Try to cleanup any old container with the same name just in case
    try:
        old = client.containers.get(container_name)
        old.remove(force=True)
    except Exception:
        pass
        
    container = client.containers.run(
        image="ai-sandbox:latest",
        name=container_name,
        command=["python", "/app/data/_kernel_loop.py"],
        network_disabled=True,
        mem_limit=SANDBOX_MEM_LIMIT,
        cpu_quota=SANDBOX_CPU_QUOTA,
        volumes={absolute_data_path: {"bind": "/app/data", "mode": "rw"}},
        working_dir="/app",
        detach=True,
        auto_remove=True,  # Docker will automatically clean it up when process exits
    )
    
    _active_containers[absolute_data_path] = container
    time.sleep(0.5)
    return container

def cleanup_sandbox(data_folder_path: str):
    absolute_data_path = os.path.abspath(data_folder_path)
    container = _active_containers.pop(absolute_data_path, None)
    _sandbox_locks.pop(absolute_data_path, None)
    
    stop_file = os.path.join(absolute_data_path, "_stop.txt")
    try:
        with open(stop_file, "w") as f:
            f.write("stop")
    except Exception:
        pass
        
    if container:
        try:
            container.remove(force=True)
        except Exception:
            pass

def cleanup_all_sandboxes():
    """Remove all ai-sandbox containers created by this backend."""
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True, filters={"ancestor": "ai-sandbox:latest"})
        for container in containers:
            try:
                container.remove(force=True)
                logger.info(f"🧹 Removed orphaned sandbox container: {container.name}")
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Gagal membersihkan orphan sandboxes: {e}")


def stream_ai_code_securely(ai_generated_code: str, data_folder_path: str):
    absolute_data_path = os.path.abspath(data_folder_path)
    lock = _get_lock(absolute_data_path)
    
    with lock:
        try:
            _ensure_sandbox_started(absolute_data_path)
            
            req_file = os.path.join(absolute_data_path, "_req.json")
            res_file = os.path.join(absolute_data_path, "_res.json")
            
            if os.path.exists(res_file):
                try:
                    os.remove(res_file)
                except Exception:
                    pass
                
            req_data = {"code": ai_generated_code}
            with open(req_file, "w", encoding="utf-8") as f:
                json.dump(req_data, f)
                
            start_time = time.time()
            timeout = SANDBOX_TIMEOUT
            
            while True:
                if time.time() - start_time > timeout:
                    yield f"\nError: Timeout — kode memakan waktu lebih dari {timeout} detik.\n"
                    break
                    
                if os.path.exists(res_file):
                    try:
                        with open(res_file, "r", encoding="utf-8") as f:
                            res = json.load(f)
                        
                        if res.get("stdout"):
                            yield res["stdout"]
                        if res.get("stderr"):
                            yield res["stderr"]
                            
                        os.remove(res_file)
                        break
                    except Exception:
                        pass
                        
                time.sleep(0.1)
                
        except Exception as e:
            yield f"Sistem Sandbox gagal: {str(e)}\n"

def run_ai_code_securely(ai_generated_code: str, data_folder_path: str) -> str:
    return "".join(stream_ai_code_securely(ai_generated_code, data_folder_path))

if __name__ == "__main__":
    test_code = "import os\nx = 5\nprint('Hello Stateful Sandbox!')"
    print("Menguji Sandbox...")
    print(run_ai_code_securely(test_code, "dataset_user"))
    print(run_ai_code_securely("print(x * 2)", "dataset_user"))
    cleanup_sandbox("dataset_user")
