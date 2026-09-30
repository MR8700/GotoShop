#!/usr/bin/env python3
"""Audit LECTURE SEULE des enregistrements GotoShop (SQLite ou PostgreSQL).

Usage :
  python audit_db.py chemin/vers/gotoshop.db
  python audit_db.py "postgresql+psycopg2://user:mdp@hote/base"

Aucune écriture : uniquement des SELECT. Chaque contrôle est isolé (une table
ou colonne absente n'arrête pas les autres).
"""
import sys
from sqlalchemy import create_engine, text

arg = sys.argv[1] if len(sys.argv) > 1 else "gotoshop.db"
if "://" in arg:
    url = arg
else:
    url = f"sqlite:///file:{arg}?mode=ro&uri=true"
engine = create_engine(url)

DELIVERED = "('DELIVERED','COMPLETED','LIVREE')"

CHECKS = [
    # --- Commandes ---
    ("CRITIQUE", "orders : order_number en double",
     "SELECT order_number, COUNT(*) n FROM orders GROUP BY order_number HAVING COUNT(*) > 1"),
    ("CRITIQUE", "order_intents : reference_code en double",
     "SELECT reference_code, COUNT(*) n FROM order_intents GROUP BY reference_code HAVING COUNT(*) > 1"),
    ("MOYEN", "orders : customer_id vers un client inexistant",
     "SELECT o.id, o.order_number FROM orders o WHERE o.customer_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)"),
    ("MOYEN", "orders : client d'une AUTRE boutique que la commande",
     "SELECT o.id, o.order_number, o.store_id, c.store_id AS client_store FROM orders o "
     "JOIN customers c ON c.id = o.customer_id WHERE c.store_id <> o.store_id"),
    ("MOYEN", "order_intents : client d'une AUTRE boutique (liaison par téléphone)",
     "SELECT i.id, i.reference_code, i.store_id, c.store_id AS client_store FROM order_intents i "
     "JOIN customers c ON c.id = i.customer_id WHERE c.store_id <> i.store_id"),
    ("MOYEN", "orders sans aucune ligne (order_items)",
     "SELECT o.id, o.order_number FROM orders o "
     "WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)"),
    ("MOYEN", "order_items : produit supprimé/inexistant",
     "SELECT i.id, i.order_id, i.product_id FROM order_items i WHERE i.product_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = i.product_id)"),
    ("MOYEN", "orders annulée mais intention liée non annulée (ou l'inverse)",
     "SELECT o.order_number, o.status, i.status AS intent_status FROM orders o "
     "JOIN order_intents i ON i.reference_code = o.order_number "
     "WHERE (o.status IN ('CANCELLED','REJECTED') AND i.status <> 'CANCELLED') "
     "OR (i.status = 'CANCELLED' AND o.status NOT IN ('CANCELLED','REJECTED'))"),
    ("MOYEN", "products : stock négatif",
     "SELECT id, name, stock FROM products WHERE stock IS NOT NULL AND stock < 0"),

    # --- Clients ---
    ("CRITIQUE", "customers : même téléphone (normalisé) en double dans une boutique",
     "SELECT store_id, REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','') p, COUNT(*) n FROM customers "
     "WHERE phone IS NOT NULL AND phone <> '' GROUP BY store_id, p HAVING COUNT(*) > 1"),
    ("MOYEN", "customers : téléphone vide",
     "SELECT id, name FROM customers WHERE phone IS NULL OR phone = ''"),
    ("INFO", "customers : loyalty_card_no vide (généré à la demande par card_service.ensure_card_number)",
     "SELECT id, name FROM customers WHERE loyalty_card_no IS NULL OR loyalty_card_no = ''"),
    ("MOYEN", "customers : loyalty_card_no en double",
     "SELECT loyalty_card_no, COUNT(*) n FROM customers WHERE loyalty_card_no IS NOT NULL "
     "AND loyalty_card_no <> '' GROUP BY loyalty_card_no HAVING COUNT(*) > 1"),

    # --- Fidélité ---
    ("CRITIQUE", "solde bonus_points <> somme du grand livre",
     "SELECT c.id, c.store_id, COALESCE(c.bonus_points,0) solde, COALESCE(SUM(l.points),0) grand_livre "
     "FROM customers c LEFT JOIN loyalty_points_ledger l ON l.customer_id = c.id AND l.store_id = c.store_id "
     "GROUP BY c.id, c.store_id, c.bonus_points "
     "HAVING COALESCE(c.bonus_points,0) <> COALESCE(SUM(l.points),0)"),
    ("CRITIQUE", "solde bonus_points <> somme des lots restants (points_remaining)",
     "SELECT c.id, c.store_id, COALESCE(c.bonus_points,0) solde, COALESCE(x.rem,0) lots FROM customers c "
     "LEFT JOIN (SELECT customer_id, store_id, SUM(COALESCE(points_remaining,0)) rem "
     "FROM loyalty_points_ledger WHERE points > 0 AND NOT COALESCE(is_expired, FALSE) "
     "GROUP BY customer_id, store_id) x ON x.customer_id = c.id AND x.store_id = c.store_id "
     "WHERE COALESCE(c.bonus_points,0) <> COALESCE(x.rem,0)"),
    ("CRITIQUE", "solde bonus_points négatif",
     "SELECT id, store_id, bonus_points FROM customers WHERE bonus_points < 0"),
    ("CRITIQUE", "points gagnés en double pour une même commande",
     "SELECT order_id, entry_type, COUNT(*) n FROM loyalty_points_ledger WHERE order_id IS NOT NULL "
     "GROUP BY order_id, entry_type HAVING COUNT(*) > 1"),
    ("MOYEN", "commande livrée avec client mais sans points EARNED_ORDER",
     f"SELECT o.id, o.order_number, o.store_id, o.customer_id FROM orders o "
     f"WHERE o.status IN {DELIVERED} AND o.customer_id IS NOT NULL "
     f"AND (o.subtotal_amount - COALESCE(o.discount_amount,0)) >= 1000 "
     f"AND NOT EXISTS (SELECT 1 FROM loyalty_points_ledger l WHERE l.order_id = o.id AND l.entry_type = 'EARNED_ORDER') "
     # règle « un paiement compté par client, boutique et jour » : pas d'anomalie si un gain existe le même jour
     f"AND NOT EXISTS (SELECT 1 FROM loyalty_points_ledger l2 WHERE l2.customer_id = o.customer_id "
     f"AND l2.store_id = o.store_id AND l2.entry_type = 'EARNED_ORDER' "
     f"AND date(l2.created_at) = date(COALESCE(o.updated_at, o.created_at)))"),
    ("MOYEN", "grand livre : store_id différent de celui du client",
     "SELECT l.id, l.store_id, c.store_id AS client_store FROM loyalty_points_ledger l "
     "JOIN customers c ON c.id = l.customer_id WHERE c.store_id <> l.store_id"),
    ("MOYEN", "grand livre : entrée positive sans points_remaining",
     "SELECT id, customer_id, points FROM loyalty_points_ledger WHERE points > 0 AND points_remaining IS NULL"),
    ("MOYEN", "grand livre : points_remaining hors bornes (<0 ou > points)",
     "SELECT id, points, points_remaining FROM loyalty_points_ledger "
     "WHERE points_remaining < 0 OR (points > 0 AND points_remaining > points)"),
    ("MOYEN", "grand livre : lot marqué expiré avec points restants",
     "SELECT id, points_remaining FROM loyalty_points_ledger WHERE is_expired AND points_remaining > 0"),
    ("MOYEN", "coupons : code en double dans une même boutique",
     "SELECT store_id, code, COUNT(*) n FROM loyalty_reward_coupons GROUP BY store_id, code HAVING COUNT(*) > 1"),
    ("MOYEN", "coupons : utilisé sans used_at / order_id",
     "SELECT id, code FROM loyalty_reward_coupons WHERE is_used AND (used_at IS NULL OR order_id IS NULL)"),
]

total = 0
with engine.connect() as conn:
    for level, label, sql in CHECKS:
        try:
            rows = conn.execute(text(sql)).fetchall()
        except Exception as e:  # table/colonne absente, dialecte...
            conn.rollback()
            print(f"[ ?? ] {label}\n       non exécuté : {str(e).splitlines()[0][:120]}")
            continue
        if not rows:
            print(f"[ OK ] {label}")
            continue
        total += len(rows)
        print(f"[{level[:4]}] {label} -> {len(rows)} enregistrement(s)")
        for r in rows[:5]:
            print("       ", tuple(r))
print(f"\nTotal anomalies : {total}")
