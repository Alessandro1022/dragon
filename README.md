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
| Shift | BOOST | Fart + eld |

Dyk för att få fart, stig för att tappa den. Boost och vingslag kostar uthållighet.

## Struktur

```
src/
├─ game/
│  ├─ GameCanvas.tsx        3D-scen + post-processing
│  ├─ world/                terräng, skog, vatten, moln, himmel, ringbana
│  ├─ dragon/               flygfysik, kamera, procedurell drakmodell
│  └─ input/                tangentbord + touch
├─ store/gameStore.ts       spelstatus (Zustand)
├─ ui/                      startskärm, HUD, touchkontroller
└─ types/
```

## Roadmap

- [x] Fas 1 – Flyga: öppen ö, flygfysik, chase-kamera, ringbana, mobilstöd
- [ ] Fas 2 – Till fots + kliva upp/av draken
- [ ] Fas 3 – Ägg → drake: kläckning, mata, träna, band, genetik
- [ ] Fas 4 – Stad, NPC:er, heat-system, uppdrag
- [ ] Fas 5 – Strid: eldattacker, hälsa, fiendedrakar
- [ ] Fas 6 – Online via Supabase: konton, avel mellan spelare, crews
