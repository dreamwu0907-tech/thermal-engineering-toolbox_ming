# Thermal Engineering Toolbox

A browser-based preliminary thermal engineering estimation toolkit.

## Current module

### 01 — Heat transfer area estimator
- Estimate theoretical convection area using Q = h × A × ΔT.
- Apply a configurable design margin to obtain a preliminary recommended area.
- Display equivalent square side length and equivalent thermal resistance.
- Show assumptions, model limitations, and engineering reminders.

## Tech stack
- React + TypeScript + Vite
- Calculations run locally in the browser
- GitHub Actions + GitHub Pages deployment

## Run locally

    npm install
    npm run dev

## Build

    npm run build

## Engineering scope
This project is intended for conceptual design and preliminary estimation. Results are not CFD predictions or validated performance guarantees. Actual thermal design should account for conduction and spreading resistance, TIM/contact resistance, radiation, flow distribution, pressure drop, pump operating point, and test correlation as applicable.

## Roadmap
- Cold plate preliminary sizing
- Flow rate and pressure-drop estimation
- Thermal resistance network
- Air cooling / heatsink estimation
