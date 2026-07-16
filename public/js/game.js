const maxZoom = 19;
let dynamicMinZoom = null;
let maxRadius = 500;
let maxGuesses = 6;

// Style vectoriel libre (OpenFreeMap). Les libellés sont masqués au départ
// et réaffichés via l'option "noms des rues".
const mapStyle = "https://tiles.openfreemap.org/styles/positron";
let labelLayerIds = [];

let currentStation = null; // { lat, lon, lines, name } — name reste null tant que non révélé
let dailyDate = null;
let dailyNeighbours = [];
let stationsNames = null;
const guesses = [];
let map = null;
let endGame = false;
let points = 500;

const maxSuggestions = 5;

/* --- Sauvegarde locale, une partie par jour --- */
const storeKey = (date) => `metro-du-jour:${date}`;
const optionIds = [
  "streetsNamesOption",
  "linesOption",
  "neighboursOption",
  "mapRotationOption",
];
const actionsByOptionId = {
  streetsNamesOption: changeStreetsNamesState,
  linesOption: changeLinesState,
  neighboursOption: changeNeighboursState,
  mapRotationOption: rotateMap,
};

function saveProgress() {
  const usedOptions = optionIds.filter(
    (id) => document.getElementById(id).disabled
  );
  localStorage.setItem(
    storeKey(dailyDate),
    JSON.stringify({ guesses, endGame, revealedName: currentStation.name, usedOptions, points: points })
  );
}

function loadProgress(date) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(date)));
  } catch {
    return null;
  }
}

async function loadStationNames() {
  const response = await fetch("/api/stations");
  stationsNames = await response.json();
}

async function loadDaily() {
  const response = await fetch("/api/daily");
  return response.json();
}

function zoomForRadius(lat, radiusMeters, sizePx) {
  const targetMpp = (2 * radiusMeters) / sizePx; // mètres/pixel voulus
  const worldMpp = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  return Math.log2(worldMpp / targetMpp);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Renvoie une promesse résolue quand le style est chargé.
function initMap() {
  const lat = currentStation.lat;
  const lon = currentStation.lon;

  const sizePx = document.getElementById("map").clientWidth || 300;
  const zoom = Math.min(maxZoom, zoomForRadius(lat, maxRadius, sizePx));
  dynamicMinZoom = zoom - 1.5;

  map = new maplibregl.Map({
    container: "map",
    style: mapStyle,
    center: [lon, lat], // MapLibre attend [lng, lat]
    zoom,
    minZoom: dynamicMinZoom,
    maxZoom,
    bearing: Math.random() * 360,
    attributionControl: false,
  });

  new maplibregl.Marker().setLngLat([lon, lat]).addTo(map);

  // Empêche de s'éloigner de plus de maxRadius de la station.
  let correcting = false;
  map.on("move", () => {
    if (correcting) return;
    const c = map.getCenter();
    const dist = distanceMeters(lat, lon, c.lat, c.lng);
    if (dist > maxRadius) {
      correcting = true;
      const ratio = maxRadius / dist;
      const newLat = lat + (c.lat - lat) * ratio;
      const newLng = lon + (c.lng - lon) * ratio;
      map.setCenter([newLng, newLat]);
      correcting = false;
    }
  });

  return new Promise((resolve) => {
    map.on("load", () => {
      labelLayerIds = map
        .getStyle()
        .layers.filter((l) => l.type === "symbol")
        .map((l) => l.id);
      labelLayerIds.forEach((id) =>
        map.setLayoutProperty(id, "visibility", "none")
      );
      resolve();
    });
  });
}

async function guess() {
  const input = document.getElementById("guess");
  const value = input.value.trim();
  if (!value || endGame) return;

  input.value = "";

  const alreadyGuessed = guesses.some(
    (g) => g.name.toLowerCase() === value.toLowerCase()
  );
  if (alreadyGuessed) return;

  const res = await fetch("/api/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: dailyDate, name: value, attempt: guesses.length }),
  }).then((r) => r.json());

  if (res.error) return; // station inconnue : on ignore simplement

  guesses.push({ name: value, correct: res.correct });

  if (res.name) {
    currentStation.name = res.name;
  }

  if (!res.correct) {
    updatePoints(10)
  }

  if (res.correct || guesses.length == maxGuesses) {
    endGame = true;
    document.getElementById("guessForm").style.display = "none";
  }

  renderAttempts();
  saveProgress();
}

function renderAttempts() {
  if (guesses.length == 0) {
    document.getElementById("attempts").style.display = "none";
    return;
  }
  document.getElementById("attempts").style.display = "flex";

  const container = document.getElementById("attempts");
  container.innerHTML = "";

  guesses.forEach((g) => {
    const div = document.createElement("div");
    div.textContent = g.name;
    div.style.padding = "4px";
    div.style.borderRadius = "4px";
    div.style.background = g.correct ? "#d4f7d4" : "#ffd6d6";
    container.appendChild(div);
  });
}

/* AUTOCOMPLETE (inchangé) */
function autocomplete(inp, arr) {
  let currentFocus;

  inp.addEventListener("input", function () {
    let a,
      b,
      i,
      val = this.value;

    closeAllLists();
    if (!val) return;

    currentFocus = -1;

    a = document.createElement("div");
    a.className = "autocomplete-items";
    this.parentNode.appendChild(a);

    let nSuggestions = 0;

    for (i = 0; i < arr.length && nSuggestions < maxSuggestions; i++) {
      if (arr[i].substr(0, val.length).toLowerCase() === val.toLowerCase()) {
        nSuggestions += 1;
        b = document.createElement("div");
        b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
        b.innerHTML += arr[i].substr(val.length);
        b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";

        b.addEventListener("click", function () {
          inp.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });

        a.appendChild(b);
      }
    }
  });

  function closeAllLists() {
    document
      .querySelectorAll(".autocomplete-items")
      .forEach((el) => el.remove());
  }

  document.addEventListener("click", closeAllLists);
}

function changeStreetsNamesState(malus) {
  labelLayerIds.forEach((id) =>
    map.setLayoutProperty(id, "visibility", "visible")
  );
  updatePoints(malus);
}

function rotateMap(malus) {
  map.setBearing(0);
  updatePoints(malus);
}

let linesMarker = null;
let neighboursMarkers = [];

// Crée un marqueur non interactif à partir d'un élément DOM.
function makeMarker(lat, lon, el) {
  el.style.pointerEvents = "none";
  return new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([lon, lat])
    .addTo(map);
}

function changeNeighboursState(malus) {
  neighboursMarkers.forEach((m) => m.remove());
  neighboursMarkers = [];

  dailyNeighbours.forEach((n) => {
    if (!n.lines || !n.lines.length) return;
    if (n.lon == currentStation.lon && n.lat == currentStation.lat) return;

    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.whiteSpace = "nowrap";
    el.appendChild(badgesEl(n.lines));

    const label = document.createElement("span");
    label.textContent = n.name;
    label.style.marginLeft = "4px";
    label.className = "station-label";
    el.appendChild(label);

    neighboursMarkers.push(makeMarker(n.lat, n.lon, el));
  });

  updatePoints(malus);
}

function changeLinesState(malus) {
  if (linesMarker) {
    linesMarker.remove();
    linesMarker = null;
  }

  if (!currentStation.lines || !currentStation.lines.length) return;

  const el = document.createElement("div");
  el.appendChild(badgesEl(currentStation.lines));
  linesMarker = makeMarker(currentStation.lat, currentStation.lon, el);

  updatePoints(malus);
}

function badgeEl(line) {
  const b = document.createElement("span");
  b.className = "badge";
  b.textContent = line.short;
  b.style.background = line.color;
  b.style.color = line.text;
  b.title = line.long;
  return b;
}

function badgesEl(lines) {
  const wrap = document.createElement("span");
  wrap.className = "badges";
  lines.forEach((l) => wrap.appendChild(badgeEl(l)));
  return wrap;
}

function useOnce(button, action, malus) {
  button.addEventListener("click", () => {
    action(malus);
    button.disabled = true;
    saveProgress();
  });
}

function updatePoints(malus) {
  points -= malus;
  document.getElementById("pointsText").textContent = `Points : ${points}`;
}

/* INIT GLOBAL */
async function init() {
  await loadStationNames();

  const daily = await loadDaily();
  dailyDate = daily.date;
  dailyNeighbours = daily.neighbours || [];
  currentStation = { lat: daily.lat, lon: daily.lon, lines: daily.lines, name: null };
  maxRadius = daily.radiusMeters;
  maxGuesses = daily.maxGuesses;

  await initMap();

  const saved = loadProgress(dailyDate);
  if (saved) {
    guesses.push(...(saved.guesses || []));
    endGame = !!saved.endGame;
    if (saved.revealedName) {
      currentStation.name = saved.revealedName;
      // TODO : écran de fin
    }
    points = saved.points;
    if (endGame) document.getElementById("guessForm").style.display = "none";

    (saved.usedOptions || []).forEach((id) => {
      const btn = document.getElementById(id);
      btn.disabled = true;
      actionsByOptionId[id](0);
    });
  }
  updatePoints(0);

  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    guess();
  });

  renderAttempts();

  useOnce(document.getElementById("streetsNamesOption"), changeStreetsNamesState, 50);
  useOnce(document.getElementById("mapRotationOption"), rotateMap, 50);
  useOnce(document.getElementById("linesOption"), changeLinesState, 100);
  useOnce(document.getElementById("neighboursOption"), changeNeighboursState, 100);
}

init();