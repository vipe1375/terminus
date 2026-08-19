/* Sauvegarde locale, une partie par jour. */
function saveProgress() {
  const usedOptions = optionIds.filter(
    (id) => document.getElementById(id).disabled
  );
  localStorage.setItem(
    storeKey(dailyDate),
    JSON.stringify({ guesses, endGame, revealedName: currentStation.name, usedOptions, points: points, solvedAsDaily: endGame && !isArchive })
  );
}

function loadProgress(date) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(date)));
  } catch {
    return null;
  }
}

function toISODate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function loadStreak() {
  let count = 0;
  const [y, m, day] = dailyDate.split("-").map(Number);
  const d = new Date(y, m - 1, day); // même date que celle utilisée pour sauvegarder
  let first = true;
  while (true) {
    const saved = loadProgress(toISODate(d));
    if (saved && saved.solvedAsDaily) {
      count += 1;
    } else if (!first) {
      break;
    }
    first = false;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

async function loadLines() {
  linesData = await fetch("/data/lines_clean.json").then((r) => r.json());
}

