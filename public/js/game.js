const maxZoom = 19;
let dynamicMinZoom = null;
let maxRadius = 500;
let maxGuesses = 6;

const tilesStreets =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const tilesStreetsNamed =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
let tileLayer = null;
let currentStation = null; // { lat, lon, lines, name } — name reste null tant que non révélé
let dailyDate = null;
let dailyNeighbours = [];
let stationsNames = null;
const guesses = [];
let map = null;
let mapRotation = null;
let endGame = false;

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
    JSON.stringify({ guesses, endGame, revealedName: currentStation.name, usedOptions })
  );
}

function loadProgress(date) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(date)));
  } catch {
    return null;
  }
}

async function loadConfig(date) {
  const response = await fetch("/api/config");
  config = await response.config
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

function initMap() {
  console.log("maxRadius utilisé:", maxRadius);
  const lat = currentStation.lat;
  const lon = currentStation.lon;

  mapRotation = Math.random() * 360;

  const sizePx = document.getElementById("map").clientWidth || 300;
  console.log(sizePx)
  const zoom = Math.min(maxZoom, zoomForRadius(lat, maxRadius, sizePx));

  map = L.map("map", {
    zoomControl: false,
    rotate: true,
    touchRotate: true,
    inertia: false,
    zoomSnap: 0.1,
  }).setView([lat, lon], zoom);

  console.log("zoom calculé:", zoom, "minZoom appliqué:", Math.floor(zoom));
  console.log("map.getMinZoom():", map.getMinZoom());
  console.log("map.getZoom():", map.getZoom());

  dynamicMinZoom = Math.floor(zoom);
  tileLayer = L.tileLayer(tilesStreets, {
    maxZoom,
    minZoom: dynamicMinZoom,
  }).addTo(map);

  const circle = L.circle([lat, lon], {
    radius: maxRadius,
    stroke: false,
    fill: false,
  }).addTo(map);

  marker = L.marker([lat, lon]).addTo(map);

  // map.setMaxBounds(circle.getBounds());
  // map.options.maxBoundsViscosity = 1.0;

  const center = L.latLng(lat, lon);

  let isCorrectingPan = false;
  
  map.on("moveend drag", () => {
    if (isCorrectingPan) return;
  
    const c = map.getCenter();
    const dist = center.distanceTo(c);
    if (dist > maxRadius) {
      isCorrectingPan = true;
      const ratio = maxRadius / dist;
      const newLat = center.lat + (c.lat - center.lat) * ratio;
      const newLng = center.lng + (c.lng - center.lng) * ratio;
      map.panTo([newLat, newLng], { animate: false });
      isCorrectingPan = false;
    }
  });
  
  map.setBearing(mapRotation);
  console.log("zoom après setBearing:", map.getZoom());
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
    // document.getElementById("output").textContent = res.name;
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

    for (i = 0; (i < arr.length && nSuggestions < maxSuggestions); i++) {
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

function changeStreetsNamesState() {
  map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(tilesStreetsNamed, {
    maxZoom,
    minZoom: dynamicMinZoom,
  }).addTo(map);
}

function rotateMap() {
  map.setBearing(0);
}

let linesMarker = null;
let neighboursMarkers = [];

function changeNeighboursState() {
  if (neighboursMarkers.length) {
    neighboursMarkers.forEach((m) => map.removeLayer(m));
    neighboursMarkers = [];
  }

  dailyNeighbours.forEach((n) => {
    if (!n.lines || !n.lines.length) return;
    if (n.lon == currentStation.lon && n.lat == currentStation.lat) return;
    const html = document.createElement("div");
    html.appendChild(badgesEl(n.lines));

    const label = document.createElement("span");
    label.textContent = n.name;
    label.style.marginLeft = "4px";
    label.className = "station-label";
    html.appendChild(label);

    neighboursMarkers.push(
      L.marker([n.lat, n.lon], {
        icon: L.divIcon({ className: "", html: html.outerHTML, iconSize: null }),
        interactive: false,
      }).addTo(map)
    );
  });
}

function changeLinesState() {
  if (linesMarker) {
    map.removeLayer(linesMarker);
    linesMarker = null;
  }

  if (!currentStation.lines || !currentStation.lines.length) return;

  const html = document.createElement("div");
  html.appendChild(badgesEl(currentStation.lines));

  linesMarker = L.marker([currentStation.lat, currentStation.lon], {
    icon: L.divIcon({ className: "", html: html.outerHTML, iconSize: null }),
    interactive: false,
  }).addTo(map);
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

function useOnce(button, action) {
  button.addEventListener("click", () => {
    action();
    button.disabled = true;
    saveProgress();
  });
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

  initMap();

  const saved = loadProgress(dailyDate);
  if (saved) {
    guesses.push(...(saved.guesses || []));
    endGame = !!saved.endGame;
    if (saved.revealedName) {
      currentStation.name = saved.revealedName;
      // TODO : écran de fin
      // document.getElementById("output").textContent = saved.revealedName;
    }
    if (endGame) document.getElementById("guessForm").style.display = "none";

    (saved.usedOptions || []).forEach((id) => {
      const btn = document.getElementById(id);
      btn.disabled = true;
      actionsByOptionId[id]();
    });
  }

  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    guess();
  });

  renderAttempts();

  useOnce(document.getElementById("streetsNamesOption"), changeStreetsNamesState);
  useOnce(document.getElementById("mapRotationOption"), rotateMap);
  useOnce(document.getElementById("linesOption"), changeLinesState);
  useOnce(document.getElementById("neighboursOption"), changeNeighboursState);
}

init();