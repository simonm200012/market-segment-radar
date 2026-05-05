import base64
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


HOST = "127.0.0.1"
PORT = 8787
TIMEOUT_SECONDS = 12
CACHE_TTL_SECONDS = 60
API_DELAY_SECONDS = 5.2
CACHE = {}


def trading212_base_url(environment):
    return (
        "https://demo.trading212.com/api/v0"
        if str(environment).strip().lower() == "demo"
        else "https://live.trading212.com/api/v0"
    )


def build_auth_header(api_key, api_secret):
    encoded = base64.b64encode(f"{api_key}:{api_secret}".encode("utf-8")).decode("ascii")
    return f"Basic {encoded}"


def get_env_credentials():
    return (
        os.environ.get("T212_API_KEY", "").strip(),
        os.environ.get("T212_API_SECRET", "").strip(),
        os.environ.get("T212_ENV", "").strip().lower(),
    )


def fetch_json(url, auth_header):
    request = Request(
        url,
        headers={
            "Authorization": auth_header,
            "Accept": "application/json",
            "User-Agent": "Codex-T212-Proxy/1.0",
        },
    )
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_json_safe(url, auth_header, label=""):
    """Fetch JSON, returning None on error instead of raising."""
    try:
        return fetch_json(url, auth_header)
    except Exception as exc:
        print(f"  Warning: {label} fetch failed: {exc}")
        return None


def get_cache_key(api_key, environment, endpoint="investments"):
    return f"{endpoint}:{environment}:{api_key}"


def read_cache(api_key, environment, endpoint="investments"):
    key = get_cache_key(api_key, environment, endpoint)
    entry = CACHE.get(key)
    if not entry:
        return None
    if time.time() - entry["stored_at"] > CACHE_TTL_SECONDS:
        CACHE.pop(key, None)
        return None
    return entry["payload"]


def write_cache(api_key, environment, payload, endpoint="investments"):
    CACHE[get_cache_key(api_key, environment, endpoint)] = {
        "stored_at": time.time(),
        "payload": payload,
    }


def resolve_credentials(payload):
    api_key = str(payload.get("apiKey") or "").strip()
    api_secret = str(payload.get("apiSecret") or "").strip()
    environment = str(payload.get("env") or "live").strip().lower()
    env_api_key, env_api_secret, env_name = get_env_credentials()
    if not api_key:
        api_key = env_api_key
    if not api_secret:
        api_secret = env_api_secret
    if payload.get("env") in (None, "") and env_name:
        environment = env_name
    return api_key, api_secret, environment


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _parse_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw_body or "{}")
        except json.JSONDecodeError:
            return None

    def _check_rate_limit(self, api_key, environment):
        error_cache_key = "error:" + get_cache_key(api_key, environment)
        error_entry = CACHE.get(error_cache_key)
        if error_entry and time.time() - error_entry["stored_at"] < 30:
            self._send_json(
                {"error": error_entry["payload"] + " (rate-limited, retry in ~30s)"},
                status=502,
            )
            return True
        return False

    def _record_error(self, api_key, environment, msg):
        error_cache_key = "error:" + get_cache_key(api_key, environment)
        CACHE[error_cache_key] = {"stored_at": time.time(), "payload": msg}

    def do_OPTIONS(self):
        self._send_json({}, status=204)

    def do_POST(self):
        if self.path == "/api/investments":
            self._handle_investments()
        elif self.path == "/api/orders":
            self._handle_orders()
        elif self.path == "/api/pies":
            self._handle_pies()
        else:
            self._send_json({"error": "Not found"}, status=404)

    def _handle_investments(self):
        payload = self._parse_body()
        if payload is None:
            self._send_json({"error": "Invalid JSON body"}, status=400)
            return

        api_key, api_secret, environment = resolve_credentials(payload)
        if not api_key or not api_secret:
            self._send_json({"error": "Missing Trading 212 credentials."}, status=400)
            return

        cached = read_cache(api_key, environment, "investments")
        if cached is not None:
            self._send_json(cached)
            return

        if self._check_rate_limit(api_key, environment):
            return

        auth_header = build_auth_header(api_key, api_secret)
        base_url = trading212_base_url(environment)

        try:
            summary = fetch_json(base_url + "/equity/account/summary", auth_header)
            time.sleep(API_DELAY_SECONDS)
            positions = fetch_json(base_url + "/equity/positions", auth_header)
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            msg = f"Trading 212 request failed ({exc.code}): {details or exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return
        except (URLError, TimeoutError, ValueError) as exc:
            msg = f"Trading 212 request failed: {exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return

        response_payload = {
            "summary": summary,
            "positions": positions,
            "meta": {"environment": environment, "cached": False},
        }
        write_cache(api_key, environment, response_payload, "investments")
        self._send_json(response_payload)

    def _handle_orders(self):
        payload = self._parse_body()
        if payload is None:
            self._send_json({"error": "Invalid JSON body"}, status=400)
            return

        api_key, api_secret, environment = resolve_credentials(payload)
        if not api_key or not api_secret:
            self._send_json({"error": "Missing Trading 212 credentials."}, status=400)
            return

        cached = read_cache(api_key, environment, "orders")
        if cached is not None:
            self._send_json(cached)
            return

        if self._check_rate_limit(api_key, environment):
            return

        auth_header = build_auth_header(api_key, api_secret)
        base_url = trading212_base_url(environment)

        try:
            orders = fetch_json(base_url + "/equity/history/orders", auth_header)
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            msg = f"Order history failed ({exc.code}): {details or exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return
        except (URLError, TimeoutError, ValueError) as exc:
            msg = f"Order history failed: {exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return

        response_payload = {"orders": orders}
        write_cache(api_key, environment, response_payload, "orders")
        self._send_json(response_payload)

    def _handle_pies(self):
        payload = self._parse_body()
        if payload is None:
            self._send_json({"error": "Invalid JSON body"}, status=400)
            return

        api_key, api_secret, environment = resolve_credentials(payload)
        if not api_key or not api_secret:
            self._send_json({"error": "Missing Trading 212 credentials."}, status=400)
            return

        cached = read_cache(api_key, environment, "pies")
        if cached is not None:
            self._send_json(cached)
            return

        if self._check_rate_limit(api_key, environment):
            return

        auth_header = build_auth_header(api_key, api_secret)
        base_url = trading212_base_url(environment)

        try:
            pies_list = fetch_json(base_url + "/equity/pies", auth_header)
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            msg = f"Pies fetch failed ({exc.code}): {details or exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return
        except (URLError, TimeoutError, ValueError) as exc:
            msg = f"Pies fetch failed: {exc}"
            self._record_error(api_key, environment, msg)
            self._send_json({"error": msg}, status=502)
            return

        # Fetch details for each pie (with delays)
        detailed_pies = []
        for pie in (pies_list if isinstance(pies_list, list) else []):
            pie_id = pie.get("id")
            if not pie_id:
                detailed_pies.append(pie)
                continue
            time.sleep(API_DELAY_SECONDS)
            detail = fetch_json_safe(
                base_url + f"/equity/pies/{pie_id}", auth_header, f"pie {pie_id}"
            )
            if detail:
                detailed_pies.append(detail)
            else:
                detailed_pies.append(pie)

        response_payload = {"pies": detailed_pies}
        write_cache(api_key, environment, response_payload, "pies")
        self._send_json(response_payload)

    def log_message(self, format, *args):
        # Suppress noisy logs for OPTIONS
        if len(args) >= 1 and "OPTIONS" in str(args[0]):
            return
        super().log_message(format, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    server = HTTPServer((HOST, port), Handler)
    print(f"Trading 212 proxy listening on http://{HOST}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping proxy...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
