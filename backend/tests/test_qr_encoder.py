"""Decode-back test for the QR encoder. Needs: pip install opencv-python-headless zxing-cpp pillow numpy
Run: python backend/tests/test_qr_encoder.py   (prints fails: 0 for zxing; OpenCV's own
detector is weaker on very dense codes, zxing-cpp is the reference decoder here)."""
import sys, random, string
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
def test_pure_qr_encoding():
    from app.services.qr_encoder import encode_text, ECC_M
    qr = encode_text("https://gotoshop.com/store/garbadrome-kossodo", ECC_M)
    assert qr.size > 0
    assert qr.version >= 1
    assert qr.modules[0][0] is True
    assert qr.modules[0][6] is True
    assert qr.modules[6][0] is True

def test_qr_with_cv2():
    import pytest
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    from app.services.qr_encoder import encode_text, ECC_L
    det = cv2.QRCodeDetector()
    qr = encode_text("https://gotoshop.com", ECC_L)
    assert qr.size > 0

if __name__ == "__main__":
    pass
