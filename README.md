# CitizenVoice

**An AI-powered citizen grievance portal that reads, understands, and prioritizes civic complaints — automatically.**

Citizens in India file civic complaints (potholes, water leakage, power outages, sanitation issues) through scattered, manual channels, and authorities have no easy way to see which problems are urgent or where they're clustering. CitizenVoice closes that gap: citizens report an issue in their own words, and the system classifies it, scores its urgency, flags duplicates, and surfaces it to the right authority — with the affected areas visualized as hotspots on a live map.

## What it does

- **Report in plain language.** A citizen describes their problem, adds a location and an optional photo — no rigid category dropdowns to navigate.
- **AI classification.** An NLP pipeline detects the language (translating if needed), then classifies the complaint into a department — Water Supply, Electricity, Roads & Infrastructure, Sanitation, or Public Safety — using semantic similarity, not keyword matching.
- **Automatic priority scoring.** Each complaint is scored and labeled (low/medium/high/critical) based on its category and urgent-language cues (e.g. "gas leak," "live wire," "fire"), so authorities see what needs attention first.
- **Duplicate detection.** New complaints are compared against existing ones using vector embeddings; near-identical reports of the same issue are automatically merged instead of piling up as separate tickets.
- **Hotspot mapping.** An interactive map clusters complaints geographically, letting authorities spot problem areas at a glance rather than scrolling through a flat list.
- **Status tracking.** Citizens can follow their complaint from submission through resolution; authorities update status from a dedicated dashboard.
- **Privacy-conscious registration.** Aadhaar is used only to validate identity at signup — the number is checksum-verified client- and server-side, then only a masked form (`XXXXXXXX1234`) is ever stored. The full number is never saved.
- **Role-based access.** Regular citizens see only their own complaints; only accounts explicitly marked as an authority can view the full complaint dashboard and hotspot map, enforced at both the database and API level.

## Tech stack

- **Backend:** FastAPI (Python)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Auth, Storage)
- **AI/NLP:** Sentence Transformers for semantic classification, `pgvector` for similarity search and duplicate detection, `langdetect` + Google Translate for multilingual input
- **Maps:** Leaflet.js with OpenStreetMap tiles
- **Frontend:** HTML, CSS, and vanilla JavaScript

## Why it matters

Most grievance portals are just digital complaint boxes — someone still has to manually read, sort, and prioritize every entry. CitizenVoice does that triage automatically, so smaller municipal teams can respond faster, spot recurring problem areas before they escalate, and avoid duplicate effort on issues that have already been reported.