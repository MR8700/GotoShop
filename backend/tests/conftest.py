"""Isole TOUS les tests dans une copie jetable de la base : les tests suppriment des clients et créent des
commandes ; exécutés sur conversastore.db ils y laissaient des commandes orphelines (voir AUDIT_GOTOSHOP.md)."""
import os
import shutil
import tempfile

# L'isolation est normalement déjà faite par backend/conftest.py ; ce bloc ne sert que si ce dossier est lancé seul.
if not os.environ.get("GOTOSHOP_TEST_ISOLATED"):
    _src = os.path.join(os.path.dirname(__file__), "..", "conversastore.db")
    _tmp = os.path.join(tempfile.mkdtemp(prefix="gotoshop_test_"), "test.db")
    if os.path.exists(_src):
        shutil.copy2(_src, _tmp)
    os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}"
    os.environ.pop("SUPABASE_DB_URL", None)
    os.environ["GOTOSHOP_TEST_ISOLATED"] = "1"


import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _reassort_stock_base_jetable():
    """Les anciennes exécutions des tests sur la base réelle ont vidé le stock de certains produits ; sur la copie
    jetable on remet un stock confortable pour que les scénarios de commande ne dépendent pas de cet historique."""
    from sqlalchemy import text
    from app.database import engine
    from app.migrations import run_migrations
    run_migrations(engine)
    with engine.begin() as conn:
        conn.execute(text("UPDATE products SET stock = 100 WHERE stock IS NOT NULL AND stock < 100"))
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app.core.ratelimit import reset_rate_limits
    reset_rate_limits()
    yield
