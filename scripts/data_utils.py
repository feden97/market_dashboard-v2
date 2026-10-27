"""Pure conversions shared by the snapshot builder and its offline tests."""
from datetime import date
from math import isfinite


def normalize_ipc_items(items):
    """ArgentinaDatos reports percentages, including zero and negative values."""
    history = {}
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or isinstance(item.get("valor"), bool):
            continue
        try:
            value = float(item["valor"])
            month = date.fromisoformat(item["fecha"][:10]).isoformat()[:7]
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if isfinite(value) and value > -100:
            history[month] = value / 100
    return history
