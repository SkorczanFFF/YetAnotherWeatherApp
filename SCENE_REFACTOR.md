# SCENE_REFACTOR — przepisanie sceny 3D od zera

> Branch `scene-rewrite` (od `volumetric-clouds`). Commity: tylko jednolinijkowe `feat: …`, bez pushowania.

## Test: @takram/three-clouds (branch `clouds-takram-test`, 2026-10-12)

Tylko do porównania z naszymi chmurami — **nie do merge'a w obecnej formie** (łamie zakazy z `CLAUDE.md`: `postprocessing`, `@takram/*`).

- Przełącznik w debugu (F7 → „Cloud renderer”: ours / takram (test)). Takram ładuje się leniwie (`weather-scene/takram/TakramSky.tsx`, osobny chunk ~446 KB / 120 KB gzip) plus ~9 MB danych z `public/takram/` (tekstury atmosfery `.exr`, STBN) przy pierwszym włączeniu.
- Wersje (exact): `@takram/three-clouds` 0.7.6, `@takram/three-atmosphere` 0.19.1, `@takram/three-geospatial` 0.9.1, `postprocessing` 6.39.5, `@react-three/postprocessing` 3.0.4 (3.1+ wymaga fiber ≥ 9.7).
- Nasz świat jest osadzony na elipsoidzie WGS84 w miejscu pogody (`worldToECEFMatrix`); słońce/księżyc: azymut ekranowy + prawdziwa wysokość (jak nasze chmury). Tekstury chmur proceduralne (LocalWeather/CloudShape/…), domyślne warstwy biblioteki łatane pogodą (gęstość, wypiętrzenie burzy, cirrus).
- Opady, pioruny i pył diamentowy rysują się osobnym przebiegiem po EffectComposerze (inaczej `AerialPerspective(sky)` zamalowuje cząstki bez głębi).
- Świadomie pominięte w teście: gwiazdy, błysk pioruna na niebie/chmurach, mapowanie widzialności/mgły.
- Znany problem: przy pokryciu ≥ ~0,8 kaskady cieni chmur (BSM) psują obraz — chmury znikają w trapezie przed kamerą. Cienie są więc włączone tylko poniżej 0,8.
- Wydajność wg autora biblioteki (README, Tokyo scene): iPhone 13 36–53 fps na `low`, M3 Max 92–95 fps na `high` w 4K z temporal upscalingiem. U nas niezmierzone na prawdziwym GPU.

## Chmury wolumetryczne (2026-10-11)

Deck + drei `<Clouds>` wyglądały płasko, więc zastąpił je własny raymarch w stylu Nubis (Horizon Zero Dawn):
- powłoka chmur nad zakrzywioną Ziemią (metry), typ stratus → cumulus → cumulonimbus, wysokość podstawy i grubość z `SceneParams`; cirrus jako warstwa 2D na 8,5 km w tym samym przebiegu;
- szum Perlin-Worley + Worley w teksturze 3D generowanej na GPU przy starcie;
- światło: marsz w stronę słońca/księżyca, Beer + powder, 3-płatkowa faza HG, aproksymacja wielokrotnego rozpraszania, perspektywa powietrzna, piorun świecący od środka chmury;
- koszt: render w 0,33–0,5 rozdzielczości, co klatkę liczony 1 piksel z bloku 2×2 + historia z reprojekcją (kamera statyczna → prawie darmowa akumulacja);
- tier `potato` (poniżej `low`) wraca do płaskiego `CloudDeck`; drei `<Clouds>` i `cloud.png` usunięte.

Weryfikacja na zrzutach z headless Chrome (SwiftShader, tier przypięty ręcznie — tam `PerformanceMonitor` schodzi do `potato`): cumulusy w południe, różowe/łososiowe o świcie i zmierzchu, overcast z falującą podstawą, burza, noc z łuną. Wydajności na prawdziwym GPU nie mierzyłem.

## Status (2026-10-10)

Wszystkie kroki 0–8 zrobione na `scene-rewrite` (commity `feat: …`, niepushowane). Odstępstwa od planu poniżej:

- Debug menu przebudowane razem z przełączeniem sceny (krok 3), bo stary `DebugOverrides` blokował build; krok 7 dołożył już tylko `VolumeHelpers`.
- Opady: zamiast „spawn nad górną krawędzią” emitter liczy **przepływ przez objętość kadru** (losowy punkt w kadrze → cofnięcie wzdłuż prędkości do krawędzi wejścia → `life` do krawędzi wyjścia). Bez tego przy wichurze płatki spędzały większość życia poza kadrem.
- Cumulusy dostają kolor bazowy przez `emissive` (sprite'y patrzą w kamerę i są podświetlone od tyłu przez słońce w kadrze, sam Lambert dawał szare plamy) i wygaszają się bliżej niż 110 j. od kamery.
- Pitch kamery 16° zamiast 10°, bo pas „ziemi” pod horyzontem zjadał 30 % ekranu.
- three.quarks i drei `<Sparkles>` gubią `toneMapped: false` → łatane w runtime; tekstury cząstek to `DataTexture` (biały RGB + alfa).
- Zmierzone (headless Chrome, SwiftShader, tier `low` na 390×844): 3–4 draw calle w czystym niebie, deszczu i burzy z gradem.
- Weryfikacja wizualna była robiona headless (rozszerzenie Claude in Chrome nie było połączone); warto obejrzeć na prawdziwym GPU, zwłaszcza płynność ruchu i kolory przy zmierzchu.

## Ustalenia z kroku 0 (nadpisują resztę planu)

- `suncalc@1.9.0` (+ `@types/suncalc@1.9.2`) — linia 2.x jest za świeża (wydana kilka dni temu).
- `three.quarks@0.17.1` + `quarks.core@0.17.1` (peer `three >= 0.182` ✔). Fakty z kodu biblioteki:
  - brak `maxParticle` — liczba cząstek = `emissionOverTime × startLife`;
  - `RectangleEmitter` emituje z **obwodu** prostokąta, `GridEmitter` tylko wzdłuż +Z → piszemy **własny `EmitterShape`** (`ViewVolumeEmitter`): spawn w trapezie frustum nad górną krawędzią kadru, przesunięty pod wiatr, prędkość = opad + wiatr, `life` per cząstka;
  - `RenderMode.StretchedBillBoard` (streaki deszczu), `Noise` (kołysanie śniegu) — potwierdzone;
  - emitter **musi** wisieć pod `Scene` (inaczej system sam się `dispose()`), `delta` obcinana do 0,1 s.
- **`r3f-perf` odpada** (zależy od `@react-three/drei@^9` → druga kopia drei, niezgodna z fiber 9 / React 19). Zamiast tego własny `PerfOverlay`: `gl.info.render` (draw calls, trójkąty, punkty) + fps w debug menu; drei `<Stats>` dla wykresu fps.
- drei `<Sky>` = three-stdlib Preetham (box z `gl_Position.z = w`), ma własny dysk słońca i tonemapping → `gl.toneMappingExposure` ~0.5, kamera `far` ≥ 3000 dla decku chmur.
- Mgła horyzontu wchodzi do `SkyGrade` zamiast osobnego quada; obiekty 3D mgli `FogExp2` → o jeden draw mniej.
- `cloud.png` pobrane z drei-assets do `public/effects/` (drei domyślnie ciągnie je z githack CDN).
- Znalezione poza zakresem (nie ruszamy): `weatherFormatter` parsuje `current.time`/`sunrise` (czas lokalny miasta bez offsetu) w strefie przeglądarki → `dt`/`sunrise` przesunięte, gdy strefa użytkownika ≠ strefa miasta. Nowa scena liczy czas z `Date.now()` + suncalc, więc jej to nie dotyczy.

## Kontekst

Scena w tle (`src/weather-scene/`) jest wynikiem kilku przepisań (git log: lens flare, god rays, volumetric clouds, quality presets → wycięte → obecny „clip-space” layer stack). Jest tania, ale **nie odzwierciedla pogody w 3D**. Najważniejsze problemy w obecnym kodzie:

| Problem | Gdzie |
|---|---|
| Chmury to clip-space quad (`gl_Position = vec4(position.xy, …)`). Brak perspektywy: wiatr „z północy” przesuwa teksturę w górę ekranu zamiast w głąb; paralaksa kamery ich nie dotyczy (a gwiazd/słońca tak) → rozjazd warstw. | `effects/CloudLayer.tsx`, `shaders/cloudLayer.glsl.ts` |
| Deszcz/śnieg: wiatr tylko w osi X (składowa Z ignorowana); pętla CPU po 1500 cząstkach + upload bufora co klatkę; bounds z hardkodowanym `CAM_Z = 5`. | `RainEffect.tsx`, `SnowEffect.tsx`, `internal/particleBounds.ts` |
| Override `timeOfDay` zmienia kolory, ale **nie pozycję słońca** (Celestial liczy z `dt`) → słońce w zenicie na nocnym niebie. | `Celestial.tsx` vs `weather/config.ts` |
| `dt` jest zamrożony w momencie fetchu; `useRealtimeClock: true` nic nie robi. 4 dyskretne fazy dnia → skoki kolorów. | `weather/config.ts` |
| Thunder: pierwszy błysk planowany w `performance.now()/1000`, porównywany z `state.clock.elapsedTime` (inne bazy czasu) → pierwszy błysk opóźniony o wiek strony. | `ThunderEffect.tsx:37` vs `:43` |
| Martwe pola configu: `particleCount` (override w debugu nic nie robi), `isDrizzle`, `fogHeightFalloff`, `lat/lon`, `useRealtimeClock`; `ambientLight`/`directionalLight` niczego nie oświetlają (brak lit materials). | `WeatherScene.tsx:78-86`, `weather/types.ts` |
| Jednostki: w trybie imperial `speed` to mph, `temp` to °F → frost overlay (`temp < 0`) i skala wiatru są błędne. Scena nie zna `units`. | `WeatherSceneContainer.tsx:57`, `weather/config.ts` |
| Side-effecty w renderze (`materialRef.current = material`, mutacja uniformów w `Disc`). | `SkyDome.tsx:45`, `Celestial.tsx:112` |
| drei `<Stars>`: pełna sfera (połowa poza kadrem), brak uniformu opacity → hack ze zmianą `count` (rebuild bufora). | `effects/Stars.tsx` |

**Cel:** nowa scena, w której wszystko (chmury, opady, gwiazdy) istnieje **wyłącznie w objętości widzianej przez statyczną kamerę**, przesuwa się zgodnie z prawdziwym kierunkiem/prędkością wiatru i korzysta z gotowych rozwiązań tam, gdzie to sensowne.

## Decyzje (uzgodnione)

- **Chmury:** hybryda — własny perspektywiczny *cloud deck* (1 draw, stratus/cirrus/overcast) + drei `<Clouds>` tylko dla cumulusów w pasie frustum, z twardym budżetem segmentów. Ban z CLAUDE.md zostaje zdjęty **z budżetem** (przyczyną 300 W było pełne zachmurzenie ze sprite'ów — overcast teraz robi deck).
- **Niebo:** drei `<Sky>` (Preetham) sterowany pozycją słońca + nakładka „grade” (noc / overcast / błysk).
- **Słońce/księżyc:** `suncalc` (realna wysokość, faza Księżyca); azymut i wysokość kompresowane do kadru.
- **Orientacja:** kamera patrzy na **południe** (lat ≥ 0) / **północ** (lat < 0) → słońce zawsze przechodzi przez kadr; wiatr mapowany na prawdziwe strony świata.
- **Kamera:** statyczna + delikatna paralaksa (mysz/żyroskop); free cam (C) zostaje w debugu.
- **Opady:** `three.quarks` (BatchedRenderer, integracja ręczna przez `useFrame`, bez `quarks.r3f`).
- **Debug menu:** przebudowa.
- **API:** dopisujemy `cloud_cover_low/mid/high`, `wind_gusts_10m` (addytywnie, UI bez zmian).
- Logika aplikacji i CSS: bez zmian poza minimum (przekazanie `units` do sceny, nowe pola w services, reuse istniejących klas CSS w debug menu).

## Architektura

### Konwencja świata (`core/worldFrame.ts`)
- `+Y` w górę, kamera w `(0, 1.6, 0)`, patrzy w `-Z` z pitchem ~+12° (horyzont blisko dołu kadru, większość kadru to niebo). FOV 50.
- `-Z` = `facing` (S lub N wg `lat`). Dla facing=S: `+X` = zachód, `-X` = wschód (wschód słońca po lewej, zachód po prawej).
- `compassToWorld(bearingDeg, facing): Vector3` — jedno miejsce mapowania kompasu na świat.
- Wiatr: `windDirection` to kierunek **z którego** wieje → `velocity = -compassToWorld(from) * speedMs`. Oczekiwane zachowanie (facing S): z W → chmury jadą w lewo; z N → odpływają w stronę horyzontu; z S → nadpływają nad kamerę.

### „Tylko tam, gdzie patrzy kamera” (`core/viewVolume.ts`, zastępuje `particleBounds.ts`)
- Funkcje liczące z kamery bazowej (pozycja + pitch + fov + aspect) **footprint frustum** na zadanej wysokości / w zadanym pasie wysokości, rozszerzony o margines paralaksy (`parallaxAmount * PARALLAX`) + promień obiektu.
- Każda warstwa dostaje swoją objętość: `cloudBand` (y 18–35, z −15…−120), `precipBox` (z −2…−30), `starPatch` (stożek kadru na sferze).
- **Toroidalny wrap po wietrze:** obiekt opuszczający objętość po stronie zawietrznej wraca po stronie nawietrznej. Krawędzie objętości są poza kadrem (margines) lub w strefie mgły/fade przy horyzoncie → wrap niewidoczny.
- Przelicza się na `resize` (aspect), nie co klatkę.

### Parametry sceny (`src/weather/sceneParams.ts`, zastępuje `SimulationConfig` / `config.ts`)
Ciągłe wartości w jednostkach SI, bez faz:
```ts
interface SceneParams {
  time: number | null;     // null = żywy zegar; liczba = przypięte przez debug
  lat: number; lon: number; timezone: string;
  clouds: { total: number; low: number; mid: number; high: number }; // 0..1
  wind: { speedMs: number; gustMs: number; fromDeg: number };
  precip: {
    rainMmH: number;       // ciekły opad (rain + showers z API)
    snowCmH: number;       // snowfall z API (cm/h)
    drizzle: boolean;      // 51–57
    freezing: boolean;     // 56, 57, 66, 67 (gołoledź)
    showers: boolean;      // 80–86, 95–99 (konwekcja: kłębiaste niebo, opad pulsuje)
    hail: boolean;         // 96, 99
    grains: boolean;       // 77 (krupa/ziarna śniegu)
  };
  thunder: boolean;
  fog: { visibilityM: number; rime: boolean }; // rime = 48 (szadź)
  temperatureC: number;
  humidity: number;        // 0..1
  parallaxAmount: number;
  quality: QualityTier | null;
}
```
Rodzaj opadu nie jest już enumem — deszcz ze śniegiem to po prostu `rainMmH > 0 && snowCmH > 0`. Do zapytania API dochodzą jeszcze `rain, showers, snowfall` (Open-Meteo zwraca je osobno w `current`).
- `mapToSceneParams(weather, units, overrides)`: normalizacja jednostek (mph→m/s, km/h→m/s, °F→°C, in→mm); `kind` z `weather/codes.ts` (reuse `getEffectTypeAndIntensity`, `isDrizzleCode`); `rateMmH` z API `precipitation`, a gdy 0 przy kodzie opadu → fallback z tabeli intensywności; brak `low/mid/high` → wyprowadzenie z `total`.
- `isNightAt(params)` (z suncalc) eksportowane dla `WeatherSceneContainer` (zmienne CSS `--app-text-color`) — zachowujemy obecne zachowanie, tylko źródło się zmienia. Frost overlay: `temperatureC < 0` (naprawia imperial).
- `SceneOverrides` — ta sama semantyka `"auto"`; `isOverridesDirty()` dalej źródłem prawdy dla badge'a `DEBUG` w Navbar.

### Katalog warunków pogodowych

Każdy kod WMO z Open-Meteo (oraz przypadki wynikające z temperatury, wiatru i widzialności) ma zdefiniowany wygląd. Każdy wiersz jest też **presetem w debug menu**, żeby dało się go sprawdzić jednym kliknięciem.

| Warunek | Źródło w danych | Wygląd w scenie |
|---|---|---|
| Bezchmurnie / prawie (0, 1) | `cloud_cover` niskie | sam `<Sky>`, pojedyncze cumulusy przy 1, cirrus z `cloud_cover_high` |
| Częściowe zachmurzenie (2) | `cloud_cover` 25–70 % | cumulusy drei (liczba ∝ pokrycie), deck rozbity (stratocumulus) |
| Pochmurno (3) | `cloud_cover_low` ≥ ~85 % | pełny deck, brak cumulusów, niebo przyciemnione (SkyGrade overcast), słońce przygaszone, światło rozproszone |
| Zamglenie / smog | `visibility` 1–10 km, kody 4–9 | lekka mgła `FogExp2` + haze przy horyzoncie (przy upale cieplejszy odcień) |
| Mgła (45) | `visibility` < 1 km | gęsty `FogExp2`, haze przy horyzoncie, chmury znikają w mgle |
| Mgła osadzająca szadź (48) | kod 48 | jak mgła + bielszy kolor mgły + frost overlay |
| Mżawka (51–55) | kod + `rain` | krótkie, cienkie, wolne krople, gęsta emisja, lekkie `Noise`; zawsze nisko wiszący deck |
| Marznąca mżawka / deszcz (56, 57, 66, 67) | kod | deszcz/mżawka z chłodnym, jaśniejszym odcieniem kropli + frost overlay |
| Deszcz słaby / umiarkowany / silny (61–65) | `rain` mm/h | gęstość, długość i prędkość streaków ∝ intensywność; pochylenie od wiatru |
| Przelotne opady (80–82, 85, 86) | kod / `showers` | więcej i wyższe cumulusy (wypiętrzone), deck nie zamyka się do końca, słońce może świecić, intensywność opadu pulsuje |
| Deszcz ze śniegiem | `rain` > 0 i `snowfall` > 0 | dwa systemy quarks naraz (deszcz o połowie gęstości + mokre, szybsze płatki) |
| Śnieg słaby / umiarkowany / silny (71–75) | `snowfall` cm/h | płatki (`snowflake*.png`), wolne opadanie, kołysanie `Noise`, dryf z wiatrem |
| Ziarna śniegu (77) | kod 77 | drobne, okrągłe, szybsze cząstki zamiast płatków |
| Zamieć / zawieja | śnieg + wiatr ≥ ~10 m/s | płatki niemal poziomo, mocniejsze `Noise`, spadek widzialności (z danych) |
| Burza (95) | kod | ciemny deck (cumulonimbus), silny deszcz, błyski (niebo + światło na chmurach) **i widoczne pioruny**: łamana linia z odgałęzieniami (drei `<Line>`) od decku do horyzontu, ~150 ms, losowo w kadrze |
| Burza z gradem (96, 99) | kod | jak burza + trzeci system quarks: białe, szybkie kulki gradu |
| Mróz | `temperatureC` < 0 | frost overlay z płynną siłą: 0 przy 0 °C → max przy −15 °C (dziś jest stałe 0.5) |
| Pył diamentowy | ≤ −10 °C, mało chmur, wilgotność ≥ 70 % | drei `<Sparkles>` w bliskiej objętości kadru (migoczące kryształki) |
| Upał | ≥ 30 °C | cieplejszy, gęstszy haze przy horyzoncie (bez distortion — postprocess zbanowany) |
| Silny wiatr / porywy | `wind_gusts_10m` | szybszy dryf chmur, mocniej pochylony opad, porywy modulują prędkość w czasie |
| Noc / świt / zmierzch | suncalc | wszystko powyżej w każdej porze dnia; gwiazdy i księżyc chowają się za chmurami |

Świadomie pominięte: tęcza (fizycznie wymaga słońca za obserwatorem, a my trzymamy słońce w kadrze), zorza, burze piaskowe (Open-Meteo nie zwraca tych kodów).

### Współdzielony stan per-klatka (`core/sceneSignals.ts`)
Context z mutowalnymi refami (bez React state): `sunDirDisplay`, `moonDirDisplay`, `dayFactor`, `nightFactor`, `windVelocity` (z porywami: szum między `speed` a `gust`), `windOffset` (akumulowany), `flash`. Liczone raz na klatkę w `<SceneDriver>` montowanym tuż po kamerze — zastępuje „thunder trzyma ref do materiału nieba”.

### Zegar i niebo
- `core/useSceneClock.ts`: realny czas (`Date.now()`, tick co 30 s) albo override godziny/daty z debugu (luxon + `timezone` lokalizacji — godzina lokalna miasta).
- `core/useCelestial.ts`: `SunCalc.getPosition / getMoonPosition / getMoonIllumination`. Realna wysokość → `dayFactor/nightFactor`, intensywność świateł. Kierunek **wyświetlany**: azymut × `k` (k dobrane tak, by azymut wschodu/zachodu danego dnia mieścił się w ~85% połowy HFOV), wysokość skalowana do górnej krawędzi kadru. Kierunek wyświetlany zasila `<Sky sunPosition>`, światło kierunkowe i księżyc — żeby poświata, dysk i cieniowanie chmur się zgadzały.

### Warstwy i kolejność renderu (cel: ≤ 8 draw calli w najgorszym przypadku)

| # | Komponent | Technika | Draw |
|---|---|---|---|
| — | `FrameRateGate` | bez zmian (60 fps; 30 fps na tierze `low`) | 0 |
| — | `CameraRig` / `FreeCameraWASD`+`OrbitControls` | rig: bazowa pozycja + pitch z `worldFrame`, paralaksa jak dziś | 0 |
| — | `SceneDriver` | aktualizacja `sceneSignals` | 0 |
| 1 | `SkyLayer` | drei `<Sky>`; `turbidity`/`rayleigh`/`mie` od `clouds.total` i wysokości słońca; odmontowany przy `nightFactor = 1` | 1 |
| 2 | `SkyGrade` | clip-space quad: nocny gradient (kolory z obecnego `phasePalette` night), szarość overcast, `flash` | 1 |
| 3 | `StarField` | własne `Points` generowane **tylko w stożku kadru** (+margines), `uOpacity = nightFactor × (1 − clouds.total)`; brak rebuildu bufora | 1 |
| 4 | `Moon` | billboard z `public/effects/moon.jpg` + terminator fazy z `getMoonIllumination` | 1 |
| 5 | `CloudDeck` | pozioma płaszczyzna w świecie o kształcie footprintu frustum na wysokości deck; frag: reuse `internal/noiseTexture.ts`, warstwa low (stratus/overcast, `smoothstep(0.55,1, low)`) + high (cirrus, UV rozciągnięte wzdłuż wiatru) w jednym shaderze; UV = world xz + `windOffset`; fade do koloru horyzontu z odległością | 1 |
| 6 | `Cumulus` | drei `<Clouds material={MeshLambertMaterial} limit={budżet}>` + N × `<Cloud>` w `cloudBand`; pozycje grup przesuwane wiatrem w `useFrame` + wrap; liczba/rozmiar od `max(low, mid)` w reżimie częściowym, wygaszane gdy deck jest overcast; tekstura **self-hosted** (`public/effects/cloud.png`, drei domyślnie ciągnie z githack CDN) | 1 |
| 7 | `Precipitation` | three.quarks `BatchedRenderer`; deszcz: `RectangleEmitter` nad `precipBox` skierowany w dół, `RenderMode.StretchedBillBoard`, `ApplyForce` = wektor wiatru (3D), `emissionOverTime` od `rateMmH`, drizzle = mniejsze/wolniejsze; śnieg: `BillBoard` z `snowflake1-3.png` (atlas), turbulencja do kołysania; `startLife` = wysokość/prędkość → cząstki nie żyją poza boxem | 1 |
| 8 | `FogLayer` | `<fogExp2>` (kolor = horyzont, gęstość z `visibilityM`) — działa na Lambert chmury i quarks; + horyzontalny fog quad (reuse shadera z `FogEffect.tsx`) gdy `visibilityM < 2000` | 0–1 |
| — | `Lighting` | `directionalLight` z kierunku wyświetlanego słońca/księżyca, `hemisphereLight` (niebo/ziemia); `flash` podbija intensywność → błyskawica rozświetla chmury | 0 |
| — | `Thunder` | scheduler (4–12 s, double-bump) na **jednej bazie czasu** (`state.clock`), pisze do `sceneSignals.flash` | 0 |
| 9 | `LightningBolt` | drei `<Line>`: proceduralna łamana z odgałęzieniami w objętości kadru, montowana tylko na czas wyładowania | 0–1 |
| 10 | `DiamondDust` | drei `<Sparkles>` w bliskiej objętości kadru, tylko przy mrozie ≤ −10 °C | 0–1 |

Grad i deszcz ze śniegiem to osobne systemy quarks (osobne materiały → osobne batche). Najgorszy realny przypadek (burza z gradem przy overcast: gwiazdy, księżyc i cumulusy wygaszone) to ~7 draw calli.

Budżety w `core/quality.ts` (tiery `low/medium/high`, startowy z `useIsMobile`, potem drei **`<PerformanceMonitor>`** schodzi tier niżej przy spadkach fps; DPR per tier):

| | high | medium | low |
|---|---|---|---|
| DPR max | 1.5 | 1.25 | 1 |
| Cumulus `limit` (segmenty) | 80 | 48 | 24 |
| Deszcz `maxParticle` | 1500 | 900 | 400 |
| Śnieg `maxParticle` | 1000 | 600 | 300 |
| Gwiazdy | 1500 | 1000 | 500 |
| fps cap | 60 | 60 | 30 |

## Struktura plików

```
src/weather/sceneParams.ts           NOWY (zastępuje config.ts; codes.ts zostaje)
src/weather/types.ts                 + SceneParams, − SimulationConfig/TimeOfDay(jeśli nieużywane)
src/weather-scene/
  WeatherScene.tsx                   Canvas + SceneRoot (przepisany)
  core/  worldFrame.ts viewVolume.ts sceneSignals.tsx useSceneClock.ts
         useCelestial.ts quality.ts SceneDriver.tsx
         CameraRig.tsx FreeCameraWASD.tsx FrameRateGate.tsx useDeviceOrientation.ts useIsMobile.ts  (przeniesione, Rig dostosowany)
  layers/ SkyLayer.tsx SkyGrade.tsx StarField.tsx Moon.tsx Lighting.tsx
          CloudDeck.tsx Cumulus.tsx Precipitation.tsx FogLayer.tsx Thunder.tsx
  shaders/ skyGrade cloudDeck moon starField fog (.glsl.ts)
  internal/noiseTexture.ts           ZOSTAJE (reuse)
  debug/ VolumeHelpers.tsx PerfOverlay.tsx (lazy r3f-perf)
```
Usuwane: `SkyDome`, `Celestial`, `Stars`, `CloudLayer`, `RainEffect`, `SnowEffect`, `FogEffect`, `ThunderEffect`, `particleBounds`, `DebugBox`, `phasePalette` (kolory nocy/overcast przeniesione do `SkyGrade`), shadery rain/snow/skyDome/celestial/cloudLayer, `weather-scene/types.ts` (FrustumBounds).

## Debug menu (przebudowa, `components/debug-menu/DebugMenu.tsx`)
Reuse istniejących klas z `DebugMenu.scss` (`debug-menu-group`, `-row`, `-button-group`, `-option-btn`, `-current`), bez nowego CSS poza ewentualnym suwakiem.
- **Presety pogody:** jeden przycisk na każdy wiersz z „Katalogu warunków pogodowych” (ustawia komplet overrides), plus „Auto”.
- **Czas:** suwak godziny lokalnej 0–24 + pole daty (zmiana fazy Księżyca / długości dnia); readout: wysokość słońca, faza Księżyca.
- **Chmury:** low / mid / high (0–1) + total.
- **Wiatr:** prędkość (m/s) + porywy, kierunek jako przyciski kompasu (N, NE…) + pole stopni; readout „wieje z X → chmury płyną w Y”.
- **Opady:** deszcz mm/h, śnieg cm/h, flagi drizzle / freezing / showers / hail / grains; thunder (auto/on/off) + przycisk **Force lightning**.
- **Atmosfera:** dodatkowo wilgotność (pył diamentowy, haze) i flaga rime.
- **Atmosfera:** visibility (m), temperatura (°C), parallax.
- **Narzędzia:** quality tier (auto/low/medium/high), toggle `VolumeHelpers` (wireframe objętości spawnu — z free camem widać, że poza kadrem nic nie ma), toggle `PerfOverlay` (r3f-perf: draw calls, tris, GPU ms; lazy import, tylko gdy debug otwarty). Zastępuje 3× drei `<Stats>` i DebugBox + strzałki.
- F7 / C jak dziś (`App.tsx`). Nowe klucze overrides dopisane do `OVERRIDE_KEYS`.

## Kroki implementacji (każdy kończy się działającym buildem)

0. **Branch + zależności:** ✔ — patrz „Ustalenia z kroku 0”.
1. **Dane:** `weatherApi.ts` / `weatherService.ts` / `weatherFormatter.ts` — dopisać `cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m` jako opcjonalne pola `WeatherData`. `sceneParams.ts` + `SceneOverrides`. `App.tsx`: przekazać `units` do `WeatherSceneContainer`, `currentConfig` → `mapToSceneParams(weather, units, null)`.
2. **Core:** worldFrame, viewVolume, sceneSignals, useSceneClock, useCelestial, quality, SceneDriver; CameraRig z pitchem.
3. **Niebo:** SkyLayer, SkyGrade, StarField, Moon, Lighting. Weryfikacja sweepem godziny.
4. **Chmury:** CloudDeck, potem Cumulus z wrapem. Weryfikacja kierunków wiatru.
5. **Opady:** Precipitation (quarks) — rain, drizzle, snow.
6. **Mgła + burza:** FogLayer, Thunder (+ Force lightning).
7. **Debug:** nowe DebugMenu, VolumeHelpers, PerfOverlay, PerformanceMonitor.
8. **Sprzątanie:** usunięcie starych plików, `config.ts`, martwych typów; aktualizacja `CLAUDE.md` (nowy pipeline, konwencja świata, zdjęty-z-budżetem ban drei Clouds, nowe gotchas). README bez zmian.

## Ryzyka
- **three.quarks × three 0.183** — jeśli peer/API się nie zgadza: pin kompatybilnej wersji; plan B to GPU `Points` z mod-wrap w vertex shaderze (ta sama objętość/wiatr).
- **drei `<Clouds>` overdraw** — pilnowane przez `limit`, brak cumulusów w overcast, odległość (małe na ekranie), PerformanceMonitor. Mierzyć r3f-perf na tierze high przy cover ~0.6 (najgorszy przypadek dla cumulusów).
- **Preetham w nocy/overcast** wygląda źle sam w sobie → stąd SkyGrade; strojenie kolorów to iteracja wizualna.
- Kompresja azymutu łamie „fizyczną” zgodność kierunku słońca z wiatrem — świadomy kompromis (słońce zawsze w kadrze).

## Weryfikacja
- `npm run build` (tsc strict + vite) po każdym kroku.
- `npm run dev` + Chrome (claude-in-chrome), F7:
  - **Czas:** sweep 0→24 h — słońce wschodzi z lewej, zachodzi po prawej, niebo płynnie przechodzi dzień→zmierzch→noc, gwiazdy wygaszane płynnie, księżyc w poprawnej fazie (porównać z datą).
  - **Wiatr (facing S):** z W → ruch w lewo; z E → w prawo; z N → w głąb ku horyzontowi; z S → nad kamerę. Deszcz/śnieg pochylony zgodnie. Lokalizacja na płd. półkuli (np. Sydney przez MapPicker) → odwrócone mapowanie, słońce dalej w kadrze.
  - **Culling:** free cam (C) + VolumeHelpers — chmury, opady i gwiazdy istnieją tylko w objętościach pokrywających kadr; wrap niewidoczny z kamery bazowej.
  - **Budżet:** r3f-perf — burza + deszcz + mgła ≤ 8 draw calli; czyste niebo ≤ 4.
  - **Pogoda:** clear / cover 0.4 / 0.65 / overcast / drizzle / heavy rain / snow / fog (visibility 500 m) / thunderstorm (Force lightning rozświetla chmury).
  - **Jednostki:** przełączenie na imperial nie zmienia wyglądu sceny; frost overlay tylko przy < 0 °C.
  - **Mobile:** DevTools device emulation → tier low (DPR 1, 30 fps, mniejsze budżety); `PerformanceMonitor` schodzi tier przy throttlingu CPU 6×.
