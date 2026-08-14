from fastapi import APIRouter, Query

from app.services.prime_gti import resolve_prime_gti

router = APIRouter(prefix="/prime", tags=["prime"])


@router.get("/gti")
def prime_gti(url: str = "", title: str = Query(default="")) -> dict:
    return {"gti": resolve_prime_gti(url, title)}
