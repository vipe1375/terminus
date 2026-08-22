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
  dynamicMinZoom = zoom-1;

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
  
  // map.on("move", () => {
  //   if (correcting) return;
  //   const c = map.getCenter();
  //   const dist = distanceMeters(lat, lon, c.lat, c.lng);
  
  //   // rayon visible approximatif (demi-diagonale de la vue, en mètres)
  //   const bounds = map.getBounds();
  //   const viewReach = distanceMeters(
  //     c.lat, c.lng,
  //     bounds.getNorth(), bounds.getEast()
  //   );
  
  //   // le centre ne peut pas s'approcher du bord à moins de viewReach
  //   const allowed = Math.max(0, maxRadius - viewReach);
  //   if (dist > allowed) {
  //     correcting = true;
  //     const ratio = allowed / dist;
  //     map.setCenter([
  //       lon + (c.lng - lon) * ratio,
  //       lat + (c.lat - lat) * ratio,
  //     ]);
  //     correcting = false;
  //   }
  // });

  document.getElementById("mapCornerBtn").addEventListener("click", function () {
    map.rotateTo(0);
  })

  return new Promise((resolve) => {
    map.on("load", () => {

      // MASQUAGE DES LABELS
      const stationLayers = ["poi", "transit"]; // motifs à ne jamais réafficher (à ajuster)
      
      labelLayerIds = map.getStyle().layers
        .filter((l) => l.type === "symbol")
        .map((l) => l.id)
        .filter((id) => !stationLayers.some((s) => id.includes(s)));
      
      map.getStyle().layers
        .filter((l) => l.type === "symbol")
        .forEach((l) => map.setLayoutProperty(l.id, "visibility", "none"));
      resolve();

      // FRONTIÈRES DE LA CARTE
      const radius = maxRadius / 1000; // kilometer
      const options = {
          steps: 64,
          units: 'kilometers'
      };
      const circle = turf.circle([lon, lat], radius, options);

      const bbox = turf.bbox(circle); // [ouest, sud, est, nord]
      map.setMaxBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
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

  const shapes = Object.values(linesData)
    .map((s) => ({ ...s, shape: clip(s.shape, [currentStation.lon, currentStation.lat], 1) }))
    .filter((s) => s.shape.geometry.coordinates.length);  // écarte celles hors zone
  showLines(shapes);

  updatePoints(malus);
}

function changeLinesState(malus, showNeighbours=false) {
  if (linesMarker) {
    linesMarker.remove();
    linesMarker = null;
  }

  if (!currentStation.lines || !currentStation.lines.length) return;

  const el = document.createElement("div");
  el.appendChild(badgesEl(currentStation.lines));
  linesMarker = makeMarker(currentStation.lat, currentStation.lon, el);

  // affichage des tracés
  const shapes = currentStation.lines
    .map((l) => linesData[l.short])
    .filter(Boolean)
    .map((s) => ({ ...s, shape: clip(s.shape, [currentStation.lon, currentStation.lat], 0.2) }));
  showLines(shapes);

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

function showLines(shapes) {
  // shapes : liste de { color, shape } (entrées de linesData)
  const features = shapes.map((s) => ({
    ...s.shape,
    properties: { color: "#" + s.color },
  }));
  const data = { type: "FeatureCollection", features };

  if (map.getSource("lines")) {
    map.getSource("lines").setData(data);
  } else {
    map.addSource("lines", { type: "geojson", data });
    map.addLayer({
      id: "lines",
      type: "line",
      source: "lines",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 4 },
    });
  }
}

function clip(shape, center, km) {   // center = [lon, lat]
  const pt = turf.point(center);
  const segs = [];

  shape.geometry.coordinates.forEach((coords) => {
    if (coords.length < 2) return;
    const line = turf.lineString(coords);
    const total = turf.length(line, { units: "kilometers" });

    // position (en km depuis le début) du point le plus proche de la station
    const snapped = turf.nearestPointOnLine(line, pt, { units: "kilometers" });
    const at = snapped.properties.location;

    // fenêtre [at-km, at+km] bornée aux extrémités de la ligne
    const start = Math.max(0, at - km);
    const end = Math.min(total, at + km);
    if (end - start <= 0) return;

    const slice = turf.lineSliceAlong(line, start, end, { units: "kilometers" });
    segs.push(slice.geometry.coordinates);
  });

  return { ...shape, geometry: { type: "MultiLineString", coordinates: segs } };
}
