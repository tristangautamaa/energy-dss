# Energy Access Planner

A decision-support dashboard that shows which of Indonesia's 514 districts (regencies and cities) to look at first when planning renewable-energy access programs, such as solar home systems and village mini-grids.

**Live:** https://tristangautamaa.github.io/energy-dss/

## What it shows

| Layer | What it means |
|---|---|
| **Access disadvantage index** (0 to 100) | Weighted average of four parts: night-time light, poverty and human development, road access, and terrain and land cover. Higher means darker, poorer, more remote and harder to reach. |
| **Solar and wind resource** (0 to 100) | Solar irradiance and wind speed. Kept separate from the index. |
| **Similarity to the underdeveloped list** (0 to 1) | How closely a district's map features resemble the 30 districts on the government's 2025–2029 list of underdeveloped regions. Not a measure of disadvantage. |
| **Landscape group** | Seven exploratory groups of districts with similar terrain, roads, wind and light. |

The **shortlist** is the 50 districts with the highest similarity score. The views are **Map**, **Rank and weights** (try your own weights), **Compare** (two to four districts) and **How it works** (data, methods and limits).

## How it works

It is a static web app: plain HTML, CSS and JavaScript, with no server and no build step. All scores were calculated in advance and are stored in `data/`. Nothing you search for is sent anywhere.

To run it locally:

```
python -m http.server 8610
```

Then open http://localhost:8610/.

## Limits

- It is a screening aid, not an investment decision or a grid-extension plan. There are no cost, demand or grid data.
- There are no district-level household electricity data. Night-time light is a rough stand-in for electricity access and also reflects population density.
- 26 of the 30 currently listed districts are in the Papua region, so simple regional rules perform about as well as the model.

## Data sources

geoBoundaries ADM2, Statistics Indonesia (Human Development Index, poverty rate, population), NASA Black Marble VNP46A2 night-time light, USGS SRTM elevation, ESA WorldCover v200, NASA POWER, Global Wind Atlas 3, OpenStreetMap (© OpenStreetMap contributors, ODbL), and the government's lists of underdeveloped regions (2020–2024 and 2025–2029).

## Third-party code and fonts

- MapLibre GL JS 4.7.1, 3-Clause BSD license (`vendor/`)
- Plus Jakarta Sans, SIL Open Font License 1.1 (`fonts/`)

Built for a research paper submitted to ICDEES 2026.
