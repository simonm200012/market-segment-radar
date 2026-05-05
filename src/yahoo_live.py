import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


WATCHLIST = [
    "NVDA",
    "AMD",
    "PLUG",
    "TSLA",
    "XOM",
    "CVX",
    "COST",
    "WBA",
    "JPM",
    "AAL",
]


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def _fetch_json(url):
    request = Request(url, headers=DEFAULT_HEADERS)
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _safe_ratio(current_value, prior_value):
    if current_value in (None, 0) or prior_value in (None, 0):
        return 0.0
    return ((current_value - prior_value) / abs(prior_value)) * 100


def _normalize_sentiment(summary_text):
    if not summary_text:
        return 0.0

    text = summary_text.lower()
    positive_terms = ["growth", "strong", "leading", "benefit", "expansion", "improve"]
    negative_terms = ["decline", "weak", "risk", "volatile", "pressure", "loss"]
    score = sum(term in text for term in positive_terms) - sum(term in text for term in negative_terms)
    return max(-1.0, min(1.0, score / 6))


def _extract_quote_summary(symbol):
    modules = ",".join(
        [
            "price",
            "summaryProfile",
            "defaultKeyStatistics",
            "financialData",
            "summaryDetail",
        ]
    )
    url = (
        "https://query1.finance.yahoo.com/v10/finance/quoteSummary/"
        f"{quote(symbol)}?modules={modules}"
    )
    payload = _fetch_json(url)
    result = payload["quoteSummary"]["result"]
    if not result:
        raise ValueError(f"No quote summary returned for {symbol}")
    return result[0]


def _extract_chart(symbol):
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{quote(symbol)}?range=6mo&interval=1d"
    )
    payload = _fetch_json(url)
    result = payload["chart"]["result"]
    if not result:
        raise ValueError(f"No chart data returned for {symbol}")
    return result[0]


def _first_present(*values, default=None):
    for value in values:
        if value is not None:
            return value
    return default


def _to_stock_record(symbol, summary, chart):
    price = summary.get("price", {})
    profile = summary.get("summaryProfile", {})
    stats = summary.get("defaultKeyStatistics", {})
    financial = summary.get("financialData", {})
    detail = summary.get("summaryDetail", {})

    closes = chart.get("indicators", {}).get("quote", [{}])[0].get("close", [])
    closes = [value for value in closes if value is not None]
    current_price = _first_present(
        price.get("regularMarketPrice", {}).get("raw"),
        closes[-1] if closes else None,
        default=0.0,
    )
    month_ago = closes[-22] if len(closes) >= 22 else current_price
    three_months_ago = closes[-66] if len(closes) >= 66 else month_ago

    recommendation = financial.get("recommendationMean", {}).get("raw")
    earnings_growth = financial.get("earningsGrowth", {}).get("raw")
    revenue_growth = financial.get("revenueGrowth", {}).get("raw")
    gross_margins = financial.get("grossMargins", {}).get("raw")
    target_price = financial.get("targetMeanPrice", {}).get("raw")
    current_day_change = price.get("regularMarketChange", {}).get("raw")
    current_day_change_pct = price.get("regularMarketChangePercent", {}).get("raw")
    previous_close = detail.get("previousClose", {}).get("raw")
    trailing_pe = detail.get("trailingPE", {}).get("raw")
    forward_pe = detail.get("forwardPE", {}).get("raw")
    short_percent_float = stats.get("shortPercentOfFloat", {}).get("raw")
    shares_short = stats.get("sharesShort", {}).get("raw")
    float_shares = stats.get("floatShares", {}).get("raw")
    beta = detail.get("beta", {}).get("raw")

    short_interest = _first_present(
        short_percent_float * 100 if short_percent_float is not None else None,
        (shares_short / float_shares) * 100 if shares_short and float_shares else None,
        default=0.0,
    )

    valuation_gap = 0.0
    if trailing_pe is not None and forward_pe is not None and forward_pe != 0:
        valuation_gap = (trailing_pe - forward_pe) / abs(forward_pe)
    elif trailing_pe is not None:
        valuation_gap = trailing_pe / 25.0

    earnings_revision = 0.0
    if recommendation is not None:
        earnings_revision += (3.0 - recommendation) * 4.0
    if target_price is not None and current_price:
        earnings_revision += ((target_price - current_price) / current_price) * 12.0
    if earnings_growth is not None:
        earnings_revision += earnings_growth * 5.0

    long_summary = profile.get("longBusinessSummary", "")

    return {
        "ticker": symbol,
        "name": price.get("shortName", symbol),
        "sector": profile.get("sector", "Unknown"),
        "industry": profile.get("industry", "Unknown"),
        "market_cap": round(
            (_first_present(price.get("marketCap", {}).get("raw"), default=0.0)) / 1_000_000_000,
            1,
        ),
        "current_price": round(current_price, 2),
        "day_change": round(
            _first_present(
                current_day_change,
                current_price - previous_close if previous_close not in (None, 0) else None,
                default=0.0,
            ),
            2,
        ),
        "day_change_percent": round(
            _first_present(
                current_day_change_pct,
                _safe_ratio(current_price, previous_close),
                default=0.0,
            ),
            2,
        ),
        "analyst_target_price": round(target_price, 2) if target_price is not None else None,
        "price_change_1m": round(_safe_ratio(current_price, month_ago), 1),
        "price_change_3m": round(_safe_ratio(current_price, three_months_ago), 1),
        "earnings_revision": round(earnings_revision, 1),
        "revenue_growth": round((_first_present(revenue_growth, default=0.0)) * 100, 1),
        "gross_margin_trend": round(((_first_present(gross_margins, default=0.0)) - 0.35) * 100, 1),
        "valuation_zscore": round(valuation_gap, 2),
        "short_interest": round(short_interest, 1),
        "borrow_fee": round(max(0.2, short_interest * 0.18), 1),
        "news_sentiment": round(_normalize_sentiment(long_summary), 2),
        "event_risk": round(min(1.0, _first_present(beta, default=1.0) / 2.5), 2),
    }


def load_live_market_data(symbols=None):
    tickers = symbols or WATCHLIST
    records = []
    errors = []

    for symbol in tickers:
        try:
            summary = _extract_quote_summary(symbol)
            chart = _extract_chart(symbol)
            records.append(_to_stock_record(symbol, summary, chart))
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
            errors.append(f"{symbol}: {exc}")

    if not records:
        raise RuntimeError("Unable to load any Yahoo Finance data.")

    return {
        "records": records,
        "errors": errors,
        "meta": {
            "active": "Yahoo Finance live snapshot",
            "next": [
                "Current watchlist fetched at request time",
                "Falls back to sample data if Yahoo is unavailable",
            ],
        },
    }
