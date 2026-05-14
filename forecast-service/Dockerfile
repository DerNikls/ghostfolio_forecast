# forecast-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for building packages
RUN apt-get update && apt-get install -y --no-install-suggests \
  git \
  build-essential \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install uv

# Clone timesfm and install with torch support
RUN git clone https://github.com/google-research/timesfm.git /timesfm
WORKDIR /timesfm
RUN uv pip install --system -e ".[torch]"

# Install additional dependencies
RUN pip install \
  fastapi==0.111.0 \
  "uvicorn[standard]==0.30.0" \
  yfinance==0.2.40 \
  httpx==0.27.0

# Copy our service file
WORKDIR /app
COPY main.py .

# Pre-download the model during build (optional but recommended)
# Comment out if you want faster builds and don't mind first-start delay
# RUN python -c "import timesfm; timesfm.TimesFM_2p5_200M_torch.from_pretrained('google/timesfm-2.5-200m-pytorch')"

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
