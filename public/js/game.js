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

/* --- Sauvegarde locale, une partie par jour --- */
const storeKey = (date) => `metro-du-jour:${date}`;

function saveProgress() {
  localStorage.setItem(
    storeKey(dailyDate),
    JSON.stringify({ guesses, endGame, revealedName: currentStation.name })
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

const prefsKey = "metro-du-jour:prefs";

function savePrefs() {
  localStorage.setItem(prefsKey, JSON.stringify({
    streetNames: document.getElementById("streetsNamesOption").checked,
    lines: document.getElementById("linesOption").checked,
    neighbours: document.getElementById("neighboursOption").checked,
    rotation: document.getElementById("mapRotationOption").checked,
  }));
}

function loadPrefs() {
  const saved = JSON.parse(localStorage.getItem(prefsKey) || "null");
  if (!saved) return;
  document.getElementById("streetsNamesOption").checked = saved.streetNames;
  document.getElementById("linesOption").checked = saved.lines;
  document.getElementById("neighboursOption").checked = saved.neighbours;
  document.getElementById("mapRotationOption").checked = saved.rotation;
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

  map.on("moveend drag", () => {
    const c = map.getCenter();
    const dist = center.distanceTo(c);
    if (dist > maxRadius) {
      const ratio = maxRadius / dist;
      const newLat = center.lat + (c.lat - center.lat) * ratio;
      const newLng = center.lng + (c.lng - center.lng) * ratio;
      map.panTo([newLat, newLng], { animate: false });
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
    document.getElementById("output").textContent = res.name;
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

    for (i = 0; i < arr.length; i++) {
      if (arr[i].substr(0, val.length).toLowerCase() === val.toLowerCase()) {
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
  const checked = document.getElementById("streetsNamesOption").checked;

  map.removeLayer(tileLayer);

  tileLayer = L.tileLayer(checked ? tilesStreetsNamed : tilesStreets, {
    maxZoom,
    minZoom: dynamicMinZoom,
  }).addTo(map);
}

function rotateMap() {
  const checked = document.getElementById("mapRotationOption").checked;
  if (checked) {
    map.setBearing(0);
  } else {
    map.setBearing(mapRotation);
  }
}

let linesMarker = null;
let neighboursMarkers = [];

function changeNeighboursState() {
  const checked = document.getElementById("neighboursOption").checked;

  if (neighboursMarkers.length) {
    neighboursMarkers.forEach((m) => map.removeLayer(m));
    neighboursMarkers = [];
  }

  if (checked) {
    dailyNeighbours.forEach((n) => {
      if (!n.lines || !n.lines.length) return;
      const html = document.createElement("div");
      html.appendChild(badgesEl(n.lines));

      neighboursMarkers.push(
        L.marker([n.lat, n.lon], {
          icon: L.divIcon({ className: "", html: html.outerHTML, iconSize: null }),
          interactive: false,
        }).addTo(map)
      );
    });
  }
}

function changeLinesState() {
  const checked = document.getElementById("linesOption").checked;

  if (linesMarker) {
    map.removeLayer(linesMarker);
    linesMarker = null;
  }

  if (!checked || !currentStation.lines || !currentStation.lines.length) return;

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

/* INIT GLOBAL */
async function init() {
  await loadStationNames();

  const daily = await loadDaily();
  dailyDate = daily.date;
  dailyNeighbours = daily.neighbours || [];
  currentStation = { lat: daily.lat, lon: daily.lon, lines: daily.lines, name: null };
  maxRadius = daily.radiusMeters;
  maxGuesses = daily.maxGuesses;

  document.getElementById("streetsNamesOption").checked = daily.defaults.streetNames;
  document.getElementById("linesOption").checked = daily.defaults.lines;
  document.getElementById("neighboursOption").checked = daily.defaults.neighbours;
  document.getElementById("mapRotationOption").checked = daily.defaults.rotation;

  loadPrefs(); // écrase avec les préférences sauvegardées du joueur, si présentes

  initMap();
  changeLinesState();
  changeStreetsNamesState();
  changeNeighboursState();

  const saved = loadProgress(dailyDate);
  if (saved) {
    guesses.push(...(saved.guesses || []));
    endGame = !!saved.endGame;
    if (saved.revealedName) {
      currentStation.name = saved.revealedName;
      document.getElementById("output").textContent = saved.revealedName;
    }
    if (endGame) document.getElementById("guessForm").style.display = "none";
  }

  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    guess();
  });

  renderAttempts();

  document
    .getElementById("streetsNamesOption")
    .addEventListener("change", () => {
      changeStreetsNamesState();
      savePrefs();
    });

  document
    .getElementById("mapRotationOption")
    .addEventListener("change", () => {
      rotateMap();
      savePrefs();
    });

  document
    .getElementById("linesOption")
    .addEventListener("change", () => {
      changeLinesState();
      savePrefs();
    });

  document
    .getElementById("neighboursOption")
    .addEventListener("change", () => {
      changeNeighboursState();
      savePrefs();
    });
}

init();