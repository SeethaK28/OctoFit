# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Keep one routed React component per capability. Components use the shared API client for all requests, keep API/domain logic out of the UI, and expose loading, empty, and error states accessibly.
- Logic tier decision: Keep HTTP parsing, status codes, and response shapes in Express routes; put validation and fitness rules in `octofitService`. Convert malformed IDs and missing referenced records into deliberate 4xx responses rather than database cast errors or 500s.
- Data tier decision: Define required fields and references in the four Mongoose models. Keep seed data idempotent and non-destructive: upsert the canonical fixtures and preserve unrelated users, teams, activities, and workouts.
- Activity tracking approach: Validate `userId` and `teamId` before creating an activity, persist them as `user` and `team` references, award one point per minute, and set `occurredAt` when the activity is created.
- Team management approach: Require a name and mascot, default `members` to an empty array, and retain submitted member references. Reject invalid or nonexistent member references with a deliberate 4xx response.
- Leaderboard approach: Sum activity points by team, sort by total points descending, and assign sequential 1-based ranks. Use team name as a deterministic tie-breaker.
- Workout suggestions approach: Find the user by email and prefer workouts matching their fitness goal; use their most recent activity as a fallback focus. Include a reason for the first suggestion and return a deliberate 4xx response for an unknown email.

## Test plan

Run the focused contract suites after each tier, then run both builds before considering the implementation complete. A failed data test indicates a schema or seed contract problem; a failed API test indicates route/service behavior or response-shape problems; a failed frontend test indicates request wiring, rendering, or accessible state problems. Build failures indicate TypeScript or bundling integration problems.

| Check | Command | Latest observed result |
| --- | --- | --- |
| Data tier | `npm run test:data --prefix octofit-tracker/backend` | Failed in the full backend run: 4 model-contract tests failed; the seed test passed. |
| API | `npm run test:api --prefix octofit-tracker/backend` | Failed in the full backend run: 4 tests failed across activity/team validation, leaderboard totals, and workout matching. |
| Frontend | `npm test --prefix octofit-tracker/frontend` | Failed: all 15 tests failed; capability views still show the implementation-pending state instead of API results and accessible request states. |
| Backend build | `npm run build --prefix octofit-tracker/backend` | Not run. |
| Frontend build | `npm run build --prefix octofit-tracker/frontend` | Not run. |
| Exercise validation | `node --test tests/exercise-validation.test.mjs` | Failed: 36 of 40 passed. Four failures share a README Copy Exercise badge owner/name mismatch; the affected toolkit/YAML cases are blocked by that metadata check. |
