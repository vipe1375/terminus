/* Appels au serveur. */
async function loadStationNames() {
  const response = await fetch("/api/stations");
  stationsNames = await response.json();
}

async function loadDaily() {
  const date = new URLSearchParams(location.search).get("date");
  const url = date ? `/api/daily?date=${date}` : "/api/daily";
  const response = await fetch(url);
  return response.json();
}