/* Carte MapLibre, marqueurs et indices visuels. */
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

  document.getElementById("mapCornerBtn").addEventListener("click", function () {
    map.rotateTo(0);
  })

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

function makeMarker(lat, lon, el) {
  el.style.pointerEvents = "none";
  return new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([lon, lat])
    .addTo(map);
}

function changeStreetsNamesState(malus) {
  labelLayerIds.forEach((id) =>
    map.setLayoutProperty(id, "visibility", "visible")
  );
  updatePoints(malus);
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
