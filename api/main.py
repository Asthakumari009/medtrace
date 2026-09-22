"""MedTrace extraction API.

POST /extract  — authenticated. Either the phone already recognised the
document on-device and sends only the text, or the service downloads the
uploaded file from Supabase storage and reads it. Both paths run Gemini
extraction validated by the same Pydantic gate, then write observations and a
timeline event and update report status.

Auth model: the mobile app sends the user's Supabase JWT. We verify it by
asking Supabase Auth for the user. All writes use the service-role client but
are explicitly scoped to the verified user's id — the API can never write
one user's data under another user's account.
"""

import json
import logging
import os
import tempfile
from typing import Literal
from functools import lru_cache

from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field, TypeAdapter, ValidationError
from supabase import Client, create_client

from chat import answer_question, answer_voice, build_context
from extraction import extract_from_text, extract_report
from schemas import ExtractionResult

load_dotenv()

# Allow GOOGLE_APPLICATION_CREDENTIALS to be relative to this directory.
_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if _creds and not os.path.isabs(_creds):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), _creds
    )

# Serverless hosts have no credentials file on disk — the service-account
# JSON arrives in GOOGLE_SA_JSON and is materialized into the temp dir so
# google-auth can read a file path as usual.
_sa_json = os.environ.get("GOOGLE_SA_JSON")
if _sa_json and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    _sa_path = os.path.join(tempfile.gettempdir(), "sa-vertex.json")
    with open(_sa_path, "w", encoding="utf-8") as _fh:
        _fh.write(_sa_json)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _sa_path

logger = logging.getLogger("medtrace.api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="MedTrace extraction API", docs_url=None, redoc_url=None)
# Set deployed web origins explicitly; bearer authentication still scopes every request.
_web_origins = [origin.strip() for origin in os.environ.get(
    "VITA_ALLOWED_ORIGINS", "http://localhost:8082,http://localhost:8083"
).split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_web_origins,
                   allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type"], allow_credentials=False)

_MIME_BY_EXT = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
}


@lru_cache(maxsize=1)
def _service_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])


def _verify_user(authorization: str | None = Header(default=None)) -> str:
    """Validate the caller's Supabase JWT and return their user id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        user_response = _service_client().auth.get_user(token)
    except Exception as exc:  # invalid/expired token
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if user_response is None or user_response.user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_response.user.id


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    # User's UI language; the model answers in it (en/te/hi, default en).
    language: Literal["en", "te", "hi"] = "en"


class Citation(BaseModel):
    report_id: str
    title: str
    occurred_at: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


class VoiceChatResponse(ChatResponse):
    transcript: str


class ExtractRequest(BaseModel):
    report_id: str
    # Present when the phone recognised the document itself. The image was
    # never uploaded, so this text is all the server ever sees of it.
    text: str | None = Field(default=None, min_length=1, max_length=40_000)


class ExtractResponse(BaseModel):
    report_id: str
    status: str
    observation_count: int
    source: Literal["cloud", "on_device_ocr"] = "cloud"


@app.get("/health")
def health() -> dict[str, object]:
    # Presence booleans only — never values. Lets a fresh deployment be
    # checked for wiring without leaking configuration.
    return {
        "status": "ok",
        "config": {
            "supabase": bool(os.environ.get("SUPABASE_URL"))
            and bool(os.environ.get("SUPABASE_SECRET_KEY")),
            "vertex": bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
            and bool(os.environ.get("GOOGLE_CLOUD_PROJECT")),
        },
    }


def _load_grounding(db: Client, user_id: str) -> tuple[list[dict], str]:
    """Load the user's timeline + observations and render the grounding
    context. Returns (events, context). select("*") so an added column never
    breaks this."""
    events = (
        db.table("timeline_events")
        .select("*")
        .eq("user_id", user_id)
        .order("occurred_at", desc=True)
        .limit(40)
        .execute()
    ).data
    observations = (
        db.table("extracted_observations")
        .select("report_id, test_name, value, unit, reference_range, observed_at, flagged")
        .eq("user_id", user_id)
        .limit(600)
        .execute()
    ).data
    by_report: dict[str, list[dict]] = {}
    for obs in observations:
        by_report.setdefault(obs["report_id"], []).append(obs)
    # Doctor, facility, diagnoses and drugs live on the report row, so the
    # timeline alone cannot answer "which medicine did I take for this".
    report_ids = [e["report_id"] for e in events if e.get("report_id")]
    details_by_report: dict[str, dict] = {}
    if report_ids:
        details_by_report = {
            r["id"]: r
            for r in (
                db.table("reports")
                .select("id, doctor_name, facility_name, diagnoses, medications")
                .eq("user_id", user_id)
                .in_("id", report_ids)
                .execute()
            ).data
        }
    return events, build_context(events, by_report, details_by_report)


def _validated_citations(events: list[dict], citation_report_ids: list[str]) -> list[Citation]:
    """Only cite reports that really belong to this user's timeline."""
    event_by_report = {e["report_id"]: e for e in events if e["report_id"] is not None}
    return [
        Citation(
            report_id=rid,
            title=event_by_report[rid]["title"],
            occurred_at=event_by_report[rid]["occurred_at"],
        )
        for rid in dict.fromkeys(citation_report_ids)
        if rid in event_by_report
    ]


@app.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user_id: str = Depends(_verify_user)) -> ChatResponse:
    db = _service_client()
    events, context = _load_grounding(db, user_id)

    # Grounded Gemini turn, Pydantic-validated.
    try:
        result = answer_question(
            [m.model_dump() for m in body.messages], context, body.language
        )
    except Exception as exc:
        logger.exception("Chat failed for user %s", user_id)
        raise HTTPException(status_code=502, detail="Chat failed") from exc

    return ChatResponse(
        answer=result.answer,
        citations=_validated_citations(events, result.citation_report_ids),
    )


_VOICE_MAX_BYTES = 4 * 1024 * 1024  # ~8 min of 64kbps mono AAC; serverless-safe
# The native recorder sends AAC in an .m4a container; a browser's MediaRecorder
# sends webm/Opus or ogg/Opus, so the web build needs those admitted too.
_VOICE_MIMES = {
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
}
_history_adapter = TypeAdapter(list[ChatMessage])


def _voice_mime(raw: str | None) -> str:
    """Normalise the upload's content type before it is handed to the model.

    Browsers append codec parameters ("audio/webm;codecs=opus"), so only the
    bare type is matched. An unsupported type is refused rather than
    relabelled: telling the model a webm clip is audio/mp4 gives it bytes that
    do not match the mime, which fails as garbled audio rather than a clear
    error the caller can act on.
    """
    if not raw:
        # The native recorder does not always set one, and it is always
        # AAC in an .m4a container.
        return "audio/mp4"
    base = raw.split(";", 1)[0].strip().lower()
    if base not in _VOICE_MIMES:
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    return base


@app.post("/voice", response_model=VoiceChatResponse)
async def voice_chat(
    audio: UploadFile = File(...),
    history: str = Form("[]"),
    language: str = Form("en"),
    user_id: str = Depends(_verify_user),
) -> VoiceChatResponse:
    """Voice turn: transcribe the spoken question and answer it, grounded in
    the user's records, in a single Gemini call. `history` is the prior text
    turns as JSON; the audio clip itself is the newest user turn."""
    if language not in ("en", "te", "hi"):
        language = "en"
    try:
        prior_turns = _history_adapter.validate_python(json.loads(history))[-30:]
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Bad history") from exc

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Empty audio")
    if len(audio_bytes) > _VOICE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too long")
    mime = _voice_mime(audio.content_type)

    db = _service_client()
    events, context = _load_grounding(db, user_id)

    try:
        result = answer_voice(
            audio_bytes,
            mime,
            [m.model_dump() for m in prior_turns],
            context,
            language,
        )
    except Exception as exc:
        logger.exception("Voice chat failed for user %s", user_id)
        raise HTTPException(status_code=502, detail="Voice chat failed") from exc

    return VoiceChatResponse(
        answer=result.answer,
        citations=_validated_citations(events, result.citation_report_ids),
        transcript=result.transcript.strip(),
    )


# Scoped, revocable sharing. Every doctor request revalidates the grant.
from sharing import build_share_router
app.include_router(build_share_router(lambda: _service_client(), _verify_user))

@app.post("/extract", response_model=ExtractResponse)
def extract(body: ExtractRequest, user_id: str = Depends(_verify_user)) -> ExtractResponse:
    db = _service_client()

    # 1. Load the report and confirm ownership.
    report_rows = (
        db.table("reports").select("*").eq("id", body.report_id).eq("user_id", user_id).execute()
    )
    if not report_rows.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = report_rows.data[0]

    # An on-device report keeps no file, so a retry with no text has nothing to
    # read. Reject before touching status, or the row stalls in "processing".
    if body.text is None and not report.get("file_path"):
        raise HTTPException(
            status_code=409,
            detail="This report was read on your device and kept no copy. Add it again to retry.",
        )

    db.table("reports").update({"status": "processing", "error_message": None}).eq(
        "id", body.report_id
    ).execute()

    try:
        # 2. Read the document. Either the phone already recognised it and
        #    sent only the text, or we download the uploaded file and read it.
        if body.text is not None:
            source = "on_device_ocr"
            result: ExtractionResult = extract_from_text(body.text)
        else:
            source = "cloud"
            file_bytes = db.storage.from_("reports").download(report["file_path"])
            ext = report["file_path"].rsplit(".", 1)[-1].lower()
            mime = _MIME_BY_EXT.get(ext, "application/pdf")
            result = extract_report(file_bytes, mime)

        # 4. Replace any previous observations for this report (retry-safe).
        db.table("extracted_observations").delete().eq("report_id", body.report_id).eq(
            "user_id", user_id
        ).execute()

        rows = [
            {
                "report_id": body.report_id,
                "user_id": user_id,
                "test_name": obs.test_name,
                "value": obs.value,
                "value_numeric": obs.numeric_value(),
                "unit": obs.unit,
                "reference_range": obs.reference_range,
                "observed_at": (obs.date or result.report_date).isoformat()
                if (obs.date or result.report_date)
                else None,
                "category": obs.category,
                "flagged": obs.flagged,
            }
            for obs in result.observations
        ]
        if rows:
            db.table("extracted_observations").insert(rows).execute()

        # 5. Upsert the timeline event for this report.
        event_date = result.report_date or report.get("report_date")
        db.table("timeline_events").delete().eq("report_id", body.report_id).eq(
            "user_id", user_id
        ).execute()
        db.table("timeline_events").insert(
            {
                "user_id": user_id,
                "report_id": body.report_id,
                "event_type": "report",
                "title": result.report_title,
                "summary": result.summary,
                "occurred_at": (
                    event_date.isoformat() if hasattr(event_date, "isoformat") else event_date
                )
                or report["created_at"][:10],
            }
        ).execute()

        # 6. Mark processed.
        db.table("reports").update(
            {
                "status": "processed",
                "title": result.report_title,
                "report_date": result.report_date.isoformat() if result.report_date else None,
                "extraction_source": source,
                # Overwritten wholesale, not merged: a retry re-reads the same
                # document, so last extraction wins and stale drugs never linger.
                "doctor_name": result.doctor_name,
                "facility_name": result.facility_name,
                "diagnoses": result.diagnoses,
                "medications": [m.model_dump(exclude_none=True) for m in result.medications],
            }
        ).eq("id", body.report_id).execute()

        return ExtractResponse(
            report_id=body.report_id,
            status="processed",
            observation_count=len(rows),
            source=source,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Extraction failed for report %s", body.report_id)
        db.table("reports").update(
            {"status": "failed", "error_message": str(exc)[:500]}
        ).eq("id", body.report_id).execute()
        raise HTTPException(status_code=502, detail="Extraction failed") from exc
