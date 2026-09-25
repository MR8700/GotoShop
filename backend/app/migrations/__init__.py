import importlib.util
from pathlib import Path

file_path = Path(__file__).resolve().parent.parent / "migrations.py"
if file_path.exists():
    spec = importlib.util.spec_from_file_location("app_migrations_file", str(file_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    run_migrations = mod.run_migrations
else:
    def run_migrations(engine):
        pass
