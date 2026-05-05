from collections import defaultdict


STRATEGY_PROFILES = {
    "balanced": {"quality": 1.0, "value": 1.0, "momentum": 1.0, "sentiment": 0.8, "risk": 1.0},
    "aggressive-short": {"quality": 1.1, "value": 1.4, "momentum": 1.2, "sentiment": 1.0, "risk": 1.3},
    "quality-long": {"quality": 1.4, "value": 0.8, "momentum": 1.0, "sentiment": 0.7, "risk": 0.9},
}


def clamp(value, low, high):
    return max(low, min(high, value))


def score_stock(stock, strategy):
    weights = STRATEGY_PROFILES.get(strategy, STRATEGY_PROFILES["balanced"])

    quality = (
        stock["earnings_revision"] * 2.1
        + stock["revenue_growth"] * 0.8
        + stock["gross_margin_trend"] * 1.4
    ) * weights["quality"]
    momentum = (stock["price_change_1m"] * 1.3 + stock["price_change_3m"] * 0.7) * weights["momentum"]
    value = (-stock["valuation_zscore"] * 14) * weights["value"]
    sentiment = (stock["news_sentiment"] * 22) * weights["sentiment"]

    long_score = 50 + quality + momentum + value + sentiment - (stock["event_risk"] * 16 * weights["risk"])
    short_score = (
        50
        - quality
        - momentum
        - sentiment
        + (stock["valuation_zscore"] * 18 * weights["value"])
        - (stock["borrow_fee"] * 1.6 * weights["risk"])
        - (stock["short_interest"] * 1.1 * weights["risk"])
        - (stock["event_risk"] * 10 * weights["risk"])
    )

    long_score = round(clamp(long_score, 0, 100), 1)
    short_score = round(clamp(short_score, 0, 100), 1)

    if short_score > long_score + 7:
        stance = "Potential short candidate"
    elif long_score > short_score + 7:
        stance = "Potential long candidate"
    else:
        stance = "Mixed / watchlist"

    reasons = []
    if stock["earnings_revision"] < -4:
        reasons.append("Analyst earnings revisions are deteriorating.")
    if stock["gross_margin_trend"] < -2:
        reasons.append("Margins are compressing, which often pressures future earnings.")
    if stock["valuation_zscore"] > 1.2:
        reasons.append("Valuation looks stretched relative to peers.")
    if stock["price_change_3m"] < -10:
        reasons.append("Medium-term price momentum remains weak.")
    if stock["news_sentiment"] < -0.15:
        reasons.append("Recent news flow has been net negative.")
    if stock["borrow_fee"] > 5 or stock["short_interest"] > 15:
        reasons.append("Short squeeze and borrow cost risk are elevated.")
    if not reasons:
        reasons.append("Signals are fairly balanced; conviction is lower here.")

    return {
        "ticker": stock["ticker"],
        "name": stock["name"],
        "sector": stock["sector"],
        "industry": stock["industry"],
        "marketCapB": stock["market_cap"],
        "currentPrice": stock.get("current_price"),
        "dayChange": stock.get("day_change"),
        "dayChangePercent": stock.get("day_change_percent"),
        "analystTargetPrice": stock.get("analyst_target_price"),
        "longScore": long_score,
        "shortScore": short_score,
        "stance": stance,
        "reasons": reasons[:4],
        "metrics": {
            "priceChange1M": stock["price_change_1m"],
            "priceChange3M": stock["price_change_3m"],
            "earningsRevision": stock["earnings_revision"],
            "revenueGrowth": stock["revenue_growth"],
            "grossMarginTrend": stock["gross_margin_trend"],
            "valuationZScore": stock["valuation_zscore"],
            "shortInterest": stock["short_interest"],
            "borrowFee": stock["borrow_fee"],
            "newsSentiment": stock["news_sentiment"],
            "eventRisk": stock["event_risk"],
        },
    }


def build_sector_summary(scored_stocks):
    grouped = defaultdict(list)
    for stock in scored_stocks:
        grouped[stock["sector"]].append(stock)

    summaries = []
    for sector, members in grouped.items():
        avg_long = round(sum(item["longScore"] for item in members) / len(members), 1)
        avg_short = round(sum(item["shortScore"] for item in members) / len(members), 1)
        if avg_long > avg_short + 5:
            outlook = "Favor for longs"
        elif avg_short > avg_long + 5:
            outlook = "Fragile / short-biased"
        else:
            outlook = "Neutral rotation"

        summaries.append(
            {
                "sector": sector,
                "stockCount": len(members),
                "avgLongScore": avg_long,
                "avgShortScore": avg_short,
                "outlook": outlook,
            }
        )

    return sorted(summaries, key=lambda item: (item["avgLongScore"] - item["avgShortScore"]), reverse=True)


def build_dashboard_payload(
    market_data,
    strategy="balanced",
    source_meta=None,
    source_mode="sample",
    warnings=None,
):
    scored = [score_stock(stock, strategy) for stock in market_data]
    sectors = build_sector_summary(scored)
    longs = sorted(scored, key=lambda item: item["longScore"], reverse=True)[:5]
    shorts = sorted(scored, key=lambda item: item["shortScore"], reverse=True)[:5]
    watches = sorted(
        scored,
        key=lambda item: abs(item["longScore"] - item["shortScore"])
    )[:5]
    spread = round(
        sum(item["longScore"] - item["shortScore"] for item in scored) / len(scored),
        1,
    ) if scored else None

    return {
        "strategy": strategy,
        "summary": {
            "universeSize": len(scored),
            "topLongSector": sectors[0]["sector"] if sectors else None,
            "topShortSector": sectors[-1]["sector"] if sectors else None,
            "averageLongShortSpread": spread,
        },
        "dataSource": source_meta
        or {
            "active": "Prototype sample dataset",
            "next": [
                "Yahoo Finance ingestion adapter for rapid prototyping",
                "Bloomberg-grade licensed feed for production research",
            ],
        },
        "sourceMode": source_mode,
        "warnings": warnings or [],
        "sectors": sectors,
        "topLongs": longs,
        "topShorts": shorts,
        "watchlist": watches,
        "disclaimer": (
            "Research dashboard only. Uses heuristic scoring and may rely on fallback data. "
            "Not investment advice."
        ),
    }
