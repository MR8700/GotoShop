import uvicorn
import os
import sys
import subprocess

def ensure_port_free(port: int = 8000):
    """Frees the port if an old background process is still listening."""
    try:
        current_pid = str(os.getpid())
        res = subprocess.run(f"netstat -aon | findstr :{port} | findstr LISTENING", shell=True, capture_output=True, text=True)
        if res.stdout:
            for line in res.stdout.strip().splitlines():
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid != current_pid and pid != "0":
                        print(f"  [Auto-Clean] Libération du port {port} (Processus PID {pid})...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

if __name__ == "__main__":
    # Add backend directory to sys.path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, backend_dir)

    ensure_port_free(8000)

    print("=" * 60)
    print("  ConversaStore Mobile Engine - Serveur Unifié Fullstack")
    print("  URL Vitrine & Admin : http://localhost:8000")
    print("  Documentation API   : http://localhost:8000/docs")
    print("=" * 60)

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
