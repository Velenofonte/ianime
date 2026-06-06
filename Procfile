web: bash scripts/build.sh && cd server && alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
