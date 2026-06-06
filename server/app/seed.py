from app.auth_utils import hash_password
from app.config import settings
from app.database import SessionLocal, User


def seed_default_user() -> None:
    if not settings.seed_default_user:
        return
    if not settings.default_seed_password:
        print("SEED: DEFAULT_SEED_PASSWORD non impostata, seed saltato")
        return
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.default_seed_username).first()
        if existing:
            return
        user = User(
            username=settings.default_seed_username,
            email=settings.default_seed_email,
            hashed_password=hash_password(settings.default_seed_password),
        )
        db.add(user)
        db.commit()
        print(f"SEED: utente '{settings.default_seed_username}' creato")
    finally:
        db.close()


if __name__ == "__main__":
    seed_default_user()
