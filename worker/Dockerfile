# Build Stage
FROM python:3.11-slim AS builder
WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runner Stage
FROM python:3.11-slim AS runner
WORKDIR /app

RUN adduser --disabled-password --gecos "" appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY *.py ./

USER appuser

CMD ["python", "worker.py"]
