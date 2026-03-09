import docker
import os
import threading

try:
    from backend.core.config import SANDBOX_TIMEOUT, SANDBOX_MEM_LIMIT, SANDBOX_CPU_QUOTA
except ImportError:
    SANDBOX_TIMEOUT = 120
    SANDBOX_MEM_LIMIT = "512m"
    SANDBOX_CPU_QUOTA = 100000


def _write_script(code: str, data_folder_path: str) -> str:
    """Tulis kode ke _exec_script.py di data folder. Kembalikan path absolut."""
    script_path = os.path.join(os.path.abspath(data_folder_path), "_exec_script.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(code)
    return script_path


def _build_container(client, data_folder_path: str):
    """Buat container sandbox. Kode sudah ditulis ke /app/data/_exec_script.py."""
    absolute_data_path = os.path.abspath(data_folder_path)
    return client.containers.run(
        image="ai-sandbox:latest",
        command=["python", "/app/data/_exec_script.py"],
        network_disabled=True,
        mem_limit=SANDBOX_MEM_LIMIT,
        cpu_quota=SANDBOX_CPU_QUOTA,
        volumes={absolute_data_path: {"bind": "/app/data", "mode": "rw"}},
        working_dir="/app",
        detach=True,
        stderr=True,
        stdout=True,
    )


def stream_ai_code_securely(ai_generated_code: str, data_folder_path: str):
    """
    Generator — yields output lines from the container in real-time.
    Enforces SANDBOX_TIMEOUT by killing the container if it runs too long.
    """
    client = docker.from_env()
    container = None
    timed_out = False
    script_path = None

    try:
        script_path = _write_script(ai_generated_code, data_folder_path)
        container = _build_container(client, data_folder_path)

        def _watchdog(ctr):
            nonlocal timed_out
            import time
            time.sleep(SANDBOX_TIMEOUT)
            timed_out = True
            try:
                ctr.kill()
            except Exception:
                pass

        threading.Thread(target=_watchdog, args=(container,), daemon=True).start()

        for raw_line in container.logs(stream=True, follow=True):
            yield raw_line.decode("utf-8", errors="replace")

        if timed_out:
            yield f"\nError: Timeout — kode memakan waktu lebih dari {SANDBOX_TIMEOUT} detik.\n"
        else:
            try:
                result = container.wait(timeout=10)
                exit_code = result.get("StatusCode", 0)
                if exit_code != 0:
                    yield f"\n[Proses selesai dengan exit code {exit_code}]\n"
            except Exception:
                pass

        container.remove()
        container = None

    except Exception as e:
        yield f"Sistem Sandbox gagal: {str(e)}\n"
    finally:
        if container:
            try:
                container.remove(force=True)
            except Exception:
                pass
        if script_path and os.path.exists(script_path):
            try:
                os.unlink(script_path)
            except Exception:
                pass


def run_ai_code_securely(ai_generated_code: str, data_folder_path: str) -> str:
    """Jalankan kode di sandbox, kembalikan output lengkap sebagai string."""
    return "".join(stream_ai_code_securely(ai_generated_code, data_folder_path))


if __name__ == "__main__":
    test_code = "import os\nprint('Isi folder data:', os.listdir('/app/data'))"
    print("Menguji Sandbox...")
    print(run_ai_code_securely(test_code, "dataset_user"))
