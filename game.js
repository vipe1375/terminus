const maxZoom = 19;
const minZoom = 15;
const maxRadius = 500;

const tilesStreets =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const tilesStreetsNamed =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
let tileLayer = null;
let currentStation = null;
let stationsData = null;
let stationsNames = null;
const guesses = [];
let map = null;
let mapRotation = null;
let endGame = false;

async function loadStations() {
  const response = await fetch("stations.json");
  stationsData = await response.json();
  stationsNames = stationsData.map((s) => s.name);
}

function initMap() {
  const station = stationsData[Math.floor(Math.random() * stationsData.length)];
  currentStation = station;

  document.getElementById("output").textContent = station.name;

  mapRotation = Math.random() * 360;
  const lat = station.lat;
  const lon = station.lon;

  map = L.map("map", {
    zoomControl: false,
    rotate: true,
    touchRotate: true,
    inertia: false,
  }).setView([lat, lon], 13);

  tileLayer = L.tileLayer(tilesStreets, {
    maxZoom,
    minZoom,
  }).addTo(map);

  const circle = L.circle([lat, lon], {
    radius: maxRadius,
    stroke: false,
    fill: false,
  }).addTo(map);

  var marker = L.marker([lat, lon]).addTo(map);

  map.setMaxBounds(circle.getBounds());
  map.options.maxBoundsViscosity = 1.0;

  const center = L.latLng(lat, lon);
  
  map.on("moveend drag", () => {
    const c = map.getCenter();
    const dist = center.distanceTo(c);
    if (dist > maxRadius) {
      const bearing = center.bearingTo ? null : null; // pas utilisé
      // Ramène le centre sur le bord du cercle, dans la même direction
      const ratio = maxRadius / dist;
      const newLat = center.lat + (c.lat - center.lat) * ratio;
      const newLng = center.lng + (c.lng - center.lng) * ratio;
      map.panTo([newLat, newLng], { animate: false });
    }
  });

  map.setBearing(mapRotation);
}

function guess() {
  const input = document.getElementById("guess");
  const value = input.value.trim();

  input.value = "";

  const alreadyGuessed = guesses.some(g => g.name.toLowerCase() === value.toLowerCase());
  if (alreadyGuessed) {
    return;
  }

  ((correct = value.toLowerCase() === currentStation.name.toLowerCase()),
    guesses.push({
      name: value,
      correct: correct,
    }));

  if (guesses.length == 6 || correct) {
    endGame = true;
    document.getElementById("guessForm").style.display = "none";
  }

  renderAttempts();
}

function renderAttempts() {
  if (guesses.length == 0) {
    document.getElementById("attempts").style.display = "none";
    return;
  }
  document.getElementById("attempts").style.display = "flex";
  
  const container = document.getElementById("attempts");
  
  container.innerHTML = "";

  guesses.forEach( g => {
    const div = document.createElement("div");

    div.textContent = g.name;

    div.style.padding = "4px";
    div.style.borderRadius = "4px";
    div.style.background = g.correct ? "#d4f7d4" : "#ffd6d6";

    container.appendChild(div);
  });
}

/* AUTOCOMPLETE (inchangé sauf appel contrôlé) */
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
    minZoom,
  }).addTo(map);
}

function rotateMap() {
  const checked = document.getElementById("mapRotationOption").checked;
  console.log(mapRotation);
  console.log("bearing function:", map.setBearing);
  if (checked) {
    map.setBearing(0);
  } else {
    map.setBearing(mapRotation);
  }
}

let linesMarker = null;
let neighboursMarkers = []

function changeNeighboursState() {
  const checked = document.getElementById("neighboursOption").checked;

  if (neighboursMarkers.length) {
    neighboursMarkers.forEach((m) => {
      map.removeLayer(m);
    });
    neighboursMarkers = [];
  }

  if (checked) {
    stationsData.forEach((s) => {
      if (!s.lines || !s.lines.length) return;
      const html = document.createElement("div");
      html.appendChild(badgesEl(s.lines));
    
      neighboursMarkers.push(L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: "", html: html.outerHTML, iconSize: null }),
        interactive: false,
      }).addTo(map))
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

/* INIT GLOBAL PROPRE */
async function init() {
  await loadStations();
  initMap();

  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault(); // Empêche le rechargement de la page
    guess(); // Même action que le bouton OK
  });

  renderAttempts();

  document
    .getElementById("streetsNamesOption")
    .addEventListener("change", changeStreetsNamesState);

  document
    .getElementById("mapRotationOption")
    .addEventListener("change", rotateMap);

  document
    .getElementById("linesOption")
    .addEventListener("change", changeLinesState);

  document
    .getElementById("neighboursOption")
    .addEventListener("change", changeNeighboursState);
}

init();
