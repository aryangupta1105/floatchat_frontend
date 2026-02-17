FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source files
COPY ingest.py server.py db_utils.py ./
COPY source_files ./source_files

# Create processed and parquet output dirs
RUN mkdir -p ./source_files/processed ./parquet

ENV PYTHONUNBUFFERED=1
ENV SOURCE_DIR=/app/source_files
ENV PROCESSED_DIR=/app/source_files/processed

EXPOSE 8100
CMD ["python", "server.py"]
