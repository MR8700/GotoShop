#!/usr/bin/env python3
"""Assainissement IDEMPOTENT des données GotoShop (complète repair_db.py).

  python repair_data.py conversastore.db            # simulation (aucune écriture)
  python repair_data.py conversastore.db --apply    # sauvegarde .bak puis écriture

Corrections :
  1. Schéma : migrations (colonnes manquantes : delivery_fee, points_remaining, lieux, ...).
  2. Boutiques de test / doublons vides (sans commande, client ni intention) supprimées avec leurs données ;
     le propriétaire est supprimé s'il n'a plus aucune boutique. Une seule « Kadi Mode Boutique » est conservée.
  3. stores.sales_count / revenue recalculés depuis les ventes réelles (commandes livrées/terminées + intentions vendues
     sans commande) au lieu de chiffres fictifs.
  4. order_deliveries.delivery_status aligné sur le statut de la commande (+ delivered_at / started_at).
  5. Variantes d'écriture d'une même zone de livraison unifiées (Kossodo).
  6. Tarifs de livraison manquants déduits des commandes passées (tarif le plus fréquent non nul de la ville) ;
     boutique sans zone -> zone par défaut = ville de la boutique.
  7. Clients en double (même téléphone, même boutique) fusionnés : commandes, intentions, grand livre et points repris.
  8. Notes des boutiques = moyenne des notes clients réelles (0 = pas encore noté).
  8b. Commandes livrées sans compte client : compte reconstitué (nom + téléphone de la commande) et rattaché.
  9. Points de fidélité non crédités sur les commandes livrées/terminées : crédités avec la règle de l'application
     (loyalty_v3 : 0,5 pt aux paiements 1-2, +0,1 tous les 3 paiements ; commande >= 1000 FCFA après remise ;
     un seul paiement compté par client, boutique et jour), en ordre chronologique, à la date de la commande.
"""
import re
import shutil
import sys
import uuid
from collections import Counter
from datetime import datetime

from sqlalchemy import create_engine, inspect, text

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
target = args[0] if args else "conversastore.db"
if "://" not in target:
    if APPLY:
        bak = f"{target}.{datetime.now():%Y%m%d_%H%M%S}.bak"
        shutil.copy2(target, bak)
        print(f"Sauvegarde : {bak}")
    url = f"sqlite:///{target}"
else:
    url = target
engine = create_engine(url)
print("MODE :", "ÉCRITURE" if APPLY else "SIMULATION (aucune écriture)")

if APPLY:
    sys.path.insert(0, ".")
    from app.migrations import run_migrations
    run_migrations(engine)
    print("[1] migrations appliquées")


def norm(p):
    return re.sub(r"[^\d]", "", p or "")


def has(conn, table, col=None):
    insp = inspect(conn)
    if table not in insp.get_table_names():
        return False
    return col is None or col in {c["name"] for c in insp.get_columns(table)}


with engine.begin() as conn:
    W = APPLY

    # 2. boutiques de test / doublons vides
    stores = conn.execute(text("SELECT id, name, slug, owner_id FROM stores ORDER BY created_at, id")).fetchall()

    def activity(sid):
        return sum(conn.execute(text(f"SELECT COUNT(*) FROM {t} WHERE store_id=:s"), {"s": sid}).scalar()
                   for t in ("orders", "customers", "order_intents"))

    seen_names, doomed = set(), []
    for sid, name, slug, owner in stores:
        is_test = bool(re.match(r"^(boutique )?test\b", (name or "").strip().lower()))
        key = (name or "").strip().lower()
        dup = key in seen_names
        seen_names.add(key)
        if (is_test or dup) and activity(sid) == 0:
            doomed.append((sid, name, owner))
    print(f"[2] boutiques de test/doublons vides à supprimer : {len(doomed)}")
    if W and doomed:
        ids = [d[0] for d in doomed]
        insp = inspect(conn)
        for t in insp.get_table_names():
            if t == "stores" or "store_id" not in {c["name"] for c in insp.get_columns(t)}:
                continue
            conn.execute(text(f"DELETE FROM {t} WHERE store_id IN ({','.join(repr(i) for i in ids)})"))
        # produits/variantes/images rattachés aux produits supprimés
        for t, col in (("product_variants", "product_id"), ("product_images", "product_id")):
            if has(conn, t, col):
                conn.execute(text(f"DELETE FROM {t} WHERE {col} NOT IN (SELECT id FROM products)"))
        conn.execute(text(f"DELETE FROM stores WHERE id IN ({','.join(repr(i) for i in ids)})"))
        for owner in {d[2] for d in doomed}:
            if not conn.execute(text("SELECT COUNT(*) FROM stores WHERE owner_id=:o"), {"o": owner}).scalar():
                conn.execute(text("DELETE FROM owners WHERE id=:o"), {"o": owner})

    # 3. chiffres de ventes réels
    n3 = 0
    for (sid,) in conn.execute(text("SELECT id FROM stores")).fetchall():
        c1, r1 = conn.execute(text(
            "SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM orders WHERE store_id=:s AND status IN ('DELIVERED','COMPLETED')"),
            {"s": sid}).fetchone()
        c2, r2 = conn.execute(text(
            "SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM order_intents WHERE store_id=:s AND status='SOLD' "
            "AND reference_code NOT IN (SELECT order_number FROM orders)"), {"s": sid}).fetchone()
        cnt, rev = int(c1 + c2), int(r1 + r2)
        cur = conn.execute(text("SELECT sales_count, revenue FROM stores WHERE id=:s"), {"s": sid}).fetchone()
        if (cur[0], cur[1]) != (cnt, rev):
            n3 += 1
            if W:
                conn.execute(text("UPDATE stores SET sales_count=:c, revenue=:r WHERE id=:s"), {"c": cnt, "r": rev, "s": sid})
    print(f"[3] boutiques dont les chiffres de ventes sont recalculés : {n3}")

    # 4. statut de livraison
    mapping = {"READY_FOR_DELIVERY": "ASSIGNED", "OUT_FOR_DELIVERY": "IN_TRANSIT", "DELIVERED": "DELIVERED",
               "COMPLETED": "DELIVERED", "CANCELLED": "FAILED", "REJECTED": "FAILED"}
    n4 = 0
    for ost, dst in mapping.items():
        n = conn.execute(text(
            "SELECT COUNT(*) FROM order_deliveries d JOIN orders o ON o.id=d.order_id "
            "WHERE o.status=:o AND COALESCE(d.delivery_status,'')<>:d"), {"o": ost, "d": dst}).scalar()
        n4 += n
        if W and n:
            conn.execute(text(
                "UPDATE order_deliveries SET delivery_status=:d WHERE order_id IN (SELECT id FROM orders WHERE status=:o)"),
                {"o": ost, "d": dst})
            if dst == "DELIVERED":
                conn.execute(text(
                    "UPDATE order_deliveries SET delivered_at=(SELECT updated_at FROM orders o WHERE o.id=order_id) "
                    "WHERE delivery_status='DELIVERED' AND delivered_at IS NULL"))
    print(f"[4] statuts de livraison alignés : {n4}")

    # 5. zones de livraison écrites de plusieurs façons
    variants = {"Kossodo": "Kossodo (Ouagadougou)", "Cité universitaire de Kossodo": "Cité Universitaire Kossodo"}
    n5 = 0
    for old, new in variants.items():
        for t in ("order_deliveries", "order_intents"):
            if has(conn, t, "delivery_city"):
                n = conn.execute(text(f"SELECT COUNT(*) FROM {t} WHERE delivery_city=:o"), {"o": old}).scalar()
                n5 += n
                if W and n:
                    conn.execute(text(f"UPDATE {t} SET delivery_city=:n WHERE delivery_city=:o"), {"o": old, "n": new})
    print(f"[5] zones harmonisées : {n5}")

    # 6. tarifs manquants + boutique sans zone
    n6 = n6b = 0
    if W or has(conn, "delivery_cities", "delivery_fee"):
        for cid, sid, name, label in conn.execute(text(
                "SELECT id, store_id, name, display_label FROM delivery_cities WHERE delivery_fee IS NULL")).fetchall():
            fees = [r[0] for r in conn.execute(text(
                "SELECT o.delivery_fee FROM orders o JOIN order_deliveries d ON d.order_id=o.id "
                "WHERE o.store_id=:s AND o.delivery_fee>0 AND (LOWER(d.delivery_city)=LOWER(:n) OR LOWER(d.delivery_city)=LOWER(:l))"),
                {"s": sid, "n": name, "l": label or name}).fetchall()]
            if fees:
                n6 += 1
                if W:
                    conn.execute(text("UPDATE delivery_cities SET delivery_fee=:f WHERE id=:i"),
                                 {"f": Counter(fees).most_common(1)[0][0], "i": cid})
    for sid, city in conn.execute(text(
            "SELECT s.id, s.city FROM stores s WHERE NOT EXISTS (SELECT 1 FROM delivery_cities d WHERE d.store_id=s.id)")).fetchall():
        n6b += 1
        if W:
            conn.execute(text(
                "INSERT INTO delivery_cities (id, store_id, name, display_label, is_default, display_order) "
                "VALUES (:i,:s,:n,:n,1,0)"), {"i": str(uuid.uuid4()), "s": sid, "n": city or "Ouagadougou"})
    print(f"[6] tarifs déduits : {n6} ; boutiques sans zone complétées : {n6b}")

    # 7. clients en double
    n7 = 0
    for sid, in conn.execute(text("SELECT DISTINCT store_id FROM customers")).fetchall():
        groups = {}
        for cid, phone, bonus, created in conn.execute(text(
                "SELECT id, phone, COALESCE(bonus_points,0), created_at FROM customers WHERE store_id=:s ORDER BY created_at, id"),
                {"s": sid}).fetchall():
            if norm(phone):
                groups.setdefault(norm(phone), []).append((cid, bonus))
        for rows in groups.values():
            keep, extras = rows[0], rows[1:]
            for dup_id, dup_bonus in extras:
                n7 += 1
                if not W:
                    continue
                for t, col in (("orders", "customer_id"), ("order_intents", "customer_id"),
                               ("loyalty_points_ledger", "customer_id"), ("loyalty_reward_coupons", "customer_id")):
                    if has(conn, t, col):
                        conn.execute(text(f"UPDATE {t} SET {col}=:k WHERE {col}=:d"), {"k": keep[0], "d": dup_id})
                conn.execute(text("UPDATE customers SET bonus_points=COALESCE(bonus_points,0)+:b WHERE id=:k"),
                             {"b": dup_bonus, "k": keep[0]})
                conn.execute(text("DELETE FROM customers WHERE id=:d"), {"d": dup_id})
    print(f"[7] clients en double fusionnés : {n7}")


# 8. notes réelles + 9. points manquants
with engine.begin() as conn:
    n8 = 0
    for sid, cur in conn.execute(text("SELECT id, rating FROM stores")).fetchall():
        avg = conn.execute(text(
            "SELECT AVG(client_satisfaction_rating) FROM order_intents WHERE store_id=:s AND client_satisfaction_rating IS NOT NULL"),
            {"s": sid}).scalar()
        val = round(float(avg), 2) if avg is not None else 0.0
        if cur is None or abs(float(cur) - val) > 1e-9:
            n8 += 1
            if APPLY:
                conn.execute(text("UPDATE stores SET rating=:r WHERE id=:s"), {"r": val, "s": sid})
    print(f"[8] notes de boutique recalculées depuis les avis réels : {n8}")

# 8b. commandes livrées sans compte client (rattachement perdu) : compte reconstitué depuis la commande (nom + téléphone)
with engine.begin() as conn:
    guests = conn.execute(text(
        "SELECT o.store_id, o.customer_phone, MAX(o.customer_name), MIN(o.created_at) FROM orders o "
        "WHERE o.status IN ('DELIVERED','COMPLETED') AND o.customer_id IS NULL "
        "AND o.customer_phone IS NOT NULL AND TRIM(o.customer_phone) <> '' GROUP BY o.store_id, o.customer_phone")).fetchall()
    n8b = 0
    for sid, phone, name, first in guests:
        existing = next((cid for cid, cp in conn.execute(text("SELECT id, phone FROM customers WHERE store_id=:s"), {"s": sid})
                         if norm(cp) == norm(phone)), None)
        if not existing:
            n8b += 1
            existing = str(uuid.uuid4())
            if APPLY:
                conn.execute(text(
                    "INSERT INTO customers (id, store_id, name, phone, country, bonus_points, is_blocked, created_at, updated_at) "
                    "VALUES (:i,:s,:n,:p,'Burkina Faso',0,0,:c,:c)"),
                    {"i": existing, "s": sid, "n": name or "Client", "p": phone, "c": first})
        if APPLY:
            conn.execute(text(
                "UPDATE orders SET customer_id=:c WHERE store_id=:s AND customer_id IS NULL AND customer_phone=:p "
                "AND status IN ('DELIVERED','COMPLETED')"), {"c": existing, "s": sid, "p": phone})
    print(f"[8b] comptes clients reconstitués depuis les commandes livrées : {n8b} (sur {len(guests)} clients sans compte)")

MIN_ORDER = 1000
todo = conn_rows = None
with engine.connect() as conn:
    conn_rows = conn.execute(text(
        "SELECT o.id, o.order_number, o.store_id, o.customer_id, o.subtotal_amount, COALESCE(o.discount_amount,0), "
        "COALESCE(o.updated_at, o.created_at) FROM orders o JOIN customers c ON c.id=o.customer_id AND c.store_id=o.store_id "
        "JOIN stores s ON s.id=o.store_id "
        "WHERE o.status IN ('DELIVERED','COMPLETED') AND COALESCE(s.is_loyalty_active,1) <> 0 "
        "AND NOT EXISTS (SELECT 1 FROM loyalty_points_ledger l WHERE l.order_id=o.id AND l.entry_type='EARNED_ORDER') "
        "ORDER BY COALESCE(o.updated_at, o.created_at), o.id")).fetchall()
todo = [r for r in conn_rows if int(r[4] or 0) - int(r[5]) >= MIN_ORDER]
print(f"[9] commandes livrées éligibles sans points : {len(todo)} (sur {len(conn_rows)} sans points)")
if APPLY and todo:
    from app.database import Base
    from sqlalchemy.orm import sessionmaker
    import app.models  # noqa: F401
    from app.models.customer import Customer
    from app.models.loyalty import LoyaltyLedgerEntry
    from app.services.loyalty_v3 import gain_tenths, fmt
    from sqlalchemy import func, cast, Date
    S = sessionmaker(bind=engine)
    db = S()
    credited = tenths_total = 0
    try:
        for oid, num, sid, cid, sub, disc, when in todo:
            if isinstance(when, str):
                when = datetime.fromisoformat(when)
            day0 = when.replace(hour=0, minute=0, second=0, microsecond=0)
            same_day = db.query(LoyaltyLedgerEntry).filter(
                LoyaltyLedgerEntry.store_id == sid, LoyaltyLedgerEntry.customer_id == cid,
                LoyaltyLedgerEntry.entry_type == "EARNED_ORDER",
                LoyaltyLedgerEntry.created_at >= day0, LoyaltyLedgerEntry.created_at < day0.replace(hour=23, minute=59, second=59),
            ).first()
            if same_day:
                continue  # règle anti-fractionnement : un paiement compté par jour
            n = db.query(LoyaltyLedgerEntry).filter(
                LoyaltyLedgerEntry.store_id == sid, LoyaltyLedgerEntry.customer_id == cid,
                LoyaltyLedgerEntry.entry_type == "EARNED_ORDER").count() + 1
            tenths = gain_tenths(n)
            cust = db.query(Customer).filter(Customer.id == cid, Customer.store_id == sid).first()
            cust.bonus_points = int(cust.bonus_points or 0) + tenths
            db.add(LoyaltyLedgerEntry(
                store_id=sid, customer_id=cid, order_id=oid, entry_type="EARNED_ORDER", points=tenths,
                balance_after=cust.bonus_points, points_remaining=tenths, expires_at=None, created_at=when,
                description=f"Paiement n°{n} : +{fmt(tenths)} pt (commande #{num}) — régularisation"))
            db.flush()
            credited += 1
            tenths_total += tenths
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(f"    points crédités : {credited} commandes, +{tenths_total / 10:g} pt au total")

print("Terminé." if APPLY else "Simulation terminée — relancez avec --apply pour écrire.")
