from fastapi import APIRouter, Depends, HTTPException, status

from app.database import User
from app.deps import get_current_user
from app.schemas import TranslateDescriptionRequest, TranslateDescriptionResponse
from app.services.translation import TranslationError, translate_en_to_it

router = APIRouter(prefix="/descriptions", tags=["descriptions"])


@router.post("/translate", response_model=TranslateDescriptionResponse)
def translate_description(
    body: TranslateDescriptionRequest,
    _current_user: User = Depends(get_current_user),
) -> TranslateDescriptionResponse:
    try:
        translated = translate_en_to_it(body.text.strip())
    except TranslationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return TranslateDescriptionResponse(translated=translated)
