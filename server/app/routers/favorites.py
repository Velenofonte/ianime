from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import Favorite, User
from app.deps import get_current_user, get_db
from app.schemas import FavoritesResponse

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=FavoritesResponse)
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoritesResponse:
    favorites = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    return FavoritesResponse(anilist_ids=[f.anilist_id for f in favorites])


@router.post("/{anilist_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(
    anilist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.anilist_id == anilist_id)
        .first()
    )
    if existing:
        return {"ok": True, "anilist_id": anilist_id}
    favorite = Favorite(user_id=current_user.id, anilist_id=anilist_id)
    db.add(favorite)
    db.commit()
    return {"ok": True, "anilist_id": anilist_id}


@router.delete("/{anilist_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    anilist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.anilist_id == anilist_id)
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=404, detail="Preferito non trovato")
    db.delete(favorite)
    db.commit()
