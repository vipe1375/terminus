/* Appels au serveur. */
async function loadStationNames() {
  const response = await fetch("/api/stations");
  stationsNames = await response.json();
}

async function loadDaily() {
  const response = await fetch("/api/daily");
  return response.json();
}
