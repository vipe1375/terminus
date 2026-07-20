/* Sauvegarde locale, une partie par jour. */
function saveProgress() {
  const usedOptions = optionIds.filter(
    (id) => document.getElementById(id).disabled
  );
  localStorage.setItem(
    storeKey(dailyDate),
    JSON.stringify({ guesses, endGame, revealedName: currentStation.name, usedOptions, points: points })
  );
}

function loadProgress(date) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(date)));
  } catch {
    return null;
  }
}
