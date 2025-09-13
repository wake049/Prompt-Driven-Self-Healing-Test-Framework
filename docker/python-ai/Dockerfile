FROM python:3.11-slim-bullseye
WORKDIR /app
COPY services/python-ai/requirements.txt .
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends gcc && \
	pip install --no-cache-dir -r requirements.txt && \
	apt-get purge -y --auto-remove gcc && \
	rm -rf /var/lib/apt/lists/*
COPY services/python-ai/ .
EXPOSE 8000
CMD ["python", "app.py"]