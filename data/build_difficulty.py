import json
import numpy as np

with open("./data/stations_merged.json", encoding="utf-8") as f:
    stations = json.load(f)

freq_series = [s["trafic"] for s in stations]
quantiles = np.quantile(freq_series, [0.1, 0.35, 0.65, 0.90])

def find_difficulty(station):
    for i in range(4):
        if station["trafic"] < quantiles[i]:
            return 5 - i
    return 1

new_stations = []
for s in stations:
    s = dict(s)                        # copie pour ne pas modifier l'original
    s["difficulty"] = find_difficulty(s)
    # del s["trafic"]
    new_stations.append(s)

with open("./data/stations_ranked.json", "w", encoding="utf-8") as f:
    json.dump(new_stations, f, ensure_ascii=False, indent=2)