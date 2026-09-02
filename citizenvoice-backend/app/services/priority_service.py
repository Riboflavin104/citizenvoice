CATEGORY_BASE_SCORE = {
    "Public Safety": 55,
    "Water Supply": 40,
    "Electricity": 35,
    "Sanitation": 30,
    "Roads & Infrastructure": 30,
    "Other": 15,
}

URGENT_KEYWORDS = {
    25: ["fire", "gas leak", "electrocution", "collapsed", "life threatening", "accident"],
    15: ["leak", "burst", "no water", "power cut", "live wire", "flooding", "injury"],
    8: ["overflowing", "blocked", "broken", "damaged", "unsafe", "smell", "urgent"],
}


def score_priority(normalized_text: str, category: str) -> tuple[float, str]:
    score = CATEGORY_BASE_SCORE.get(category, 15)
    text = normalized_text.lower()

    for boost, keywords in URGENT_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                score += boost

    score = min(score, 100)

    if score >= 75:
        label = "critical"
    elif score >= 50:
        label = "high"
    elif score >= 25:
        label = "medium"
    else:
        label = "low"

    return float(score), label
