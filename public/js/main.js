/* Câblage : logique de jeu et initialisation. Chargé en dernier. */
const actionsByOptionId = {
  streetsNamesOption: changeStreetsNamesState,
  linesOption: changeLinesState,
  neighboursOption: changeNeighboursState,
};

async function guess() {
  const input = document.getElementById("guess");
  const value = input.value.trim();
  if (!value || endGame) return;

  input.value = "";

  const alreadyGuessed = guesses.some(
    (g) => g.name.toLowerCase() === value.toLowerCase()
  );
  if (alreadyGuessed) return;

  const res = await apiGuess(dailyDate, value, points - costs.attempts);

  if (res.error) return; // station inconnue : on ignore simplement

  guesses.push({ name: value, correct: res.correct });

  if (res.name) {
    currentStation.name = res.name;
  }

  if (res.correct) {
    endGame = true;
    document.getElementById("guessForm").style.display = "none";
    showEndScreen();
  }

  if (!res.correct) {
    updatePoints(costs.attempts);
  }
  
  saveProgress();

  console.log("streak =", loadStreak());
  renderAttempts();
  renderStreak();
}

function useOnce(button, action, malus) {
  button.addEventListener("click", () => {
    action(malus);
    button.disabled = true;
    saveProgress();
  });
}

async function main() {
  
  // CHARGEMENT DES DONNEES
  const daily = await loadDaily();
  isArchive = daily.archive;
  dailyDate = daily.date;
  dailyNeighbours = daily.neighbours || [];
  currentStation = { lat: daily.lat, lon: daily.lon, lines: daily.lines, name: null };
  maxRadius = daily.radiusMeters;
  difficulty = daily.difficulty;
  costs = daily.points;
  
  const saved = loadProgress(dailyDate);
  await loadStationNames();
  await loadLines();
  
  // ÉLÉMENTS DE L'ÉCRAN
  await initMap();
  if (saved) {
    guesses.push(...(saved.guesses || []));
    endGame = !!saved.endGame;
    if (saved.revealedName) {
      currentStation.name = saved.revealedName;
    }
    points = saved.points;
    if (endGame) document.getElementById("guessForm").style.display = "none";

    (saved.usedOptions || []).forEach((id) => {
      const btn = document.getElementById(id);
      btn.disabled = true;
      actionsByOptionId[id](0);
    });
  }
  if (isArchive) {
    renderArchiveSubHeader(daily.date);
  }
  else {
    renderStreak();
  }
  if (endGame) {
    console.log("bababa")
    showEndScreen();
  }
  renderAttempts();
  updatePoints(0);
  setDifficultyText();
  showTutorial();

  document.getElementById("streetsPoints").textContent = `-${costs.streets}`;
  document.getElementById("linesPoints").textContent = `-${costs.lines}`;
  document.getElementById("neighboursPoints").textContent = `-${costs.neighbours}`;
  document.getElementById("guessButton").textContent = `OK (-${costs.attempts})`;

  // INDICES ET TENTATIVES
  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    guess();
  });

  useOnce(document.getElementById("streetsNamesOption"), changeStreetsNamesState, costs.streets);
  useOnce(document.getElementById("linesOption"), changeLinesState, costs.lines);
  useOnce(document.getElementById("neighboursOption"), changeNeighboursState, costs.neighbours);
}

main();
