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
except Exception as e:
    err_type = type(e).__name__
    err_msg = str(e)
    tb = traceback.format_exc()
    print(f"FATAL: Failed to import FastAPI app: {err_type}: {err_msg}\n{tb}", file=sys.stderr)

    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        fallback_app = FastAPI(title="GotoShop Serverless Error Handler")

        @fallback_app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
        async def error_handler(path_name: str = ""):
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
