"""Horloge UTC « naïve » : remplace datetime.utcnow() (déprécié) sans changer la valeur renvoyée.

La base stocke des dates UTC sans fuseau ; renvoyer une date avec fuseau casserait les comparaisons.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
