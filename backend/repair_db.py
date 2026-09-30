#!/usr/bin/env python3
"""Réparation IDEMPOTENTE des enregistrements GotoShop (voir AUDIT_GOTOSHOP.md).

Par défaut : SIMULATION (aucune écriture). Ajoutez --apply pour écrire.
  python repair_db.py conversastore.db            # simulation
  python repair_db.py conversastore.db --apply    # copie de sauvegarde .bak puis écriture
  python repair_db.py "postgresql+psycopg2://..." --apply   (sauvegardez la base AVANT)

Corrections :
  1. orders.customer_id orphelin -> rattaché au client de la même boutique ayant le même
     téléphone, sinon mis à NULL (la commande reste retrouvable par téléphone/jeton).
  2. commandes annulées/refusées dont l'intention liée n'est pas CANCELLED -> synchronisée.
  3. customers.bonus_points sans grand livre -> écriture d'ouverture MANUAL_ADJUSTMENT
     (le solde est conservé, il devient simplement traçable).
Non corrigé automatiquement (décision métier) : doublons de téléphone, points non crédités
sur commandes livrées, transactions wallet de test.
"""
import re
import shutil
import sys
import uuid
from datetime import datetime

from sqlalchemy import create_engine, text
from app.core.clock import utcnow

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
target = args[0] if args else "conversastore.db"
is_url = "://" in target
if not is_url:
    if APPLY:
        bak = f"{target}.{datetime.now():%Y%m%d_%H%M%S}.bak"
        shutil.copy2(target, bak)
        print(f"Sauvegarde : {bak}")
    url = f"sqlite:///{target}"
else:
    url = target
engine = create_engine(url)
print("MODE :", "ÉCRITURE" if APPLY else "SIMULATION (aucune écriture)")


def norm(p):
    return re.sub(r"[^\d]", "", p or "")


def cols(conn, table):
    return {r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))} if engine.dialect.name == "sqlite" else {
        r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name=:t"), {"t": table})}


with engine.begin() as conn:
    # 1. commandes orphelines
    rows = conn.execute(text(
        "SELECT o.id, o.order_number, o.store_id, o.customer_phone FROM orders o WHERE o.customer_id IS NOT NULL "
        "AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)")).fetchall()
    relinked = nulled = 0
    for oid, num, store_id, phone in rows:
        target_id = None
        if phone:
            for cid, cphone in conn.execute(text("SELECT id, phone FROM customers WHERE store_id=:s"), {"s": store_id}):
                if norm(cphone) == norm(phone):
                    target_id = cid
                    break
        if APPLY:
            conn.execute(text("UPDATE orders SET customer_id=:c WHERE id=:i"), {"c": target_id, "i": oid})
        relinked += bool(target_id)
        nulled += not target_id
    print(f"[1] commandes orphelines : {len(rows)} (rattachées : {relinked}, mises à NULL : {nulled})")

    # 2. intentions désynchronisées
    n = conn.execute(text(
        "SELECT COUNT(*) FROM order_intents i JOIN orders o ON o.order_number = i.reference_code "
        "WHERE o.status IN ('CANCELLED','REJECTED') AND i.status <> 'CANCELLED'")).scalar()
    if APPLY and n:
        conn.execute(text(
            "UPDATE order_intents SET status='CANCELLED', client_status='CANCELLED' WHERE reference_code IN "
            "(SELECT order_number FROM orders WHERE status IN ('CANCELLED','REJECTED')) AND status <> 'CANCELLED'"))
    print(f"[2] intentions à synchroniser : {n}")

    # 3. soldes sans grand livre
    lcols = cols(conn, "loyalty_points_ledger")
    diffs = conn.execute(text(
        "SELECT c.id, c.store_id, COALESCE(c.bonus_points,0), COALESCE(SUM(l.points),0) FROM customers c "
        "LEFT JOIN loyalty_points_ledger l ON l.customer_id=c.id AND l.store_id=c.store_id "
        "GROUP BY c.id, c.store_id, c.bonus_points HAVING COALESCE(c.bonus_points,0) <> COALESCE(SUM(l.points),0)")).fetchall()
    fixed = 0
    for cid, sid, bonus, ledger in diffs:
        delta = bonus - ledger
        if delta <= 0:
            print(f"    ! client {cid} : grand livre > solde ({ledger} > {bonus}) — à traiter à la main")
            continue
        fixed += 1
        if APPLY:
            fields = {"id": str(uuid.uuid4()), "s": sid, "c": cid, "p": delta, "b": bonus, "t": utcnow()}
            extra_cols, extra_vals = "", ""
            if "points_remaining" in lcols:
                extra_cols, extra_vals = ", points_remaining", ", :p"
            conn.execute(text(
                "INSERT INTO loyalty_points_ledger (id, store_id, customer_id, entry_type, points, balance_after, "
                f"description, is_expired, created_at{extra_cols}) VALUES (:id,:s,:c,'MANUAL_ADJUSTMENT',:p,:b,"
                f"'Régularisation : solde d''ouverture',0,:t{extra_vals})"), fields)
    print(f"[3] soldes régularisés par écriture d'ouverture : {fixed}/{len(diffs)}")

print("Terminé." if APPLY else "Simulation terminée — relancez avec --apply pour écrire.")
