# BlueLive Maps 🗺️

BlueLive Maps is an AI-powered maps application built on **Cloudflare Workers**, **OpenStreetMap**, and **Three.js**. It lets you:

- Search for places using natural language
- Get AI-generated suggestions and example locations
- Visualize a simple 3D model concept for a place with one click

## Features

- **AI Place Search**
  - Natural language queries (e.g. “coffee shops in Calgary”)
  - AI-generated related suggestions
  - Structured place results with approximate coordinates

- **Interactive Map**
  - OpenStreetMap tiles via Leaflet (no API key required)
  - Markers and popups for AI-returned places
  - Geolocation centering

- **3D Model Generation**
  - One-click “Generate 3D Model” for a selected place
  - AI describes a simple 3D concept
  - Three.js renders an abstract rotating model

- **UX**
  - Dark/light mode with persistence
  - Map / 3D view toggle
  - Responsive layout

## Tech Stack

- **Backend:** Cloudflare Workers (TypeScript)
- **AI:** Cloudflare Workers AI (`@cf/mistral/mistral-7b-instruct-v0.1`)
- **Map:** Leaflet + OpenStreetMap tiles
- **3D:** Three.js
- **Build:** esbuild + Wrangler

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

### Install

```bash
git clone https://github.com/TBC-VBI-Development/BlueLive-Maps.git
cd BlueLive-Maps
npm install
