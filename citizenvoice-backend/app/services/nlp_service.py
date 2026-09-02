import re
from functools import lru_cache

import numpy as np
from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator
from sentence_transformers import SentenceTransformer

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
def get_model() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model)


def embed(text: str) -> list[float]:
    model = get_model()
    return model.encode(text, normalize_embeddings=True).tolist()


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
    model = get_model()
    return {cat: model.encode(desc, normalize_embeddings=True) for cat, desc in CATEGORY_PROTOTYPES.items()}


def classify(normalized_text: str) -> tuple[str, float, str]:
    model = get_model()
    complaint_vec = model.encode(normalized_text, normalize_embeddings=True)

    best_cat, best_score = "Other", -1.0
    for cat, proto_vec in _category_embeddings().items():
        score = float(np.dot(complaint_vec, proto_vec))
        if score > best_score:
            best_cat, best_score = cat, score

    return best_cat, round(best_score, 3), DEPARTMENT_BY_CATEGORY.get(best_cat, "Other")
