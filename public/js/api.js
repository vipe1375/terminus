/* API locale : remplace le serveur Python (server.py).
 *
 * Tout est calculé dans le navigateur à partir de deux fichiers statiques :
 *   /data/stations_ranked.json  (la liste des stations)
 *   /data/daily_order.json      (l'ordre des stations, exporté depuis server.py)
 * Les fonctions gardent la forme des anciennes réponses de l'API, pour que
 * le reste du front change le moins possible.
 */

const LAUNCH_DATE = "2026-07-13";
const EPOCH = "2024-01-01";
const GAME_TIMEZONE = "Europe/Paris";

const POINTS = {
  1: { attempts: 10, streets: 15, lines: 25, neighbours: 30 },
  2: { attempts: 8, streets: 13, lines: 22, neighbours: 26 },
  3: { attempts: 7, streets: 11, lines: 18, neighbours: 22 },
  4: { attempts: 6, streets: 9, lines: 15, neighbours: 18 },
  5: { attempts: 5, streets: 7, lines: 12, neighbours: 15 },
};

let _stations = null;
let _order = null;
let _byNormalizedName = null;

async function loadGameData() {
  if (_stations) return;
  const [stations, order] = await Promise.all([
    fetch("/data/stations_ranked.json").then((r) => r.json()),
    fetch("/data/daily_order.json").then((r) => r.json()),
  ]);
  _stations = stations;
  _order = order;
  _byNormalizedName = new Map(stations.map((s) => [normalizeName(s.name), s]));
}

/* --- Dates (format ISO AAAA-MM-JJ, jour de Paris pour tout le monde) --- */
function todayISO() {
  // "sv-SE" donne directement AAAA-MM-JJ
  return new Intl.DateTimeFormat("sv-SE", { timeZone: GAME_TIMEZONE }).format(new Date());
}

function isoToUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDaysISO(iso, n) {
  return new Date(isoToUTC(iso) + n * 86400000).toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
  return Math.round((isoToUTC(toISO) - isoToUTC(fromISO)) / 86400000);
}

// Date demandée, bornée : invalide -> aujourd'hui, futur -> aujourd'hui.
function safeDay(value) {
  const today = todayISO();
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  if (addDaysISO(value, 0) !== value) return today; // ex. 2026-02-31
  return value < today ? value : today;
}

/* --- Utilitaires (mêmes règles que server.py) --- */
function normalizeName(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function targetFor(dayISO) {
  const n = _order.length;
  const idx = (((daysBetween(EPOCH, dayISO) % n) + n) % n);
  return _stations[_order[idx]];
}

/* --- Les quatre anciens endpoints --- */
async function loadStationNames() {
  await loadGameData();
  stationsNames = _stations.map((s) => s.name);
}

async function loadDaily() {
  await loadGameData();
  const requested = new URLSearchParams(location.search).get("date");
  const day = safeDay(requested);
  const target = targetFor(day);

  const maxRadius = target.difficulty * 150 + 500;
  const neighbourRadius = 2 * maxRadius;
  const neighbours = _stations
    .filter((s) => haversineMeters(target.lat, target.lon, s.lat, s.lon) <= neighbourRadius)
    .map((s) => ({ lat: s.lat, lon: s.lon, lines: s.lines, name: s.name }));

  return {
    date: day,
    archive: day < todayISO(),
    lat: target.lat,
    lon: target.lon,
    lines: target.lines,
    difficulty: target.difficulty,
    neighbours,
    radiusMeters: maxRadius,
    points: POINTS[target.difficulty],
  };
}

async function apiArchive() {
  await loadGameData();
  const today = todayISO();
  const days = [];
  for (let d = LAUNCH_DATE; d < today; d = addDaysISO(d, 1)) {
    days.push({ date: d, difficulty: targetFor(d).difficulty });
  }
  return days.reverse(); // plus récents en premier
}

// pointsLeft : points restants si cette tentative est fausse.
async function apiGuess(date, name, pointsLeft) {
  await loadGameData();
  const guess = _byNormalizedName.get(normalizeName(name));
  if (!guess) return { error: "unknown_station" };

  const target = targetFor(safeDay(date));
  const correct = normalizeName(guess.name) === normalizeName(target.name);

  const res = { correct };
  if (correct || pointsLeft <= 0) res.name = target.name;
  return res;
}
