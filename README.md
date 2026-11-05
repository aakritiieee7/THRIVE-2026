# THRIVE

**Teacher Hub for Resources, Instruction, Verified Information & Empowerment**  
Helping teachers thrive, helping students flourish.

THRIVE is an early, teacher-facing build for planning multi-grade lessons and finding practical teaching support. It is being developed for the Education track of Code for a Billion 2026.

## Run locally

Requirements: Node.js 18 or later.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current functionality

- Responsive teacher workspace with Home, Curriculum Studio, Teaching Assistant, Training Centre, Updates, Teacher Community, My Resources and Profile.
- Multi-grade schedule builder with teacher-entered learning goals, dedicated grade turns, independent-work suggestions, exact duration checks, grade-specific exit checks, print and CSV export.
- Local teaching guidance patterns for common planning questions. No external model or curriculum retrieval is connected.
- Short THRIVE-authored learning activities with progress saved in the browser.
- Curated links to official education sources, source links, search, filters and bookmarks. This is not a live circular feed.
- Community posts, replies, helpful reactions, bookmarks and report queue stored in the browser.
- Lesson plan and profile persistence through browser local storage.

## Important limits of this initial build

This is an initial front-end build, not a production deployment. Data is stored in the current browser and is not synced between devices. There is no account authentication, shared database, live AI model, retrieval pipeline, official curriculum ingestion, live news ingestion, or field pilot. The included sample curriculum is illustrative and is not sufficient to claim Bihar SCERT or pan-India curriculum coverage. Review all suggestions against the current official syllabus before classroom use. Training progress is not an official credential.

The repository contains an early FastAPI/Postgres scaffold; its APIs are not yet integrated with the current front end and are not required to run the interface.

## Project structure

- `frontend/` — Next.js teacher workspace
- `backend/` — early FastAPI scaffold
- `worker/` — early background-worker scaffold
- `curriculum/` — curriculum schema and small illustrative sample
- `docs/` — architecture notes and next steps

## Sources and responsibility

Official links currently surfaced in the product include [DIKSHA](https://diksha.gov.in/), [NCERT ePathshala](https://epathshala.nic.in/), and the [Ministry of Education NEP page](https://www.education.gov.in/nep/about-nep). THRIVE does not claim endorsement or partnership with these organisations. The product avoids collecting student information; teachers remain responsible for reviewing classroom materials.

## Hackathon

The current [Code for a Billion 2026 page](https://codeforindia.org/hackathon) describes the 15 November 2026 submission deadline and asks teams to build in AgentFoundry, publish a public repository, record a short demo or provide a live app, and submit through the hackathon form. This repository alone does not establish AgentFoundry use, deployment, teacher adoption, or educational impact.

## License

MIT. See [LICENSE](LICENSE).
