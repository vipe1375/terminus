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

  map.setBearing(mapRotation);
}

function guess() {
  const input = document.getElementById("guess");
  const value = input.value.trim();

  input.value = "";

  guesses.push({
    name: value,
    correct: value.toLowerCase() === currentStation.name.toLowerCase(),
  });

  renderAttempts();
}

function renderAttempts() {
  const container = document.getElementById("attempts");

  container.innerHTML = "";

  const div = document.createElement("div");
  div.textContent = "Tentatives";
  div.style.padding = "4px";
  div.style.borderRadius = "4px";
  div.style.background = g.correct ? "#d4f7d4" : "#ffd6d6";

  container.appendChild(div);

  guesses.forEach((g) => {
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

/* INIT GLOBAL PROPRE */
async function init() {
  await loadStations();
  initMap();

  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault(); // Empêche le rechargement de la page
    guess(); // Même action que le bouton OK
  });

  document
    .getElementById("streetsNamesOption")
    .addEventListener("change", changeStreetsNamesState);

  document
    .getElementById("mapRotationOption")
    .addEventListener("change", rotateMap);
}

init();
