from app.core.security import hash_session_token
import os, sys, uuid
from datetime import datetime, timedelta
os.environ["DATABASE_URL"] = "sqlite:////tmp/gs_test.db"
if os.path.exists("/tmp/gs_test.db"): os.remove("/tmp/gs_test.db")
sys.path.insert(0, "/home/claude/work/GotoShop/backend")
sys.path.insert(0, "/home/claude/work/GotoShop")

from fastapi.testclient import TestClient
from app.main import app, ensure_database_initialized
from app.database import SessionLocal
from app.models.store import Store, Owner
from app.models.customer import Customer
from app.models.order import Order
from app.models.loyalty import LoyaltyLedgerEntry, LoyaltyRewardCoupon
from app.services.loyalty_service import LoyaltyService
from app.core.clock import utcnow

ensure_database_initialized(force=True)
c = TestClient(app)
db = SessionLocal()
u = lambda: str(uuid.uuid4())

owner = Owner(id=u(), full_name="Own", email=f"o{u()[:6]}@x.com", phone_number="0700")
db.add(owner); db.flush()
store = Store(id=u(), owner_id=owner.id, name="S", slug="s-"+u()[:6]); db.add(store); db.flush()
alice = Customer(id=u(), store_id=store.id, name="Alice", phone="70000001", session_token=hash_session_token("tok-alice")); 
bob   = Customer(id=u(), store_id=store.id, name="Bob",   phone="70000002", session_token=hash_session_token("tok-bob"))
db.add_all([alice, bob]); db.flush()
def mk_order(cust=None, token=None):
    o = Order(id=u(), order_number="T-"+u()[:6].upper(), store_id=store.id, customer_id=cust.id if cust else None,
              customer_token=token, customer_name="X", status="PENDING_SELLER_ACCEPTANCE")
    db.add(o); db.flush(); return o
o_alice = mk_order(alice, "tok-alice"); o_guest = mk_order(None, "guest_abc123")
db.commit()

ok=[]; 
def check(name, cond):
    print(("PASS " if cond else "FAIL ")+name); ok.append(cond)

# ---------- 1. ownership
r = c.post(f"/orders/{o_alice.id}/cancel", json={"reason":"x"}); check("cancel sans preuve -> 401", r.status_code==401)
r = c.post(f"/orders/{o_alice.id}/cancel", json={"reason":"x","customer_id":alice.id}); check("customer_id seul -> 401", r.status_code==401)
r = c.post(f"/orders/{o_alice.id}/cancel", json={"reason":"x","customer_token":"tok-bob"}); check("jeton d'un autre client -> 403", r.status_code==403)
r = c.post(f"/orders/{o_alice.id}/cancel", json={"reason":"x","customer_token":"tok-alice","customer_id":bob.id}); check("id incohérent -> 403", r.status_code==403)
r = c.post(f"/orders/{o_alice.id}/archive-client"); check("archive sans corps -> 401", r.status_code==401)
r = c.post(f"/orders/{o_alice.id}/archive-client", json={"customer_token":"tok-bob"}); check("archive autre client -> 403", r.status_code==403)
r = c.post(f"/orders/{o_alice.id}/hide-client", json={"customer_token":"tok-bob"}); check("hide autre client -> 403", r.status_code==403)
r = c.post(f"/intents/{o_alice.order_number}/client-action", json={"action":"CANCEL"}); check("client-action sans preuve -> 401", r.status_code==401)
r = c.post(f"/intents/{o_alice.order_number}/client-action", json={"action":"CANCEL","customer_token":"tok-bob"}); check("client-action autre client -> 403", r.status_code==403)
db.expire_all(); check("commande d'Alice toujours intacte", db.query(Order).get(o_alice.id).status=="PENDING_SELLER_ACCEPTANCE")

r = c.post(f"/orders/{o_alice.id}/archive-client", json={"customer_token":"tok-alice","customer_id":alice.id}); check("archive propriétaire -> 200", r.status_code==200)
r = c.post(f"/orders/{o_guest.id}/cancel", json={"reason":"x","customer_token":"guest_abc123"}); check("annulation invité avec son jeton -> 200", r.status_code==200 and r.json()["status"]=="CANCELLED")
r = c.post(f"/orders/{o_alice.order_number}/cancel", json={"reason":"x","customer_token":"tok-alice"}); check("annulation propriétaire par n° de commande -> 200", r.status_code==200)
r = c.post(f"/orders/inconnu/cancel", json={"customer_token":"tok-alice"}); check("commande inconnue -> 404", r.status_code==404)

# ---------- 2. lots FIFO + expiration
def new_cust(tag):
    cu = Customer(id=u(), store_id=store.id, name=tag, phone="7"+u()[:7].replace("-","1"), session_token=hash_session_token("tok-"+tag)); db.add(cu); db.commit(); return cu
d = new_cust("dave")
e1 = LoyaltyService.credit_points(db, store.id, d.id, 100, order_id="ord-1", validity_days=365)
e2 = LoyaltyService.credit_points(db, store.id, d.id, 50, order_id="ord-2", validity_days=365)
db.refresh(d); check("solde 150", d.bonus_points==150)
# vieillir le lot 1
e1 = db.query(LoyaltyLedgerEntry).get(e1.id); e1.expires_at = utcnow()-timedelta(days=1); db.commit()
n = LoyaltyService.expire_due_points(db, store.id, d.id); db.refresh(d)
check("100 pts expirés", n==100 and d.bonus_points==50)
hist = LoyaltyService.get_ledger_history(db, d.id, store.id)
check("entrée EXPIRED au grand livre", any(h["entry_type"]=="EXPIRED" and h["points"]==-100 for h in hist))
check("expiration idempotente", LoyaltyService.expire_due_points(db, store.id, d.id)==0)

# FIFO sur débit : lot A (expire bientôt) vs lot B (expire tard)
f = new_cust("fred")
la = LoyaltyService.credit_points(db, store.id, f.id, 30, order_id="a", validity_days=10)
lb = LoyaltyService.credit_points(db, store.id, f.id, 30, order_id="b", validity_days=300)
LoyaltyService.debit_points(db, store.id, f.id, 30)
la=db.query(LoyaltyLedgerEntry).get(la.id); lb=db.query(LoyaltyLedgerEntry).get(lb.id); db.refresh(la); db.refresh(lb)
check("débit consomme d'abord le lot qui expire en premier", la.points_remaining==0 and lb.points_remaining==30)
try: LoyaltyService.debit_points(db, store.id, f.id, 999); check("solde insuffisant refusé", False)
except ValueError: check("solde insuffisant refusé", True)

# ---------- 3. rachat via API
g = new_cust("gina")
LoyaltyService.credit_points(db, store.id, g.id, 100, order_id="g1")
r = c.post("/customer/loyalty/redeem", json={"points":40}); check("rachat sans session -> 401", r.status_code==401)
H={"Authorization":"Bearer tok-gina"}
r = c.post("/customer/loyalty/redeem", json={"points":5}, headers=H); check("rachat sous le minimum -> 400", r.status_code==400)
r = c.post("/customer/loyalty/redeem", json={"points":500}, headers=H); check("rachat > solde -> 400", r.status_code==400)
r = c.post("/customer/loyalty/redeem", json={"points":40}, headers=H); j=r.json()
check("rachat 40 pts -> bon 1000 FCFA, solde 60", r.status_code==200 and j["coupon"]["discount_amount"]==1000 and j["balance_after"]==60)
code=j["coupon"]["code"]
s = c.get("/customer/loyalty/summary", headers=H).json(); check("summary: solde 60 + 1 bon", s["balance"]==60 and len(s["coupons"])==1)
# stats ne ré-gonflent pas le solde
st = c.get("/customer/stats", headers=H).json(); check("stats: loyalty_points = 60 (pas de retour des points dépensés)", st["loyalty_points"]==60)
# coupon nominatif
v = LoyaltyService.validate_coupon(db, store.id, code, 5000, customer_id=g.id); check("coupon valide pour son titulaire", v["valid"] and v["discount_amount"]==1000)
v = LoyaltyService.validate_coupon(db, store.id, code, 5000, customer_id=bob.id); check("coupon refusé à un autre client", not v["valid"])
v = LoyaltyService.validate_coupon(db, store.id, code, 5000); check("coupon nominatif refusé sans client", not v["valid"])
r = c.post("/orders/check-coupon", json={"store_id":store.id,"code":code,"order_amount":5000,"customer_token":"tok-gina"}); check("check-coupon avec jeton titulaire", r.json()["valid"])
r = c.post("/orders/check-coupon", json={"store_id":store.id,"code":code,"order_amount":5000,"customer_token":"tok-bob"}); check("check-coupon jeton tiers refusé", not r.json()["valid"])

# ---------- migration / backfill
from sqlalchemy import text
from app.database import engine
from app.migrations import run_migrations
h = new_cust("hugo")
LoyaltyService.credit_points(db, store.id, h.id, 60, order_id="h1"); LoyaltyService.credit_points(db, store.id, h.id, 40, order_id="h2")
LoyaltyService.debit_points(db, store.id, h.id, 70)
with engine.begin() as cn:
    cn.execute(text("UPDATE loyalty_points_ledger SET points_remaining=NULL WHERE customer_id=:c AND points>0"), {"c":h.id})
run_migrations(engine); run_migrations(engine)  # idempotent
db.expire_all()
rem = sorted(e.points_remaining for e in db.query(LoyaltyLedgerEntry).filter(LoyaltyLedgerEntry.customer_id==h.id, LoyaltyLedgerEntry.points>0))
check("backfill FIFO: lots restants [0,30]", rem==[0,30])

print("\nRESULT:", sum(ok), "/", len(ok))
sys.exit(0 if all(ok) else 1)
