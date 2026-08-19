/* Variables et constantes partagées entre tous les fichiers. */
const maxZoom = 19;
let dynamicMinZoom = null;
let maxRadius = 500;
let costs = null;

// Style vectoriel libre (OpenFreeMap). Les libellés sont masqués au départ
// et réaffichés via l'option "noms des rues".
const mapStyle = "https://tiles.openfreemap.org/styles/bright";
let labelLayerIds = [];

let currentStation = null; // { lat, lon, lines, name } — name reste null tant que non révélé
let dailyDate = null;
let isArchive = null;   // variable globale à déclarer avec les autres
let dailyNeighbours = [];
let stationsNames = null;
let difficulty = null;
const guesses = [];
let map = null;
let endGame = false;
let points = 100;
let answer = null;
let linesData = null;

const maxSuggestions = 5;

const storeKey = (date) => `metro-du-jour:${date}`;
const optionIds = [
  "streetsNamesOption",
  "linesOption",
  "neighboursOption",
];

let linesMarker = null;
let neighboursMarkers = [];
