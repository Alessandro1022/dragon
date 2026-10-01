# Dragon

Open-world drakspel i webbläsaren: kläck, föd upp och flyg din egen drake.
Byggt med React, TypeScript, Vite och three.js (React Three Fiber). Deployas på Vercel.

## Kör lokalt

```bash
npm install
npm run dev
```

## Kontroller

| Dator | Mobil | Handling |
| --- | --- | --- |
| W / S | Spak upp/ner | Stig / dyk |
| A / D | Spak vänster/höger | Sväng |
| Space | FLAXA | Vingslag, ger lyft |
| Shift | BOOST / SPRINT | Fart |
| F | ELD | Eldsprut (i luften) |
| E | Guldknappen | Kliv upp, landa, näste, prata |
| I / Tab | Drakikonen | Dina drakar |

Dyk för att få fart, stig för att tappa den. Boost, vingslag och eld kostar uthållighet.

## Struktur

```
src/
├─ game/
│  ├─ GameCanvas.tsx        3D-scen + post-processing
│  ├─ world/                terräng, skog, vatten, moln, himmel, ringbana
│  ├─ dragon/               flygfysik, drakmodell, följeslagare
│  ├─ player/               ryttare till fots
│  ├─ npc/                  Drakgardet, bybor
│  ├─ effects/              eld- och rökpartiklar
│  ├─ combat.ts, heat.ts    skademål och efterlysning
│  └─ input/                tangentbord + touch
├─ systems/                 genetik, drakvård, uppdrag (ren logik, kan köras på server)
├─ store/gameStore.ts       spelstatus + sparning (Zustand)
├─ ui/                      startskärm, HUD, touchkontroller
└─ types/
```

## Roadmap

- [x] Fas 1 – Flyga: öppen ö, flygfysik, chase-kamera, ringbana, mobilstöd
- [x] Fas 2 – Till fots, kliva upp/landa, ryttare i sadeln
- [x] Fas 3 – Ägg → drake: ruvning, kläckning, mata, träna, band, genetik, avel, vilda ägg
- [x] Fas 4 – Draksten: stad, bybor, Hedda + 5 uppdrag, marknad, guld, kungligt kläckeri, heat 1–5 och Drakgardet
- [x] Fas 5 (bas) – Eldsprut med partiklar, brinnande banditläger, vaktryttare som kan skjutas ner
- [x] Dag/natt-cykel, minikarta, sparning i webbläsaren
- [ ] Fas 6 – Online via Supabase: konton, molnsparning, avel mellan spelare, crews, handel
