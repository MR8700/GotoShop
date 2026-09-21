import sys
from pathlib import Path

# Add backend directory to Python sys.path for Vercel Serverless Functions
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from app.main import app

# Vercel looks for 'app' as the ASGI application entry point
