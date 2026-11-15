FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY backend /app
# The assistant's grounding corpus lives at the repo root, and
# app/assistant.py resolves it as <app>/../../curriculum. /app/app/../../ is
# "/", so the file must land at /curriculum — without this the deployed
# assistant silently falls back to generic guidance with no real sources.
COPY curriculum /curriculum
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
