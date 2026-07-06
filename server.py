#!/usr/bin/env python3
"""Serveur du jeu du metro.

Choisit une station par jour (meme station pour tout le monde) et ne revele
jamais son nom au client avant que la partie soit terminee (trouvee ou essais
epuises). Bibliotheque standard uniquement.

Lancer : python3 server.py   (http://localhost:8000)
"""
import json
import math
import os
import random
import unicodedata
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
STATIONS_PATH = os.path.join(ROOT, "data", "stations_merged.json")

PORT = int(os.environ.get("PORT", "8000"))
MAX_RADIUS = 500     # metres, doit matcher maxRadius dans game.js
MAX_GUESSES = 6       # doit matcher la limite dans game.js

DAILY_SEED = 20240101
EPOCH = date(2024, 1, 1)

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}

with open(STATIONS_PATH, encoding="utf-8") as f:
    STATIONS = json.load(f)

_DAILY_ORDER = list(range(len(STATIONS)))
random.Random(DAILY_SEED).shuffle(_DAILY_ORDER)

CONFIG_PATH = os.path.join(ROOT, "data", "config.json")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

CONFIG_DEFAULTS = {
    "radiusMeters": 500,
    "maxGuesses": 6,
    "defaultStreetNames": False,
    "defaultLines": False,
    "defaultNeighbours": False,
    "defaultRotation": True,
}

def load_config():
    cfg = dict(CONFIG_DEFAULTS)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg.update({k: v for k, v in json.load(f).items() if k in CONFIG_DEFAULTS})
        except (ValueError, OSError):
            pass
    return cfg

def save_config(cfg):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def normalize(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "".join(c for c in s.lower() if c.isalnum())


NORM_INDEX = {normalize(s["name"]): s for s in STATIONS}


def target_for(day):
    idx = (day - EPOCH).days % len(STATIONS)
    return STATIONS[_DAILY_ORDER[idx]]


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return date.today()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
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
        path = urlparse(self.path).path

        if path == "/":
            return self._send_file("index.html")
        if path == "/api/config":
            return self._send_json(load_config())
        if path == "/api/daily":
            return self._daily(date.today())
        if path == "/api/stations":
            return self._send_json([s["name"] for s in STATIONS])
        if path in ("/admin", "/admin/"):
            return self._send_file("admin.html")
        return self._send_file(path.lstrip("/"))

    def do_POST(self):
        if urlparse(self.path).path == "/api/guess":
            return self._guess(self._read_json_body())
        if urlparse(self.path).path == "/api/admin/config":
            return self._admin_save(self._read_json_body())
        return self._send_json({"error": "not found"}, 404)

    def _admin_save(self, body):
        if body.get("password") != ADMIN_PASSWORD:
            return self._send_json({"error": "unauthorized"}, 401)
        cfg = load_config()
        try:
            if "radiusMeters" in body:
                cfg["radiusMeters"] = max(100, min(50000, int(body["radiusMeters"])))
            if "maxGuesses" in body:
                cfg["maxGuesses"] = max(1, min(12, int(body["maxGuesses"])))
            for key in ("defaultStreetNames", "defaultLines", "defaultNeighbours", "defaultRotation"):
                if key in body:
                    cfg[key] = bool(body[key])
        except (ValueError, TypeError):
            return self._send_json({"error": "invalid_values"}, 400)
        save_config(cfg)
        self._send_json({"ok": True, "config": cfg})

    def _daily(self, day):
        cfg = load_config()
        target = target_for(day)
        neighbours = [
            {"lat": s["lat"], "lon": s["lon"], "lines": s["lines"]}
            for s in STATIONS
            if haversine(target["lat"], target["lon"], s["lat"], s["lon"]) <= cfg["radiusMeters"]
        ]
        self._send_json({
            "date": day.isoformat(),
            "lat": target["lat"], "lon": target["lon"], "lines": target["lines"],
            "neighbours": neighbours,
            "radiusMeters": cfg["radiusMeters"],
            "maxGuesses": cfg["maxGuesses"],
            "defaults": {
                "streetNames": cfg["defaultStreetNames"],
                "lines": cfg["defaultLines"],
                "neighbours": cfg["defaultNeighbours"],
                "rotation": cfg["defaultRotation"],
            },
        })
    
    def _guess(self, body):
        cfg = load_config()
        day = parse_date(body.get("date"))
        attempt = int(body.get("attempt") or 0)
        guess = NORM_INDEX.get(normalize(body.get("name", "")))
        if not guess:
            return self._send_json({"error": "unknown_station"}, 400)
    
        target = target_for(day)
        correct = normalize(guess["name"]) == normalize(target["name"])
    
        res = {"correct": correct}
        if correct or attempt + 1 >= cfg["maxGuesses"]:
            res["name"] = target["name"]
        self._send_json(res)


def main():
    print(f"Metro du jour -> http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()