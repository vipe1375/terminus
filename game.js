const maxZoom = 19;
const minZoom = 15;
const maxRadius = 500;

const tilesStreets =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";

let currentStation = null;
let stationsData = null;
let stationsNames = null;
let map = null;

async function loadStations() {
    const response = await fetch("stations.json");
    stationsData = await response.json();
    stationsNames = stationsData.map(s => s.name);
}

function initMap() {
    const station = stationsData[Math.floor(Math.random() * stationsData.length)];
    currentStation = station;

    document.getElementById("output").textContent = station.name;

    const lat = station.lat;
    const lon = station.lon;

    map = L.map("map", { zoomControl: false }).setView([lat, lon], 13);

    const circle = L.circle([lat, lon], {
        radius: maxRadius,
        stroke: false,
        fill: false
    }).addTo(map);

    map.setMaxBounds(circle.getBounds());
    map.options.maxBoundsViscosity = 1.0;

    L.tileLayer(tilesStreets, {
        maxZoom,
        minZoom
    }).addTo(map);
}

function guess() {
    const input = document.getElementById("guess");
    const value = input.value.trim();

    input.value = "";

    if (value.toLowerCase() === currentStation.name.toLowerCase()) {
        console.log("Correct!");
    } else {
        console.log("Incorrect!");
    }
}

/* AUTOCOMPLETE (inchangé sauf appel contrôlé) */
function autocomplete(inp, arr) {
    let currentFocus;

    inp.addEventListener("input", function () {
        let a, b, i, val = this.value;

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
        document.querySelectorAll(".autocomplete-items").forEach(el => el.remove());
    }

    document.addEventListener("click", closeAllLists);
}

/* INIT GLOBAL PROPRE */
async function init() {
    await loadStations();
    initMap();

    autocomplete(document.getElementById("guess"), stationsNames);

    document.querySelector("input[type='button']").addEventListener("click", guess);
}

init();