#!/usr/bin/env python3
"""Nettoyage MANUEL des données signalées par l'audit (D3, D6, D7). Chaque action est optionnelle.

Ordre conseillé : repair_db.py --apply  ->  cleanup_db.py <actions> (simulation)  ->  cleanup_db.py <actions> --apply

  python cleanup_db.py conversastore.db --merge-phones --purge-test-wallet --credit-delivered-points
  python cleanup_db.py conversastore.db --merge-phones ... --apply      # copie .bak (SQLite) puis écriture

Actions :
  --merge-phones             D7  fusionne les clients d'une même boutique dont le téléphone normalisé est identique
                             (commandes, intentions, conversations, grand livre, bons déplacés vers le plus ancien ;
                             soldes additionnés ; chaîne balance_after du grand livre recalculée).
  --purge-test-wallet        D6  supprime les transactions wallet dont l'order_id n'existe pas et commence par 'test-',
                             et annule leur effet sur merchant_wallets. Refuse si un solde deviendrait négatif.
  --purge-pending-withdrawals    avec la précédente : supprime aussi les demandes de retrait PENDING sans commande
                             (à n'utiliser que si vous savez qu'elles viennent des tests).
  --credit-delivered-points  D3  crédite les points EARNED_ORDER des commandes livrées qui n'en ont pas
                             (règles de la boutique ; idempotent).
Sans --apply : SIMULATION complète (transaction annulée à la fin).
"""
import os
import re
import shutil
import sys
from datetime import datetime

argv = sys.argv[1:]
paths = [a for a in argv if not a.startswith("--")]
APPLY = "--apply" in argv
target = paths[0] if paths else "conversastore.db"
if "://" in target:
    os.environ["DATABASE_URL"] = target
else:
    if APPLY:
        bak = f"{target}.{datetime.now():%Y%m%d_%H%M%S}.bak"
        shutil.copy2(target, bak)
        print(f"Sauvegarde : {bak}")
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.abspath(target)}"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text, inspect  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.migrations import run_migrations  # noqa: E402

run_migrations(engine)
db = SessionLocal()
print("MODE :", "ÉCRITURE" if APPLY else "SIMULATION (rien n'est enregistré)")


def digits(p):
    return re.sub(r"[^\d]", "", p or "")


def merge_phones():
    insp = inspect(engine)
    ref_tables = [t for t in insp.get_table_names() if t != "customers"
                  and "customer_id" in {c["name"] for c in insp.get_columns(t)}]
    rows = db.execute(text("SELECT id, store_id, phone, COALESCE(bonus_points,0), created_at FROM customers")).fetchall()
    groups = {}
    for cid, sid, phone, pts, created in rows:
        if digits(phone):
            groups.setdefault((sid, digits(phone)), []).append((created or datetime.min, cid, pts))
    merged = 0
    for (sid, _), members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda m: (str(m[0]), m[1]))
        keeper = members[0][1]
        for _, dup, dup_pts in members[1:]:
            for t in ref_tables:
                db.execute(text(f"UPDATE {t} SET customer_id=:k WHERE customer_id=:d"), {"k": keeper, "d": dup})
            db.execute(text("UPDATE customers SET bonus_points = COALESCE(bonus_points,0) + :p WHERE id=:k"), {"p": dup_pts, "k": keeper})
            db.execute(text("DELETE FROM customers WHERE id=:d"), {"d": dup})
            merged += 1
            print(f"    fusion client {dup} -> {keeper} (boutique {sid}, +{dup_pts} pts)")
        # chaîne balance_after recalculée pour le client conservé
        bal = 0
        for lid, pts in db.execute(text("SELECT id, points FROM loyalty_points_ledger WHERE customer_id=:k ORDER BY created_at, id"), {"k": keeper}).fetchall():
            bal += pts
            db.execute(text("UPDATE loyalty_points_ledger SET balance_after=:b WHERE id=:i"), {"b": bal, "i": lid})
    print(f"[D7] clients fusionnés : {merged}")


def purge_test_wallet(with_withdrawals):
    tx = db.execute(text(
        "SELECT id, wallet_id, transaction_type, amount, COALESCE(fee,0), status FROM wallet_transactions "
        "WHERE order_id LIKE 'test-%' AND order_id NOT IN (SELECT id FROM orders)")).fetchall()
    wd = db.execute(text(
        "SELECT id, wallet_id, transaction_type, amount, COALESCE(fee,0), status FROM wallet_transactions "
        "WHERE order_id IS NULL AND transaction_type='WITHDRAWAL_REQUEST' AND status='PENDING'")).fetchall()
    print(f"[D6] transactions de test : {len(tx)} ; demandes de retrait PENDING sans commande : {len(wd)} "
          f"({'incluses' if with_withdrawals else 'conservées'})")
    delta = {}  # wallet_id -> [available, pending, withdrawn, earned]
    def acc(w): return delta.setdefault(w, [0, 0, 0, 0])
    for _, w, typ, amt, fee, st in tx:
        d = acc(w)
        if typ == "ESCROW_RELEASE":
            d[0] -= amt; d[3] -= amt      # crédit disponible + total gagné annulés (le CREDIT/pending net = 0)
        elif typ == "ESCROW_CREDIT":
            pass
        else:
            print(f"    ! type inattendu {typ} — non traité automatiquement")
    if with_withdrawals:
        for _, w, _, amt, fee, _ in wd:
            d = acc(w)
            d[0] += amt + fee; d[2] -= amt   # le retrait avait débité le disponible et augmenté total_withdrawn
    for w, (av, pe, wi, ea) in delta.items():
        cur = db.execute(text("SELECT available_balance, pending_balance, total_withdrawn, total_earned FROM merchant_wallets WHERE id=:w"), {"w": w}).fetchone()
        new = (cur[0] + av, cur[1] + pe, cur[2] + wi, cur[3] + ea)
        print(f"    wallet {w}: {tuple(cur)} -> {new}")
        if min(new) < 0:
            print("    !! un solde deviendrait négatif : opération refusée pour ce wallet (relancez avec --purge-pending-withdrawals si ces retraits sont de test)")
            continue
        db.execute(text("UPDATE merchant_wallets SET available_balance=:a, pending_balance=:p, total_withdrawn=:w, total_earned=:e WHERE id=:i"),
                   {"a": new[0], "p": new[1], "w": new[2], "e": new[3], "i": w})
        ids = [r[0] for r in tx if r[1] == w] + ([r[0] for r in wd if r[1] == w] if with_withdrawals else [])
        for i in ids:
            db.execute(text("DELETE FROM wallet_transactions WHERE id=:i"), {"i": i})
        # chaîne balance_before/after recalculée sur les transactions restantes (dans l'ordre)
        print(f"    {len(ids)} transaction(s) supprimée(s)")


def credit_delivered_points():
    from app.models.order import Order
    from app.services.loyalty_service import LoyaltyService
    orders = db.execute(text(
        "SELECT o.id FROM orders o WHERE o.status IN ('DELIVERED','COMPLETED','LIVREE') AND o.customer_id IS NOT NULL "
        "AND EXISTS (SELECT 1 FROM customers c WHERE c.id=o.customer_id) "
        "AND NOT EXISTS (SELECT 1 FROM loyalty_points_ledger l WHERE l.order_id=o.id AND l.entry_type='EARNED_ORDER')")).fetchall()
    done = skipped = 0
    for (oid,) in orders:
        o = db.query(Order).filter(Order.id == oid).first()
        st = o.store
        if getattr(st, "is_loyalty_active", True) is False:
            skipped += 1
            continue
        per = int(getattr(st, "loyalty_spend_per_point", 0) or 1000)
        pts = max(1, int(o.total_amount / per))
        LoyaltyService.credit_points(db=db, store_id=o.store_id, customer_id=o.customer_id, points=pts,
                                     entry_type="EARNED_ORDER", description=f"Régularisation points commande #{o.order_number}",
                                     order_id=o.id)
        done += 1
    print(f"[D3] commandes créditées : {done} (boutique sans fidélité ignorées : {skipped}) sur {len(orders)} candidates")


try:
    if "--merge-phones" in argv:
        merge_phones()
    if "--purge-test-wallet" in argv:
        purge_test_wallet("--purge-pending-withdrawals" in argv)
    if "--credit-delivered-points" in argv:
        credit_delivered_points()
    if not any(a in argv for a in ("--merge-phones", "--purge-test-wallet", "--credit-delivered-points")):
        print("Aucune action demandée — voir l'aide en tête du fichier.")
    if APPLY:
        db.commit()
        print("Terminé (enregistré).")
    else:
        db.rollback()
        print("Simulation terminée — rien n'a été enregistré. Relancez avec --apply.")
except Exception:
    db.rollback()
    raise
finally:
    db.close()
