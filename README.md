# Dragon

Open-world drakspel i webbläsaren: kläck, föd upp och flyg din egen drake.
Byggt med React, TypeScript, Vite och three.js (React Three Fiber). Deployas på Vercel.

## Kör lokalt

```bash
npm install
npm run dev
```

## Grafik

- LOD-terräng i chunks med PBR-material från CC0-skanningar (mossa, skogsjord, lavsten, sand, snö)
- GPU-gräs med vind, riktiga procedurella träd (EZ-Tree) i tre LOD-nivåer med impostors
- Hav med djupfärg, reflektioner och skum, volymetriska moln, dag/natt med HDRI-ljus
- Riggad procedurell drake: skinnad kropp, fjäll-shader, vingmembran med genomlysning
- Korsvirkeshus, kullersten, stentorn
- Efterbehandling: N8AO, bloom, ACES, SMAA. Kvalitet låg/medel/hög + automatisk sänkning
- Dev: `/?lab` visar draken i en snabb testscen (`&mode=fly&view=back&flap=1&seed=42`)

Se `CREDITS.md` för alla tredjepartsresurser.

## Online (Supabase)

Spelet fungerar helt offline. För konton, molnsparning, topplista och Avelsbörsen:

1. Skapa ett Supabase-projekt.
2. Kör `supabase/migrations/001_dragon_online.sql` i SQL Editor.
3. Authentication → URL Configuration: lägg till din Vercel-URL som Site URL och Redirect URL.
   (Valfritt) Authentication → Providers → Google för Google-inloggning.
4. Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploya. Pausmenyn får då en Konto-sektion och nästet en Börsen-flik.

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
- [x] Fas 6 (bas) – Supabase: konton (mejllänk/Google), molnsparning, global topplista, Avelsbörsen mellan spelare
- [ ] Nästa: realtidsmultiplayer (flyga ihop), crews, servervaliderad ekonomi, riggade 3D-modeller
