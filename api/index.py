import sys
import os
import traceback
from pathlib import Path

# Add backend and root directories to Python sys.path for Vercel Serverless Functions
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

candidates = [
    str(backend_dir),
    str(root_dir),
    str(Path(__file__).resolve().parent / "backend"),
    str(Path(os.getcwd()) / "backend"),
    str(Path(os.getcwd())),
]

for p in candidates:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.main import app
    handler = app

    @app.get("/api/health")
    @app.get("/health")
    def direct_health():
        import time
        from app.database import ACTIVE_DATABASE_URL
        return {
            "status": "ok",
            "timestamp": time.time(),
            "active_db": ACTIVE_DATABASE_URL.split("@")[-1] if "@" in ACTIVE_DATABASE_URL else "sqlite",
            "is_vercel": bool(os.getenv("VERCEL")),
        }

    @app.get("/api/db-check")
    def db_check():
        import time
        from sqlalchemy import text
        from app.database import engine, ACTIVE_DATABASE_URL
        result = {"active_url": ACTIVE_DATABASE_URL.split("@")[-1] if "@" in ACTIVE_DATABASE_URL else "sqlite"}
        t0 = time.time()
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            result["connection"] = "SUCCESS"
            result["latency_ms"] = round((time.time() - t0) * 1000, 2)
        except Exception as ex:
            result["connection"] = "FAILED"
            result["error"] = str(ex)
            result["latency_ms"] = round((time.time() - t0) * 1000, 2)
        return result
except Exception as e:
    err_type = type(e).__name__
    err_msg = str(e)
    tb = traceback.format_exc()
    print(f"FATAL: Failed to import FastAPI app: {err_type}: {err_msg}\n{tb}", file=sys.stderr)

    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        fallback_app = FastAPI(title="GotoShop Serverless Error Handler")

        @fallback_app.get("/api/health")
        @fallback_app.get("/health")
        @fallback_app.get("/")
        @fallback_app.get("/api/error-info")
        def error_health():
            return {
                "status": "backend_init_error",
                "type": err_type,
                "message": err_msg,
                "traceback": tb.split("\n"),
                "cwd": os.getcwd(),
                "backend_dir": str(backend_dir),
                "backend_exists": backend_dir.exists(),
            }

        @fallback_app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
        async def error_handler(path_name: str = ""):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "BACKEND_INITIALIZATION_ERROR",
                    "message": f"Le serveur n'a pas pu démarrer : {err_type} - {err_msg}",
                    "type": err_type,
                    "traceback": tb.split("\n"),
                    "cwd": os.getcwd(),
                    "sys_path": sys.path,
                    "root_dir_contents": os.listdir(str(root_dir)) if root_dir.exists() else [],
                    "backend_exists": backend_dir.exists(),
                }
            )

        app = fallback_app
        handler = fallback_app
    except Exception as e_fastapi:
        # Emergency raw ASGI application if FastAPI itself failed to import
        async def emergency_asgi_app(scope, receive, send):
            if scope.get("type") == "http":
                body = f'{{"error": "FATAL_SERVERLESS_CRASH", "message": "{err_msg}", "type": "{err_type}"}}'.encode("utf-8")
                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        [b"content-type", b"application/json; charset=utf-8"],
                        [b"content-length", str(len(body)).encode("utf-8")],
                    ],
                })
                await send({
                    "type": "http.response.body",
                    "body": body,
                })

        app = emergency_asgi_app
        handler = emergency_asgi_app
