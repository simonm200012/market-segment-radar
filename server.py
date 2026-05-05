from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import sys
from pathlib import Path
import json
from urllib.parse import parse_qs, urlparse

from src.market_data import MARKET_DATA
from src.scoring import build_dashboard_payload
from src.trading212 import load_investments_snapshot
from src.yahoo_live import load_live_market_data
from src.customer_bigquery import BigQueryDashboardError, load_customer_dashboard


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"


class AppHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str):
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/dashboard":
            params = parse_qs(parsed.query)
            strategy = params.get("strategy", ["balanced"])[0]
            source = params.get("source", ["auto"])[0]
            payload = self._dashboard_payload(strategy, source)
            self._send_json(payload)
            return

        if path == "/api/health":
            self._send_json({"status": "ok"})
            return

        if path == "/api/investments":
            try:
                payload = load_investments_snapshot()
                self._send_json(payload)
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=502)
            return

        if path == "/api/customer-dashboard":
            params = parse_qs(parsed.query)
            force_refresh = params.get("refresh", ["0"])[0] == "1"
            try:
                payload = load_customer_dashboard(force_refresh=force_refresh)
                self._send_json(payload)
            except BigQueryDashboardError as exc:
                self._send_json({"error": str(exc)}, status=502)
            return

        if path == "/":
            self._send_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return

        if path == "/customers":
            self._send_file(STATIC_DIR / "customer-dashboard" / "index.html", "text/html; charset=utf-8")
            return

        if path.startswith("/customer-dashboard/"):
            target = (STATIC_DIR / path.lstrip("/")).resolve()
            if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
                self._send_json({"error": "Not found"}, status=404)
                return
            content_type = "text/plain; charset=utf-8"
            if target.suffix == ".html":
                content_type = "text/html; charset=utf-8"
            elif target.suffix == ".js":
                content_type = "application/javascript; charset=utf-8"
            elif target.suffix == ".css":
                content_type = "text/css; charset=utf-8"
            elif target.suffix == ".svg":
                content_type = "image/svg+xml"
            self._send_file(target, content_type)
            return

        if path == "/investments":
            self._send_file(STATIC_DIR / "investments.html", "text/html; charset=utf-8")
            return

        if path == "/styles.css":
            self._send_file(STATIC_DIR / "styles.css", "text/css; charset=utf-8")
            return

        if path == "/app.js":
            self._send_file(STATIC_DIR / "app.js", "application/javascript; charset=utf-8")
            return

        if path == "/investments.js":
            self._send_file(STATIC_DIR / "investments.js", "application/javascript; charset=utf-8")
            return

        self._send_json({"error": "Not found"}, status=404)

    def _dashboard_payload(self, strategy, source):
        if source == "sample":
            return build_dashboard_payload(
                MARKET_DATA,
                strategy=strategy,
                source_meta={
                    "active": "Prototype sample dataset",
                    "next": [
                        "Static watchlist bundled with the app",
                        "Switch to Live Yahoo in the selector when ready",
                    ],
                },
                source_mode="sample",
                warnings=[],
            )

        if source in {"auto", "live"}:
            try:
                live_result = load_live_market_data()
                warnings = []
                if live_result["errors"]:
                    warnings.append(
                        "Some Yahoo tickers failed to load: " + "; ".join(live_result["errors"][:3])
                    )
                return build_dashboard_payload(
                    live_result["records"],
                    strategy=strategy,
                    source_meta=live_result["meta"],
                    source_mode="live",
                    warnings=warnings,
                )
            except RuntimeError as exc:
                if source == "live":
                    return build_dashboard_payload(
                        MARKET_DATA,
                        strategy=strategy,
                        source_meta={
                            "active": "Prototype sample dataset",
                            "next": [
                                "Yahoo live fetch failed for this request",
                                "Check connectivity or try Auto mode",
                            ],
                        },
                        source_mode="fallback",
                        warnings=[str(exc)],
                    )

        return build_dashboard_payload(
            MARKET_DATA,
            strategy=strategy,
            source_meta={
                "active": "Prototype sample dataset",
                "next": [
                    "Yahoo live fetch failed, so sample data is shown",
                    "Retry with network access from your machine",
                ],
            },
            source_mode="fallback",
            warnings=["Yahoo live fetch failed, using sample data instead."],
        )


def main():
    host = "127.0.0.1"
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8000"))
    server = HTTPServer((host, port), AppHandler)
    print(f"Serving on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
