import base64
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_TIMEOUT_SECONDS = 10
LIVE_BASE_URL = "https://live.trading212.com/api/v0"
DEMO_BASE_URL = "https://demo.trading212.com/api/v0"


def _get_base_url():
    configured = os.environ.get("T212_BASE_URL", "").strip()
    if configured:
        return configured.rstrip("/")

    environment = os.environ.get("T212_ENV", "live").strip().lower()
    if environment == "demo":
        return DEMO_BASE_URL
    return LIVE_BASE_URL


def _build_auth_header():
    api_key = os.environ.get("T212_API_KEY", "").strip()
    api_secret = os.environ.get("T212_API_SECRET", "").strip()

    if not api_key or not api_secret:
        raise RuntimeError(
            "Trading 212 credentials are missing. Set T212_API_KEY and T212_API_SECRET."
        )

    credentials = f"{api_key}:{api_secret}".encode("utf-8")
    encoded = base64.b64encode(credentials).decode("ascii")
    return f"Basic {encoded}"


def _fetch_json(path):
    request = Request(
        _get_base_url() + path,
        headers={
            "Authorization": _build_auth_header(),
            "Accept": "application/json",
            "User-Agent": "Codex-Investments-Dashboard/1.0",
        },
    )

    with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _round_money(value):
    if value is None:
        return None
    return round(float(value), 2)


def _normalize_position(raw_position):
    instrument = raw_position.get("instrument") or {}
    quantity = float(raw_position.get("quantity") or 0)
    avg_price = float(raw_position.get("averagePricePaid") or 0)
    current_price = float(raw_position.get("currentPrice") or 0)

    cost_basis = avg_price * quantity
    market_value = current_price * quantity
    computed_unrealized = market_value - cost_basis
    wallet_impact = raw_position.get("walletImpact") or {}
    unrealized_profit_loss = wallet_impact.get("unrealizedProfitLoss")

    if unrealized_profit_loss is None:
        unrealized_profit_loss = computed_unrealized

    change_percent = None
    if cost_basis:
        change_percent = (float(unrealized_profit_loss) / cost_basis) * 100

    display_name = (
        instrument.get("shortName")
        or instrument.get("name")
        or instrument.get("ticker")
        or "Unknown"
    )

    return {
        "ticker": instrument.get("ticker") or raw_position.get("ticker") or "UNKNOWN",
        "name": display_name,
        "currency": instrument.get("currencyCode"),
        "quantity": round(quantity, 6),
        "averagePricePaid": _round_money(avg_price),
        "currentPrice": _round_money(current_price),
        "marketValue": _round_money(market_value),
        "costBasis": _round_money(cost_basis),
        "unrealizedProfitLoss": _round_money(unrealized_profit_loss),
        "unrealizedProfitLossPercent": round(change_percent, 2) if change_percent is not None else None,
        "createdAt": raw_position.get("createdAt"),
        "quantityAvailableForTrading": round(
            float(raw_position.get("quantityAvailableForTrading") or 0), 6
        ),
        "quantityInPies": round(float(raw_position.get("quantityInPies") or 0), 6),
    }


def load_investments_snapshot():
    try:
        summary = _fetch_json("/equity/account/summary")
        positions = _fetch_json("/equity/positions")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        message = body or str(exc)
        raise RuntimeError(f"Trading 212 request failed ({exc.code}): {message}") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Unable to load Trading 212 data: {exc}") from exc

    normalized_positions = [_normalize_position(position) for position in positions]
    normalized_positions.sort(key=lambda item: item["marketValue"] or 0, reverse=True)

    total_market_value = sum(position["marketValue"] or 0 for position in normalized_positions)

    for position in normalized_positions:
        allocation = 0
        if total_market_value:
            allocation = (position["marketValue"] / total_market_value) * 100
        position["allocationPercent"] = round(allocation, 2)

    cash = summary.get("cash") or {}
    investments = summary.get("investments") or {}

    return {
        "account": {
            "id": summary.get("id"),
            "currency": summary.get("currency") or "EUR",
            "cash": {
                "availableToTrade": _round_money(cash.get("availableToTrade")),
                "inPies": _round_money(cash.get("inPies")),
                "reservedForOrders": _round_money(cash.get("reservedForOrders")),
            },
            "investments": {
                "currentValue": _round_money(investments.get("currentValue")),
                "totalCost": _round_money(investments.get("totalCost")),
                "unrealizedProfitLoss": _round_money(investments.get("unrealizedProfitLoss")),
                "realizedProfitLoss": _round_money(investments.get("realizedProfitLoss")),
            },
            "totalValue": _round_money(summary.get("totalValue")),
        },
        "positions": normalized_positions,
        "meta": {
            "environment": os.environ.get("T212_ENV", "live").strip().lower() or "live",
            "baseUrl": _get_base_url(),
            "positionCount": len(normalized_positions),
        },
    }
