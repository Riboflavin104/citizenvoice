import re
from functools import lru_cache

import numpy as np
import cohere
from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator

from app.config import settings


def normalize_text(raw_text: str) -> tuple[str, str]:
    text = raw_text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s.,!?₹/-]", "", text)

    try:
        lang = detect(text)
    except LangDetectException:
        lang = "en"

    if lang != "en":
        try:
            text = GoogleTranslator(source="auto", target="en").translate(text)
        except Exception:
            pass

    return text.lower().strip(), lang


@lru_cache(maxsize=1)
def get_client() -> cohere.Client:
    return cohere.Client(settings.cohere_api_key)


def embed(text: str, input_type: str = "search_document") -> list[float]:
    """
    Calls Cohere's hosted embedding API instead of loading a local model.
    input_type: "search_document" when embedding a complaint to store,
                "search_query" when embedding text to search/compare against others.
    """
    client = get_client()
    response = client.embed(
        texts=[text],
        model="embed-multilingual-v3.0",  # e.g. "embed-multilingual-v3.0"
        input_type=input_type,
    )
    return response.embeddings[0]


def embed_batch(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    """Batch version — use this when embedding multiple category prototypes at once
    to save API calls."""
    client = get_client()
    response = client.embed(
        texts=texts,
        model=settings.embedding_model,
        input_type=input_type,
    )
    return response.embeddings


CATEGORY_PROTOTYPES = {
    "Water Supply": "no water supply, water leakage, pipe burst, dirty or contaminated "
                     "drinking water, low water pressure",
    "Electricity": "power outage, electricity cut, transformer failure, streetlight not "
                   "working, exposed live wire, voltage fluctuation",
    "Roads & Infrastructure": "pothole, broken road, damaged footpath, collapsed bridge, "
                               "construction debris blocking road",
    "Sanitation": "garbage not collected, overflowing trash, open sewage, drainage blocked, "
                  "unhygienic public toilet, foul smell from waste",
    "Public Safety": "road accident, fire hazard, theft, harassment, unsafe area, stray "
                      "animal attack, gas leak danger",
    "Other": "general complaint, suggestion, feedback, miscellaneous civic issue",
}

DEPARTMENT_BY_CATEGORY = {k: k for k in CATEGORY_PROTOTYPES}


@lru_cache(maxsize=1)
def _category_embeddings() -> dict[str, np.ndarray]:
    # One batched API call for all prototypes, computed once per process
    # (cached via lru_cache) instead of once per request.
    categories = list(CATEGORY_PROTOTYPES.keys())
    descriptions = list(CATEGORY_PROTOTYPES.values())
    vectors = embed_batch(descriptions, input_type="search_document")
    return {cat: np.array(vec) for cat, vec in zip(categories, vectors)}


def classify(normalized_text: str) -> tuple[str, float, str]:
    complaint_vec = np.array(embed(normalized_text, input_type="search_query"))

    best_cat, best_score = "Other", -1.0
    for cat, proto_vec in _category_embeddings().items():
        score = float(np.dot(complaint_vec, proto_vec))
        if score > best_score:
            best_cat, best_score = cat, score

    return best_cat, round(best_score, 3), DEPARTMENT_BY_CATEGORY.get(best_cat, "Other")
