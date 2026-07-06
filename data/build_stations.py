import json
import unicodedata

def normalize(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return s.lower().strip()

with open("stations.json", encoding="utf-8") as f:
    stations = json.load(f)

with open("frequentation.json", encoding="utf-8") as f:
    freq_list = json.load(f)

freq_by_name = {normalize(f["station"]): f["trafic"] for f in freq_list}

moyenne = sum(freq_by_name.values()) / len(freq_by_name)

non_trouvees = []

for s in stations:
    trafic = freq_by_name.get(normalize(s["name"]))
    if trafic is None:
        non_trouvees.append(s["name"])
        trafic = round(moyenne)
    s["trafic"] = trafic

with open("stations_merged.json", "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)

print(f"{len(stations)} stations traitées, moyenne utilisée : {round(moyenne)}")
print(f"{len(non_trouvees)} stations sans correspondance :")
for name in non_trouvees:
    print(" -", name)