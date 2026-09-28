"""Test Wallet escrow lifecycle and secure OTP verification."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.store import Store
from app.models.order import Order
from app.services.otp_service import OtpService
from app.services.wallet_service import WalletService
from app.services.loyalty_service import LoyaltyService

def test_otp_service():
    phone = "+22670001122"
    order_id = "test-ord-12345"
    amount = 15000

    # Request OTP
    ok, msg, data = OtpService.request_otp(phone, order_id, amount)
    assert ok is True
    assert "simulated_code" in data
    code = data["simulated_code"]

    # Wrong code must fail
    wrong_code = "999999" if code != "999999" else "888888"
    v_ok, v_msg = OtpService.verify_otp(phone, order_id, wrong_code)
    assert v_ok is False
    assert "incorrect" in v_msg

    # Correct code must succeed
    v_ok2, v_msg2 = OtpService.verify_otp(phone, order_id, code)
    assert v_ok2 is True

    # Replay must fail (consumed)
    v_ok3, v_msg3 = OtpService.verify_otp(phone, order_id, code)
    assert v_ok3 is False

def test_wallet_escrow_lifecycle():
    run_migrations(engine)
    db = SessionLocal()
    store = db.query(Store).first()
    if not store:
        store = Store(name="Test Boutique", slug="test-boutique")
        db.add(store)
        db.commit()

    order_id = f"test-ord-escrow-{os.urandom(4).hex()}"
    amount = 25000

    # 1. Credit Escrow
    tx1 = WalletService.credit_escrow(db, store.id, order_id, amount)
    assert tx1.transaction_type == "ESCROW_CREDIT"
    assert tx1.amount == amount
    w = WalletService.get_or_create_wallet(db, store.id)
    assert w.pending_balance >= amount

    # 2. Release Escrow upon delivery
    bal_avail_before = w.available_balance
    tx2 = WalletService.release_escrow(db, store.id, order_id)
    assert tx2 is not None
    assert tx2.transaction_type == "ESCROW_RELEASE"
    w = WalletService.get_or_create_wallet(db, store.id)
    assert w.available_balance == bal_avail_before + amount

    # 3. Withdrawal request
    w_tx = WalletService.request_withdrawal(db, store.id, 5000, "+22670112233", "ORANGE")
    assert w_tx.transaction_type == "WITHDRAWAL_REQUEST"
    assert w_tx.status == "PENDING"
    assert w_tx.amount == 5000

    # Withdrawal exceeding balance must fail
    with pytest.raises(ValueError):
        WalletService.request_withdrawal(db, store.id, 999999999, "+22670112233", "ORANGE")

    db.close()
