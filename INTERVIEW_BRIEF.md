# MedTrace — Interview Brief

> Study sheet for talking about this project out loud. Everything here is grounded in the actual code. Where something isn't built, it says so plainly.

---

## 1. Elevator Pitch

MedTrace is a mobile health app that turns the messy pile of medical reports people keep (lab PDFs, prescription photos) into a clean, searchable health history — and lets you *ask questions about your own records in plain language* and get answers that only come from your real data. It also quietly reads your wearable data (heart rate, sleep, steps, etc.) to learn *your* personal normal and flag when something drifts. The goal: a calm, private place where your scattered health information finally lives in one timeline you actually understand.

---

## 2. Plain-English Walkthrough

Here's the whole story, start to finish:

1. **You sign in.** Either with your email (you type your address, get a 6-digit code, type it back) or with a Google account. No passwords.
2. **You add a report.** You tap the "+" button and either snap a photo of a lab report, pick a PDF from your files, or choose an image from your gallery.
3. **The file gets uploaded** to a private storage bucket that only you can read.
4. **The app asks the backend to "read" the report.** The backend downloads your file, sends it to Google's Gemini AI, and says "pull out every test result — name, value, units, normal range — and a short neutral summary."
5. **The AI's answer is checked for correctness** before anything is saved. If it doesn't fit the expected shape, the report is marked "failed" instead of saving junk.
6. **The clean results get saved** as a row on your health timeline plus a list of individual test values.
7. **Back on your phone, the timeline updates** — your new report appears, grouped by month, with how many values it found and how many were flagged abnormal.
8. **Meanwhile, in the background, the app reads your wearable health data** (from Apple Health or Android Health Connect), rolls it up into one number per day per metric, and uploads those daily summaries.
9. **The app learns your "normal."** It looks at the last ~30 days and works out your baseline for each metric. The home dashboard shows tiles like "Sleep — 7h 12m, ≈ your normal" with little sparkline charts.
10. **If a metric drifts for several days in a row** (e.g. 5+ days of unusually low sleep), it writes a gentle "pattern" note onto your timeline — "Sleep below your normal."
11. **You can chat with MedTrace.** You type or *speak* a question like "is my cholesterol okay?" The backend gathers your real records, hands them to the AI, and the AI answers using *only* your data — and cites which reports it used. It never diagnoses; if something's flagged it nudges you to ask your doctor.
12. **You can share with a doctor.** The app generates a QR code containing a one-time, 30-minute link. A doctor scans it, opens a simple web page, and sees a read-only snapshot of your reports and values. After one view, the link is dead.

---

## 3. Architecture

**Three main pieces:** a React Native mobile app, a Python FastAPI backend, and Supabase (database + auth + file storage). External brains: Google Gemini (via Vertex AI) for reading reports and answering chat.

```
┌─────────────────────────────────────────────────────────────┐
│  MOBILE APP  (React Native + Expo, TypeScript)               │
│  • Auth screens (email OTP / Google)                         │
│  • Home timeline + metric dashboard                          │
│  • Chat (text + voice)                                       │
│  • Reads Apple Health / Android Health Connect on-device     │
└───────┬─────────────────────────────┬───────────────────────┘
        │                             │
        │ (1) direct, with user's     │ (2) HTTPS + user's JWT
        │     JWT — RLS enforced      │     in Authorization header
        ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│  SUPABASE            │    │  FastAPI BACKEND  (Python)         │
│  • Postgres + RLS    │◄───┤  /extract  read report → AI → save │
│  • Auth (JWT issuer) │    │  /chat /voice  grounded Q&A        │
│  • Private storage   │    │  /share /share/redeem  doctor view │
│    bucket "reports"  │    │  verifies JWT, uses service role,  │
└──────────────────────┘    │  scoped to that user's id          │
        ▲                   └───────────────┬───────────────────┘
        │                                   │
        │ daily wearable rollups            │ file bytes + prompt
        │ (app writes directly)             ▼
        │                       ┌──────────────────────────┐
        └───────────────────────│  GOOGLE GEMINI (Vertex)  │
                                │  OCR + structured JSON    │
                                └──────────────────────────┘
```

**Two different data paths — this is worth knowing cold:**
- **Path 1 (most app data):** The phone talks *straight to Supabase* using the logged-in user's token. The database's Row-Level Security rules make sure you can only ever touch your own rows. This is how reports get uploaded, the timeline is read, wearable rollups are written, and insights are computed.
- **Path 2 (the AI work):** Anything needing AI or secret keys goes through the FastAPI backend. The phone sends its login token; the backend verifies it, then does privileged work *scoped to that verified user only*.

---

## 4. Tech Stack + Why

| Tech | What it is | Why it was likely chosen (from the code) |
|---|---|---|
| **React Native + Expo (SDK 56)** | Framework for building iOS + Android from one TypeScript codebase | One codebase, both platforms. Expo gives ready-made modules for camera, files, audio, background tasks, health — all used here. Avoids writing native iOS/Android separately. |
| **Expo Router** | File-based navigation (folders = screens) | `app/(auth)`, `app/(tabs)`, `app/report/[id]` — routes are just files. Simpler than wiring a navigation tree by hand. |
| **TypeScript** | JavaScript with type-checking | Catches mistakes before runtime. The code leans on it heavily (typed DB rows, strict null checks). |
| **Supabase** | Hosted Postgres + Auth + Storage in one | Gives a real SQL database, user login, and private file storage without standing up servers. Crucially its **Row-Level Security** lets the phone talk to the DB directly *and safely*, cutting backend code. |
| **PostgreSQL** | The relational database | Health data is relational (users → reports → observations → timeline). Needed real constraints, foreign keys, indexes, and RLS — all Postgres strengths. |
| **FastAPI (Python)** | Web framework for the backend API | Python is where the AI SDKs live. FastAPI + Pydantic gives automatic request validation and is a clean fit for the AI endpoints. |
| **Pydantic** | Data-validation library | The non-negotiable "gate": every value the AI returns is validated against a strict schema before it can be saved. Bad AI output never reaches the DB. |
| **Google Gemini via Vertex AI** | The AI model (`gemini-2.5-flash`) | Multimodal — it reads PDFs *and* images *and* audio in one model. Supports "constrained decoding" so it returns JSON matching our schema. Flash = fast + cheap. |
| **Reanimated + Nativewind** | Animation + Tailwind-style styling | The app has a deliberate calm "Living Bloom" design language with lots of motion; Reanimated runs animations smoothly on the UI thread. |
| **Vercel** | Hosts the Python backend serverlessly | `vercel.json` rewrites every route to the FastAPI app. No servers to manage. |
| **i18next** | Translations | Ships English, Telugu, Hindi — and the user's language is sent to the AI so answers come back translated. |

---

## 5. Key Features & Who Built What

Everything below is **your** code (single-author repo). Use this as your "where does X live" map.

| Feature | Where it lives |
|---|---|
| **Email OTP + Google login** | `app/(auth)/verify.tsx` (6-digit code), `src/lib/googleAuth.ts` (Google→Supabase ID-token), `src/providers/AuthProvider.tsx` (session state) |
| **Upload a report** | `src/lib/reports.ts` → `pickFromCamera` / `pickFromLibrary` / `pickDocument`, then `uploadReport()` (uploads to private bucket + inserts row) |
| **AI report extraction** | `api/extraction.py` → `extract_report()`; orchestrated by `api/main.py` → `extract()` endpoint; schema in `api/schemas.py` |
| **Grounded chat (text)** | `api/chat.py` → `answer_question()` + `build_context()`; endpoint `api/main.py` → `/chat`; client `src/lib/chat.ts`, state in `src/hooks/useChat.ts` |
| **Voice chat** | `api/chat.py` → `answer_voice()`; endpoint `/voice`; client `sendVoiceChat()`; recording in `src/hooks/useVoiceNote.ts` |
| **Wearable sync** | `src/lib/health/sync.ts` (`syncHealthData`), provider selection `src/lib/health/provider.ts`, background registration `src/lib/health/backgroundTask.ts` |
| **"Normal You" pattern engine** | `src/lib/health/patterns.ts` → `detectAndRecordPatterns()` + `detect()` |
| **Dashboard insights** | `src/hooks/useInsights.ts` → `buildInsight()`; home UI `app/(tabs)/index.tsx` |
| **Doctor QR sharing** | `api/main.py` → `create_share()` / `share_page()` / `redeem_share()`; web view `api/doctor-web/index.html`; client `src/lib/share.ts` |
| **Database + security rules** | `supabase/migrations/*.sql` (RLS on every table) |

---

## 6. Code Deep-Dive

These are the 4 files that best show how the system thinks. Study these and you can narrate the whole project.

### 6.1 `api/schemas.py` — the validation gate (why bad AI data never lands)

```python
class ExtractedObservation(BaseModel):
    test_name: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=200)
    unit: Optional[str] = Field(default=None, max_length=50)
    reference_range: Optional[str] = Field(default=None, max_length=100)
    date: Optional[dt.date] = None
    category: Category = "general"      # Category is a fixed list of allowed strings
    flagged: bool = Field(default=False)

    @field_validator("test_name", "value")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v
```

**Line by line, plainly:**
- This is a **schema** — a strict description of what one test result must look like. ("Schema" = the shape/rules data must obey.)
- `test_name` and `value` are required text, 1–200 characters. If the AI sends an empty name, it's rejected.
- `category` must be one of a fixed list (hematology, lipids, etc.) — the AI can't invent categories.
- `flagged` defaults to `false` — a value is only marked abnormal if the report itself said so.
- The `@field_validator` trims whitespace and **throws if the field is blank**. A thrown error here means the whole report is marked "failed" rather than saving garbage.
- **The point to say in interview:** "I treat the AI as untrusted. Its output is validated against Pydantic before a single row is written. This is the line that keeps hallucinated data out of someone's medical history."

### 6.2 `api/extraction.py` — making the AI return clean JSON

```python
def wire_schema(model: type) -> dict:
    schema = model.model_json_schema()
    def strip(node):
        if isinstance(node, dict):
            for key in ("minLength", "maxLength", "minItems", "maxItems", "format"):
                node.pop(key, None)
            for value in node.values():
                strip(value)
        elif isinstance(node, list):
            for value in node:
                strip(value)
    strip(schema)
    return schema

def extract_report(file_bytes, mime_type) -> ExtractionResult:
    client = genai.Client(vertexai=True, project=..., location=...)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[types.Part.from_bytes(data=file_bytes, mime_type=mime_type), _PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=wire_schema(ExtractionResult),
            temperature=0.0,
        ),
    )
    return ExtractionResult.model_validate_json(response.text or "{}")
```

**What's going on:**
- `extract_report` takes the raw file bytes and its type (PDF/image), sends them to Gemini along with a strict prompt ("extract exactly what's printed, never invent").
- `response_json_schema=...` tells Gemini "your answer must match this shape" — this is **constrained decoding** (the model is forced to produce valid JSON in our format).
- `temperature=0.0` = "be as literal and deterministic as possible," which is what you want for copying numbers off a lab report.
- `wire_schema` is a neat real-world wrinkle: Vertex's constrained decoding *rejects* some schema rules (length limits, date formats). So we strip those just for the wire, but the **full Pydantic model still enforces them** when we validate the response. Best of both worlds.
- The last line **re-validates the JSON ourselves** even though the SDK already parsed it — belt and suspenders, because the DB write is non-negotiable.
- **Interview line:** "Two-layer safety: I constrain the model to my schema *and* re-validate its output. The model is convenient, never trusted."

### 6.3 `api/main.py` — the auth model (how one user can't touch another's data)

```python
def _verify_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    user_response = _service_client().auth.get_user(token)   # ask Supabase "who is this?"
    if user_response is None or user_response.user is None:
        raise HTTPException(401, "Invalid token")
    return user_response.user.id

@app.post("/extract")
def extract(body: ExtractRequest, user_id: str = Depends(_verify_user)):
    db = _service_client()
    report_rows = (db.table("reports").select("*")
                   .eq("id", body.report_id)
                   .eq("user_id", user_id).execute())   # must own the report
    if not report_rows.data:
        raise HTTPException(404, "Report not found")
    ...
```

**Plainly:**
- The phone sends its Supabase login token in the `Authorization` header.
- `_verify_user` hands that token back to Supabase and asks "is this real, and who is it?" If valid, it returns that user's id. Every protected endpoint depends on this (`Depends(_verify_user)`).
- The backend then uses the **service role** (a master key that bypasses RLS) — *but* every query is filtered by `.eq("user_id", user_id)` using the *verified* id. So even though the backend technically *could* read anyone's data, it's always pinned to the caller.
- **Interview line:** "The backend has god-mode keys, so I make the user's verified identity the spine of every query. The privileged client is always scoped to the verified user — it can't write one person's data under another's account."

### 6.4 `src/lib/health/patterns.ts` — the "Normal You" engine (real on-device statistics)

```javascript
function detect(rows) {
  const recentCutoff = localDay(startOfDayAgo(RECENT_WINDOW_DAYS - 1));
  const baseline = rows.filter(r => r.day < recentCutoff).map(r => r.value);
  const recent   = rows.filter(r => r.day >= recentCutoff).sort(newestFirst);

  if (baseline.length < MIN_BASELINE_POINTS || recent.length < MIN_DRIFT_RUN) return null;

  const base = median(baseline);
  const mad  = median(baseline.map(v => Math.abs(v - base)));  // spread
  if (mad <= 0) return null;
  const threshold = MAD_MULTIPLIER * mad;                       // 1.5 × MAD

  let run = 0, direction = null;
  for (const row of recent) {
    const deviation = row.value - base;
    if (Math.abs(deviation) <= threshold) break;               // back to normal → stop
    const sign = deviation > 0 ? "above" : "below";
    if (direction === null) direction = sign;
    if (sign !== direction) break;                             // flipped → stop
    run += 1;
  }
  if (direction === null || run < MIN_DRIFT_RUN) return null;   // need 5+ in a row
  ...
}
```

**Plainly:**
- It splits your data into a **baseline** (older days) and **recent** days.
- `median` = the middle value (more robust than an average — one weird day doesn't skew it).
- `MAD` = "median absolute deviation" = a robust measure of how spread-out your normal is. ("How much do I usually bounce around?")
- A day "counts" only if it's more than **1.5× your usual spread** away from your usual middle.
- It then walks recent days newest-first and counts a **run** — consecutive days all drifting the *same direction*. The moment a day is normal again, or flips direction, the run stops.
- It only fires if there are **5+ days in a row** of real drift. Single weird days never trigger it.
- **Interview line:** "It's deliberately conservative robust statistics — median and MAD, not mean and standard deviation — so it never cries wolf. And it only ever compares you to *your own* history, never to population averages. That's a privacy and trust stance, not just a math one."

---

## 7. Likely Interview Questions (answered from the real code)

**Q: How does it handle concurrency / real-time?**
[REAL] There's no live websocket/streaming layer — chat and extraction are request/response. The one place real concurrency matters is the **doctor share token**, and it's handled correctly: `redeem_share` "burns" the token with a *guarded update* — `UPDATE ... WHERE id=? AND used_at IS NULL`. If two people race to redeem, the database lets exactly one win; the loser gets a 410 "used." [ASPIRATIONAL] True real-time (e.g. live-updating timeline across devices) would use Supabase Realtime subscriptions — not built yet.

**Q: What breaks first at 10× users, and how would you fix it?**
[REAL] The extraction endpoint. Each `/extract` call is **synchronous** — it holds the request open while downloading the file and waiting on a multi-second Gemini call (timeout set to 120s client-side, Vercel function `maxDuration` 60s). Under load you'd exhaust serverless concurrency and hit timeouts. [ASPIRATIONAL fix] Move extraction to a **queue/worker** model: the upload just enqueues a job, a background worker processes it, and the app watches the report's `status` column flip from `processing` → `processed`. The DB schema already supports this — `reports.status` is exactly that state machine (`uploaded/processing/processed/failed`).

**Q: Where are the performance bottlenecks?**
[REAL] (1) The AI calls dominate latency — extraction and chat both wait on Gemini. (2) Chat grounding loads up to 40 timeline events + 600 observations + 220 rollups *on every message* (`_load_grounding` in `main.py`) and stuffs them into the prompt — fine now, but token cost and latency grow with a user's history. [ASPIRATIONAL fix] Cap/summarize older records, or retrieve only the relevant ones (RAG) instead of sending everything.

**Q: How is auth/security handled?**
[REAL] Strong, and it's the project's backbone:
- **Login:** email one-time codes or Google ID-token, both via Supabase Auth. No passwords stored.
- **Database:** Row-Level Security on *every* table — policies like `using (user_id = (select auth.uid()))`. The phone talks to the DB directly and still can't read anyone else's rows.
- **Files:** private storage bucket; files live under `<user_id>/<report_id>.ext` and storage policies check the folder matches your uid. The bucket is not public.
- **Backend:** verifies the JWT on every call, uses a service-role key but pins every query to the verified user id.
- **Sharing:** only a SHA-256 *hash* of the share token is stored; the raw token lives only in the QR code. Tokens are single-use, max 30-minute lifetime (enforced by a DB `CHECK` constraint), and revocable.

**Q: How are errors handled?**
[REAL] Thoughtfully, per layer:
- Extraction wraps the whole pipeline in try/except; any failure flips the report to `status='failed'` with an `error_message`, and the user sees a retry affordance. Extraction is also **retry-safe** — it deletes prior observations/timeline rows for that report before re-inserting.
- Network calls use `fetchWithTimeout` so a dead connection fails fast into a designed error state instead of an infinite spinner.
- Chat/voice failures set an error message and keep the pending turn for one-tap **retry** (`useChat.ts`).
- The whole React tree has a branded `CrashScreen` as an `ErrorBoundary` so an uncaught render error shows a reload button, not a frozen app.
- Background sync swallows errors and returns `Failed` cleanly; pattern detection failures never break the sync.

**Q: What are the main trade-offs?**
[REAL] (1) **Direct-to-DB from the phone** (via RLS) means less backend code and lower latency, but it pushes a lot of trust onto correctly-written RLS policies — get one policy wrong and data leaks. (2) **Synchronous extraction** is simple to reason about but doesn't scale (see 10× question). (3) **Sending the full health context on every chat turn** is simple and accurate but grows in cost. (4) **Trusting Gemini for OCR** is fast to build but means accuracy depends on the model — mitigated by strict validation, but a *wrong-but-valid* number could still slip through.

**Q: What would you do differently?**
[REAL/ASPIRATIONAL] Make extraction asynchronous via a job queue from day one; add automated tests (there are none in the repo — see gaps); add a "confidence" / human-review step for extracted values since they're medical; and add retrieval instead of dumping the whole record set into chat prompts.

---

## 8. Honest Gaps & Risks

Be upfront about these — an interviewer will respect it more than overclaiming.

- **No automated tests in the repo.** If asked: "I validated manually and leaned on strict typing + Pydantic schemas as runtime guards, but I haven't written a unit/integration suite yet — that's the first thing I'd add, starting with the extraction validation and the share-token redemption race."
- **Extraction is synchronous, not queued.** Honest framing: "It works and it's simple, but it won't scale; the DB already models the async states, so moving to a worker is a natural next step."
- **Not load-tested.** Say exactly that: "I haven't load-tested it. Based on the code, the AI endpoints are the limit — I'd expect serverless concurrency and Gemini latency to be the first wall, and I'd put extraction behind a queue and watch the `status` column."
- **AI accuracy is a real medical risk.** The app never diagnoses (the prompts hard-forbid it) and only copies printed values, but OCR can still misread a number. There's no second-pass verification or confidence score yet.
- **Chat history is in-memory only** (`useChat.ts`) — conversations reset when the app closes. That's a deliberate simplification (every turn is re-grounded server-side), not a persisted chat product.
- **"Live" heart-rate tile is cosmetic.** The home tile passes `live={...}` for styling; data still comes from daily rollups synced periodically — it's not a real-time stream. Don't call it live monitoring.
- **Some backend reads defensively handle not-yet-applied migrations** (e.g. `metric_daily_rollups` wrapped in try/except in `_load_grounding`). Fine, but it hints the schema evolved in phases — be ready to explain the phased rollout.
- **Doctor web view trust.** The share snapshot is read-only and single-use, but anyone with the live QR within 30 minutes can view it once. That's the intended model (hand the phone to your doctor), not a vulnerability — but know the boundary.

---

## 9. Spoken Script (60–90 seconds)

> "So the problem I was solving: most people have their health history scattered across paper lab reports, PDFs, and photos on their phone — and even when they have it, they can't make sense of the numbers. MedTrace fixes that.
>
> You snap a photo or upload a PDF of a medical report, and the app reads it for you — it uses Google's Gemini AI to pull out every test result, the values, the units, the normal ranges — and lays them out on a clean timeline of your health over time. Then you can literally just ask it questions, by typing or by voice — 'is my cholesterol okay?' — and it answers using *only your actual records*, and tells you which report it got that from. It never diagnoses; if something's off, it gently points you to your doctor.
>
> It also reads your wearable data — heart rate, sleep, steps — in the background, learns *your* personal normal, and quietly flags when something drifts for several days.
>
> Under the hood it's a React Native app, a Python FastAPI backend for the AI work, and Supabase for the database, login, and file storage. What I'm proudest of is the safety design: every value the AI produces is validated against a strict schema before it can touch your medical history, and the whole thing is locked down with row-level security so you can only ever see your own data — even though the app talks to the database directly. There's also a one-time, 30-minute QR code to safely show everything to a doctor.
>
> The result is a calm, private app that finally makes your own health data understandable — and answerable."

---

## Lead With These 5 (all true)

1. **End-to-end AI health-record pipeline I built solo:** snap a report → Gemini OCR → strict Pydantic validation → clean, queryable timeline. The AI is treated as untrusted and gets validated twice before anything is saved.
2. **A grounded, citation-backed health chatbot** (text *and* voice, in English/Telugu/Hindi) that answers only from your real records, refuses to diagnose, and cites its sources — with citations verified against your actual report IDs server-side.
3. **Security-first architecture:** Row-Level Security on every table lets the app talk to the database directly *and* safely; the backend holds master keys but pins every query to the JWT-verified user; share tokens are hashed, single-use, and 30-minute-capped by a DB constraint.
4. **A real on-device statistics engine ("Normal You")** using robust median + MAD math to detect sustained personal-baseline drift — deliberately conservative so it never cries wolf, and it only ever compares you to *your own* history.
5. **A genuinely cross-platform, production-shaped app:** iOS + Android from one TypeScript codebase, Apple Health + Android Health Connect integration, background sync, i18n, a branded crash boundary, and a serverless Python backend on Vercel.
