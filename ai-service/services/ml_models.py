"""
Shared ML model singleton.
Both similarity_scorer and classifier import from here so the heavy
sentence-transformer is only loaded once per process.
"""

from functools import lru_cache

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def get_sentence_model():
    """Return the shared SentenceTransformer instance (loaded once, cached forever)."""
    try:
        from sentence_transformers import SentenceTransformer
        print(f"[ml_models] Loading sentence transformer: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        print("[ml_models] Sentence transformer ready.")
        return model
    except Exception as e:
        print(f"[ml_models] WARNING: could not load sentence transformer — {e}")
        return None
