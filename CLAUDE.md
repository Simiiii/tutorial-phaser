# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A step-by-step tutorial demonstrating real-time multiplayer with **Phaser** (game client) and **Colyseus** (WebSocket game server). The project has two independent sub-packages: `client/` and `server/`, each with their own `package.json`.

## Commands

### Docker — Production
```
docker compose up --build
```

### Docker — Development
```
docker compose -f docker-compose.yml -f docker-compose.dev.yml build
docker compose -f docker-compose.yml -f docker-compose.dev.yml watch
```

## Architecture

### Tutorial progression (Parts 1–4)
Each part adds a feature layer. The same pattern repeats: a `PartNRoom.ts` on the server and a `PartNScene.ts` on the client.

| Part | Feature |
|------|---------|
| 1 | Basic player movement — server applies input immediately |
| 2 | Interpolation for remote players |
| 3 | Client-predicted input (local player moves immediately, server reconciles) |
| 4 | Fixed tickrate (60Hz) on both client and server with an input queue |

### Server (`server/src/`)
- `index.ts` — entry point; calls `listen(appConfig)` from `@colyseus/tools`
- `app.config.ts` — registers all four rooms (`part1_room` … `part4_room`) and mounts Express routes + `/monitor` (Colyseus dashboard) + `/` playground (dev only)
- `rooms/PartNRoom.ts` — each room contains its state schema (decorated with `@colyseus/schema`), a `messages` map (message type `0` = player input), and lifecycle hooks (`onCreate`, `onJoin`, `onLeave`, `onDispose`)

### Client (`client/src/`)
- `index.ts` — Phaser game config; registers all scenes; handles the FPS slider in the UI
- `backend.ts` — exports `BACKEND_URL` (auto-detects `localhost:2567` vs production WebSocket URL)
- `scenes/SceneSelector.ts` — menu scene; switches to the chosen part scene via URL hash or click
- `scenes/PartNScene.ts` — each scene instantiates `new Client(BACKEND_URL)` and calls `joinOrCreate("partN_room")`

### Cross-package typing
The client imports server types directly for strong typing:
```ts
import type server from "../../../server/src/app.config";
import type { InputData, Part4Room } from "../../../server/src/rooms/Part4Room";
```
This gives end-to-end type safety without a shared package — changes to server schemas are immediately reflected in the client's TypeScript compiler.

### Key Colyseus patterns used
- State is defined as `Schema` classes with `@type(...)` decorators; Colyseus auto-syncs these to all clients.
- `Callbacks.get(room)` / `callbacks.onAdd` / `callbacks.onChange` / `callbacks.onRemove` are used instead of direct `room.state.players.onAdd` to match the Colyseus 0.17 API.
- Part 4 uses `setSimulationInterval` on the server with a fixed 60Hz tick and an `inputQueue` per player to decouple client framerate from server tick.

### Known issue in tests
`server/test/MyRoom_test.ts` references `../src/arena.config` (old template name) — this import will fail. The actual config file is `src/app.config.ts`.
