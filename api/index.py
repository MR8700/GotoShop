import sys
import os
import traceback
from pathlib import Path

# Add backend and root directories to Python sys.path for Vercel Serverless Functions
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for p in [str(backend_dir), str(root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.main import app
    handler = app
except Exception as e:
    err_type = type(e).__name__
    err_msg = str(e)
    tb = traceback.format_exc()
    print(f"FATAL: Failed to import FastAPI app: {err_type}: {err_msg}\n{tb}")

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    fallback_app = FastAPI(title="GotoShop Serverless Error Handler")

    @fallback_app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def error_handler(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "BACKEND_INITIALIZATION_ERROR",
                "message": f"Le serveur n'a pas pu démarrer : {err_type} - {err_msg}",
                "type": err_type,
                "traceback": tb,
                "cwd": os.getcwd(),
                "sys_path": sys.path,
                "root_dir_contents": os.listdir(str(root_dir)) if root_dir.exists() else [],
                "backend_exists": backend_dir.exists(),
            }
        )

    handler = fallback_app
