import json
import subprocess
import time


TABLE = "`adrialvallis.customers.customer_modified`"
CACHE_TTL_SECONDS = 15 * 60
_CACHE = {"loaded_at": 0, "payload": None}


class BigQueryDashboardError(RuntimeError):
    pass


def _run_query(query, max_rows=100):
    command = [
        "bq",
        "query",
        "--use_legacy_sql=false",
        "--format=json",
        f"--max_rows={max_rows}",
        query,
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "Unknown BigQuery error"
        raise BigQueryDashboardError(detail)
    try:
        return json.loads(result.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise BigQueryDashboardError(f"Could not parse BigQuery response: {exc}") from exc


def _one(query):
    rows = _run_query(query, max_rows=1)
    return rows[0] if rows else {}


def _build_insights(summary, recency, markets, email_status, clv_ranges):
    customers = float(summary.get("customers") or 0)
    total_sales = float(summary.get("total_sales") or 0)
    active_90 = next((row for row in recency if row.get("recency_bucket") == "0-90 days"), {})
    active_90_customers = float(active_90.get("customers") or 0)
    active_90_sales = float(active_90.get("sales") or 0)
    top_market = markets[0] if markets else {}
    subscribed = next((row for row in email_status if row.get("email_status") == "Subscribed"), {})
    high_clv = sum(
        float(row.get("sales") or 0)
        for row in clv_ranges
        if row.get("clv_range") not in {"0 - 100", "Unknown"}
    )

    def pct(part, whole):
        return round((part / whole) * 100, 1) if whole else 0

    return [
        {
            "title": "Recent buyers are the strongest segment",
            "body": f"Customers active in the last 90 days are {pct(active_90_customers, customers)}% of the base but generate {pct(active_90_sales, total_sales)}% of lifetime sales.",
        },
        {
            "title": "Italy carries the largest revenue pool",
            "body": f"{top_market.get('market', 'Top market')} contributes {pct(float(top_market.get('sales') or 0), total_sales)}% of total sales across {int(float(top_market.get('customers') or 0)):,} customers.",
        },
        {
            "title": "High CLV customers are rare but material",
            "body": f"Customers above the 0-100 CLV range account for roughly {pct(high_clv, total_sales)}% of revenue despite being a small tail of the base.",
        },
        {
            "title": "Subscribed email audience has real value",
            "body": f"Subscribed customers represent {pct(float(subscribed.get('customers') or 0), customers)}% of records and {pct(float(subscribed.get('sales') or 0), total_sales)}% of sales.",
        },
    ]


def load_customer_dashboard(force_refresh=False):
    now = time.time()
    if (
        not force_refresh
        and _CACHE["payload"]
        and now - _CACHE["loaded_at"] < CACHE_TTL_SECONDS
    ):
        return _CACHE["payload"]

    summary = _one(
        f"""
        SELECT
          COUNT(*) AS customers,
          COUNTIF(total_sales IS NOT NULL) AS customers_with_sales,
          ROUND(SUM(total_sales), 2) AS total_sales,
          ROUND(AVG(total_sales), 2) AS avg_customer_sales,
          ROUND(APPROX_QUANTILES(total_sales, 100)[OFFSET(50)], 2) AS median_customer_sales,
          ROUND(AVG(aov), 2) AS avg_aov,
          ROUND(AVG(distinct_order_count), 2) AS avg_orders,
          ROUND(AVG(months_active), 2) AS avg_months_active,
          MIN(first_purchase_date) AS first_purchase_min,
          MAX(last_purchase_date) AS last_purchase_max
        FROM {TABLE}
        """
    )

    markets = _run_query(
        f"""
        SELECT
          COALESCE(market, 'Unknown') AS market,
          COUNT(*) AS customers,
          ROUND(SUM(total_sales), 2) AS sales,
          ROUND(AVG(total_sales), 2) AS avg_sales,
          ROUND(AVG(aov), 2) AS avg_aov,
          ROUND(AVG(distinct_order_count), 2) AS avg_orders
        FROM {TABLE}
        GROUP BY market
        ORDER BY sales DESC
        LIMIT 12
        """,
        max_rows=12,
    )

    recency = _run_query(
        f"""
        SELECT
          CASE
            WHEN last_purchase_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY) THEN '0-90 days'
            WHEN last_purchase_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY) THEN '91-180 days'
            WHEN last_purchase_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY) THEN '181-365 days'
            WHEN last_purchase_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 730 DAY) THEN '1-2 years'
            WHEN last_purchase_date IS NULL THEN 'No purchase date'
            ELSE '2+ years'
          END AS recency_bucket,
          COUNT(*) AS customers,
          ROUND(SUM(total_sales), 2) AS sales,
          ROUND(AVG(total_sales), 2) AS avg_sales
        FROM {TABLE}
        GROUP BY recency_bucket
        ORDER BY CASE recency_bucket
          WHEN '0-90 days' THEN 1
          WHEN '91-180 days' THEN 2
          WHEN '181-365 days' THEN 3
          WHEN '1-2 years' THEN 4
          WHEN '2+ years' THEN 5
          ELSE 6
        END
        """,
        max_rows=10,
    )

    clv_ranges = _run_query(
        f"""
        SELECT
          COALESCE(clv_range, 'Unknown') AS clv_range,
          COUNT(*) AS customers,
          ROUND(SUM(total_sales), 2) AS sales,
          ROUND(AVG(total_sales), 2) AS avg_sales,
          ROUND(AVG(distinct_order_count), 2) AS avg_orders
        FROM {TABLE}
        GROUP BY clv_range
        ORDER BY sales DESC
        LIMIT 14
        """,
        max_rows=14,
    )

    email_status = _run_query(
        f"""
        SELECT
          COALESCE(email_status, 'Unknown') AS email_status,
          COUNT(*) AS customers,
          ROUND(SUM(total_sales), 2) AS sales
        FROM {TABLE}
        GROUP BY email_status
        ORDER BY customers DESC
        LIMIT 10
        """,
        max_rows=10,
    )

    regions = _run_query(
        f"""
        SELECT
          COALESCE(region, 'Unknown') AS region,
          COUNT(*) AS customers,
          ROUND(SUM(total_sales), 2) AS sales,
          ROUND(AVG(total_sales), 2) AS avg_sales
        FROM {TABLE}
        GROUP BY region
        ORDER BY sales DESC
        LIMIT 15
        """,
        max_rows=15,
    )

    acquisition = _run_query(
        f"""
        SELECT
          EXTRACT(YEAR FROM first_purchase_date) AS year,
          COUNT(*) AS new_customers,
          ROUND(SUM(total_sales), 2) AS lifetime_sales
        FROM {TABLE}
        WHERE first_purchase_date IS NOT NULL
        GROUP BY year
        ORDER BY year
        """,
        max_rows=30,
    )

    product_affinity = _run_query(
        f"""
        SELECT
          'Contact lenses' AS segment,
          COUNTIF(LOWER(customer_has_bought_contact_lenses) IN ('yes', 'true', '1', 'y')) AS customers,
          ROUND(SUM(IF(LOWER(customer_has_bought_contact_lenses) IN ('yes', 'true', '1', 'y'), total_sales, 0)), 2) AS sales
        FROM {TABLE}
        UNION ALL
        SELECT
          'Sunglasses',
          COUNTIF(LOWER(customer_has_bought_sunglasses) IN ('yes', 'true', '1', 'y')),
          ROUND(SUM(IF(LOWER(customer_has_bought_sunglasses) IN ('yes', 'true', '1', 'y'), total_sales, 0)), 2)
        FROM {TABLE}
        UNION ALL
        SELECT
          'Eyeglasses / dpt sunglasses',
          COUNTIF(LOWER(customer_has_bought_eyeglasses_sunglasses_dpt) IN ('yes', 'true', '1', 'y')),
          ROUND(SUM(IF(LOWER(customer_has_bought_eyeglasses_sunglasses_dpt) IN ('yes', 'true', '1', 'y'), total_sales, 0)), 2)
        FROM {TABLE}
        """,
        max_rows=5,
    )

    payload = {
        "table": "adrialvallis.customers.customer_modified",
        "loaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": summary,
        "markets": markets,
        "recency": recency,
        "clv_ranges": clv_ranges,
        "email_status": email_status,
        "regions": regions,
        "acquisition": acquisition,
        "product_affinity": product_affinity,
        "insights": _build_insights(summary, recency, markets, email_status, clv_ranges),
    }
    _CACHE.update({"loaded_at": now, "payload": payload})
    return payload
