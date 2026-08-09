import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import checklist, classification, compliance, court_directions, entities, evaluation, ocr, templates
from services.ml_models import get_sentence_model
from services.direction_parser import _load_nlp

app = FastAPI(
    title="LegalAssist AI Service",
    description=(
        "NLP microservice for Malaysian civil litigation document compliance checking, "
        "entity extraction, template matching, document classification, and parser evaluation. "
        "Consumed internally by the Node.js backend — not called directly from the frontend."
    ),
    version="2.0.0",
)

# CORS — only the Node.js backend needs to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # internal service — only the Node.js backend calls this
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

# Routers
app.include_router(compliance.router)
app.include_router(entities.router)
app.include_router(templates.router)
app.include_router(court_directions.router)
app.include_router(classification.router)
app.include_router(evaluation.router)
app.include_router(checklist.router)
app.include_router(ocr.router)


def _preload_models():
    """Load heavy models in a background thread — port binds immediately, models warm up concurrently."""
    try:
        _load_nlp()
        get_sentence_model()
        print("[startup] Models ready.")
    except Exception as e:
        print(f"[startup] Model preload failed: {e}")


# Start background model loading the moment the module is imported.
# This means uvicorn binds its port straight away (Render detects it),
# while models load in parallel over the next 30–60 seconds.
threading.Thread(target=_preload_models, daemon=True).start()


@app.get("/", tags=["Health"])
def health_check():
    model_ready = get_sentence_model() is not None
    return {
        "status": "ok" if model_ready else "warming_up",
        "service": "LegalAssist AI Service",
        "model_ready": model_ready,
    }
