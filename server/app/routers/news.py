from fastapi import APIRouter, HTTPException, Query

from app.services.italy_news import ItalyNewsError, get_italy_articles

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/italy")
def italy_news(
    q: str = "",
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    try:
        articles = get_italy_articles()
    except ItalyNewsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    needle = q.strip().lower()
    if needle:
        articles = [
            article
            for article in articles
            if needle in article["title"].lower() or needle in article["excerpt"].lower()
        ]

    page = articles[offset : offset + limit]
    next_offset = offset + len(page)
    has_more = next_offset < len(articles)
    return {
        "articles": page,
        "hasMore": has_more,
        "nextOffset": next_offset if has_more else None,
    }
