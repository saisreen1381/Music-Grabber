FROM python:3.10-slim

# Install system dependencies (ffmpeg is required by yt-dlp for extracting audio to MP3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    nodejs \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (officially recommended by yt-dlp for JS challenge solving)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

WORKDIR /app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install yt-dlp directly via pip so it runs with the latest updates
RUN pip install --no-cache-dir yt-dlp

# Copy app code
COPY app/ ./app/
# Mount profiles dynamically, but provide users directory structure
RUN mkdir -p users

# Expose server port
EXPOSE 8010

# Run FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
