import re
from functools import lru_cache

import numpy as np
import cohere
from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator

from app.config import settings


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(raw_text: str) -> tuple[str, str]:
    text = raw_text.strip()

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text)

    # Keep useful characters
    text = re.sub(r"[^\w\s.,!?₹/-]", "", text)

    try:
        lang = detect(text)
    except LangDetectException:
        lang = "en"

    # Translate non-English complaints to English
    if lang != "en":
        try:
            text = GoogleTranslator(
                source="auto",
                target="en"
            ).translate(text)
        except Exception:
            # If translation fails, continue with original text
            pass

    return text.lower().strip(), lang


# ============================================================
# COHERE CLIENT
# ============================================================

@lru_cache(maxsize=1)
def get_client() -> cohere.Client:
    return cohere.Client(settings.cohere_api_key)


# ============================================================
# EMBEDDING MODEL
# ============================================================

# IMPORTANT:
# Use the same model everywhere.
# Do NOT use all-MiniLM-L6-v2 here because that is not
# a valid Cohere hosted model ID.

EMBEDDING_MODEL = "embed-multilingual-v3.0"


def embed(
    text: str,
    input_type: str = "search_document"
) -> list[float]:
    """
    Generate an embedding for a single text using Cohere.

    search_document:
        Used when storing complaint embeddings.

    search_query:
        Used when searching/comparing complaint embeddings.
    """

    client = get_client()

    response = client.embed(
        texts=[text],
        model=EMBEDDING_MODEL,
        input_type=input_type,
    )

    return response.embeddings[0]


def embed_batch(
    texts: list[str],
    input_type: str = "search_document"
) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in one Cohere API call.
    """

    client = get_client()

    response = client.embed(
        texts=texts,
        model=EMBEDDING_MODEL,
        input_type=input_type,
    )

    return response.embeddings


# ============================================================
# COMPLAINT CATEGORIES
# ============================================================

CATEGORY_PROTOTYPES = {
    "Water Supply":
        "no water supply, water leakage, pipe burst, dirty or "
        "contaminated drinking water, low water pressure",

    "Electricity":
        "power outage, electricity cut, transformer failure, "
        "streetlight not working, exposed live wire, "
        "voltage fluctuation",

    "Roads & Infrastructure":
        "pothole, broken road, damaged footpath, collapsed bridge, "
        "construction debris blocking road",

    "Sanitation":
        "garbage not collected, overflowing trash, open sewage, "
        "drainage blocked, unhygienic public toilet, foul smell "
        "from waste",

    "Public Safety":
        "road accident, fire hazard, theft, harassment, unsafe area, "
        "stray animal attack, gas leak danger",

    "Other":
        "general complaint, suggestion, feedback, miscellaneous "
        "civic issue",
}


# ============================================================
# CATEGORY -> DEPARTMENT
# ============================================================

DEPARTMENT_BY_CATEGORY = {
    category: category
    for category in CATEGORY_PROTOTYPES
}


# ============================================================
# CATEGORY EMBEDDINGS
# ============================================================

@lru_cache(maxsize=1)
def _category_embeddings() -> dict[str, np.ndarray]:
    """
    Create embeddings for all category descriptions.

    This is cached so Cohere is called only once per backend
    process instead of once for every complaint.
    """

    categories = list(CATEGORY_PROTOTYPES.keys())

    descriptions = list(
        CATEGORY_PROTOTYPES.values()
    )

    vectors = embed_batch(
        descriptions,
        input_type="search_document"
    )

    return {
        category: np.array(vector)
        for category, vector in zip(categories, vectors)
    }


# ============================================================
# CLASSIFICATION
# ============================================================

def classify(
    normalized_text: str
) -> tuple[str, float, str]:
    """
    Classify a complaint into the most relevant civic category.

    Returns:
        category
        confidence score
        department name
    """

    # Embed the complaint as a search query
    complaint_vector = np.array(
        embed(
            normalized_text,
            input_type="search_query"
        )
    )

    best_category = "Other"
    best_score = -1.0

    # Compare complaint embedding with category embeddings
    for category, prototype_vector in _category_embeddings().items():

        score = float(
            np.dot(
                complaint_vector,
                prototype_vector
            )
        )

        if score > best_score:
            best_category = category
            best_score = score

    department_name = DEPARTMENT_BY_CATEGORY.get(
        best_category,
        "Other"
    )

    return (
        best_category,
        round(best_score, 3),
        department_name
    )