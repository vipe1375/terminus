"""Serveur du jeu du metro.

Choisit une station par jour (meme station pour tout le monde) et ne revele
jamais son nom au client avant que la partie soit terminee. Les jours passes
sont rejouables via un parametre date ; les jours futurs sont toujours refuses.
Bibliotheque standard uniquement.

Lancer : python3 server.py   (http://localhost:8000)
"""
import json
import math
import os
import random
import unicodedata
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
STATIONS_PATH = os.path.join(ROOT, "data", "stations_ranked.json")

PORT = int(os.environ.get("PORT", "8000"))

# Reglages figes
LAUNCH_DATE = date(2026, 7, 13) 
POINTS = {
  "1": { "attempts": 10, "streets": 15, "lines": 25, "neighbours": 30 },
  "2": { "attempts": 8,  "streets": 13, "lines": 22, "neighbours": 26 },
  "3": { "attempts": 7,  "streets": 11, "lines": 18, "neighbours": 22 },
  "4": { "attempts": 6,  "streets": 9,  "lines": 15, "neighbours": 18 },
  "5": { "attempts": 5,  "streets": 7,  "lines": 12, "neighbours": 15 }
}

DAILY_SEED = os.environ.get("DAILY_SEED")
EPOCH = date(2024, 1, 1)

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}

with open(STATIONS_PATH, encoding="utf-8") as f:
    STATIONS = json.load(f)

_DAILY_ORDER = list(range(len(STATIONS)))
random.Random(DAILY_SEED).shuffle(_DAILY_ORDER)


def normalize(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "".join(c for c in s.lower() if c.isalnum())


NORM_INDEX = {normalize(s["name"]): s for s in STATIONS}


def target_for(day):
    idx = (day - EPOCH).days % len(STATIONS)
    return STATIONS[_DAILY_ORDER[idx]]


# Parse une date client et la borne : jamais dans le futur.
def safe_day(value):
    try:
        day = datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return date.today()
    return min(day, date.today())


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, rel):
        full = os.path.normpath(os.path.join(PUBLIC, rel))
        if not full.startswith(PUBLIC) or not os.path.isfile(full):
            return self._send_json({"error": "not found"}, 404)
        ext = os.path.splitext(full)[1]
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except ValueError:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            return self._send_file("index.html")
        if path == "/api/daily":
            qs = parse_qs(parsed.query)
            return self._daily(safe_day(qs.get("date", [None])[0]))
        if path == "/api/archive":
            return self._archive()
        if path == "/api/stations":
            return self._send_json([s["name"] for s in STATIONS])
        return self._send_file(path.lstrip("/"))

    def do_POST(self):
        if urlparse(self.path).path == "/api/guess":
            return self._guess(self._read_json_body())
        return self._send_json({"error": "not found"}, 404)

    def _daily(self, day):
        target = target_for(day)
        maxRadius = target["difficulty"]*150 + 500
        neighbourRadius = 2 * maxRadius
        neighbours = [
            {"lat": s["lat"], "lon": s["lon"], "lines": s["lines"], "name": s["name"]}
            for s in STATIONS
            if haversine(target["lat"], target["lon"], s["lat"], s["lon"]) <= neighbourRadius
        ]
        self._send_json({
            "date": day.isoformat(),
            "lat": target["lat"], "lon": target["lon"], "lines": target["lines"],
            "difficulty": target["difficulty"],
            "neighbours": neighbours,
            "radiusMeters": maxRadius,
            "points": POINTS[str(target["difficulty"])]
        })

    def _archive(self):
        today = date.today()
        days = []
        d = LAUNCH_DATE
        while d < today:  # exclut aujourd'hui (jour courant, non spoile)
            target = target_for(d)
            days.append({"date": d.isoformat(), "difficulty": target["difficulty"]})
            d += timedelta(days=1)
        days.reverse()  # plus recents en premier
        self._send_json(days)

    def _guess(self, body):
        day = safe_day(body.get("date"))  # passe accepte, futur borne a aujourd'hui
        guess = NORM_INDEX.get(normalize(body.get("name", "")))
        if not guess:
            return self._send_json({"error": "unknown_station"}, 400)

        target = target_for(day)
        correct = normalize(guess["name"]) == normalize(target["name"])

        res = {"correct": correct}
        if correct or body.get("points") <= 0:
            res["name"] = target["name"]
        self._send_json(res)


def main():
    print(f"Metro du jour -> http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
