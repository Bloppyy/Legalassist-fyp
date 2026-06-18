from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import checklist, classification, compliance, court_directions, entities, evaluation, templates

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


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "LegalAssist AI Service"}
