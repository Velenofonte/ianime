import httpx

from app.config import settings

MAX_TEXT_LENGTH = 8000
TIMEOUT_SECONDS = 30.0


class TranslationError(Exception):
    pass


def translate_en_to_it(text: str) -> str:
    base_url = settings.libretranslate_url.rstrip("/")
    payload: dict[str, str] = {
        "q": text,
        "source": "en",
        "target": "it",
        "format": "text",
    }
    if settings.libretranslate_api_key:
        payload["api_key"] = settings.libretranslate_api_key

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.post(f"{base_url}/translate", json=payload)
    except httpx.RequestError as exc:
        raise TranslationError("Servizio di traduzione non raggiungibile") from exc

    if response.status_code == 429:
        raise TranslationError("Limite richieste traduzione superato, riprova più tardi")
    if response.status_code >= 400:
        raise TranslationError("Errore dal servizio di traduzione")

    try:
        data = response.json()
        translated = data.get("translatedText")
    except ValueError as exc:
        raise TranslationError("Risposta traduzione non valida") from exc

    if not translated or not isinstance(translated, str):
        raise TranslationError("Traduzione non disponibile")

    return translated
