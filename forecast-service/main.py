# forecast-service/main.py
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import torch
import timesfm
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="TimesFM Forecast Service", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model (loaded once at startup) ───────────────────────────────────────────
tfm = None

@app.on_event("startup")
async def load_model():
    global tfm
    logger.info("Loading TimesFM 2.5 model from HuggingFace (first run downloads ~800MB)...")
    
    torch.set_float32_matmul_precision("high")
    
    tfm = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        "google/timesfm-2.5-200m-pytorch"
    )
    
    tfm.compile(
        timesfm.ForecastConfig(
            max_context=1024,
            max_horizon=256,
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            infer_is_positive=True,
            fix_quantile_crossing=True,
        )
    )
    
    logger.info("TimesFM 2.5 model loaded successfully!")

# ── DTOs ──────────────────────────────────────────────────────────────────────
class ForecastRequest(BaseModel):
    isin: str
    historicalRange: str = "2y"   # e.g. "1y", "2y", "5y"
    forecastHorizon: str = "1y"   # e.g. "3m", "6m", "1y", "2y"

# ── Helpers ───────────────────────────────────────────────────────────────────
ISIN_TO_TICKER = {
    "US0378331005": "AAPL",
    "US5949181045": "MSFT",
    "US02079K3059": "GOOGL",
    "US88160R1014": "TSLA",
    "US0231351067": "AMZN",
}

def resolve_ticker(isin: str) -> str:
    """Try static map first, then yfinance search."""
    if isin in ISIN_TO_TICKER:
        return ISIN_TO_TICKER[isin]
    try:
        search = yf.Search(isin)
        quotes = search.quotes
        if quotes:
            return quotes[0]["symbol"]
    except Exception:
        pass
    raise HTTPException(status_code=404, detail=f"Could not resolve ISIN {isin} to a ticker.")

def parse_horizon_days(horizon: str) -> int:
    unit = horizon[-1].lower()
    value = int(horizon[:-1])
    if unit == "d": return value
    if unit == "w": return value * 7
    if unit == "m": return value * 30
    if unit == "y": return value * 365
    return 365

def parse_range_period(range_str: str) -> str:
    """Convert our range string to yfinance period."""
    mapping = {"1y": "1y", "2y": "2y", "5y": "5y", "3y": "2y", "6m": "6mo", "3m": "3mo"}
    return mapping.get(range_str, "2y")

# ── Forecast endpoint ─────────────────────────────────────────────────────────
@app.post("/forecast")
async def generate_forecast(req: ForecastRequest):
    if tfm is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    # 1. Resolve ticker
    ticker = resolve_ticker(req.isin)

    # 2. Download historical data
    period = parse_range_period(req.historicalRange)
    try:
        raw = yf.download(ticker, period=period, interval="1d", auto_adjust=True, progress=False)
        if raw.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}.")
        prices = raw["Close"].dropna()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {e}")

    # 3. Prepare historical series
    hist_values = prices.values.astype(float).flatten().tolist()
    hist_dates  = [d.strftime("%Y-%m-%d") for d in prices.index]
    last_price  = hist_values[-1]

    # Get currency
    try:
        info = yf.Ticker(ticker).info
        currency = info.get("currency", "USD")
    except Exception:
        currency = "USD"

    # 4. Run TimesFM 2.5 forecast
    horizon_days = parse_horizon_days(req.forecastHorizon)
    horizon_days = min(horizon_days, 256)  # TimesFM 2.5 max horizon

    context = np.array(hist_values, dtype=np.float32)

    point_forecast, quantile_forecast = tfm.forecast(
        horizon=horizon_days,
        inputs=[context],
    )
    # point_forecast shape: (1, horizon_days)
    # quantile_forecast shape: (1, horizon_days, 10)  → quantiles 10th–90th

    point_vals    = point_forecast[0].tolist()
    lower_vals    = quantile_forecast[0, :, 1].tolist()   # ~20th percentile
    upper_vals    = quantile_forecast[0, :, 7].tolist()   # ~80th percentile

    # 5. Build forecast dates (business days from last historical date)
    last_date = prices.index[-1].to_pydatetime()
    forecast_dates = []
    current = last_date
    for _ in range(horizon_days):
        current += timedelta(days=1)
        while current.weekday() >= 5:  # skip weekends
            current += timedelta(days=1)
        forecast_dates.append(current.strftime("%Y-%m-%d"))

    # 6. Build scenarios from quantile output
    final_point = point_vals[-1]
    change_pct  = ((final_point - last_price) / last_price) * 100

    scenarios = [
        {
            "name": "base",
            "label": "Base Case",
            "color": "#3b82f6",
            "description": "TimesFM point forecast",
            "data": [
                {
                    "date":        forecast_dates[i],
                    "value":       round(point_vals[i], 4),
                    "lower_bound": round(lower_vals[i], 4),
                    "upper_bound": round(upper_vals[i], 4),
                }
                for i in range(horizon_days)
            ],
            "final_value":   round(final_point, 4),
            "change_percent": round(change_pct, 2),
        },
        {
            "name": "bull",
            "label": "Bull Case (80th %ile)",
            "color": "#22c55e",
            "description": "Optimistic scenario based on upper quantile",
            "data": [
                {"date": forecast_dates[i], "value": round(upper_vals[i], 4)}
                for i in range(horizon_days)
            ],
            "final_value":   round(upper_vals[-1], 4),
            "change_percent": round(((upper_vals[-1] - last_price) / last_price) * 100, 2),
        },
        {
            "name": "bear",
            "label": "Bear Case (20th %ile)",
            "color": "#ef4444",
            "description": "Pessimistic scenario based on lower quantile",
            "data": [
                {"date": forecast_dates[i], "value": round(lower_vals[i], 4)}
                for i in range(horizon_days)
            ],
            "final_value":   round(lower_vals[-1], 4),
            "change_percent": round(((lower_vals[-1] - last_price) / last_price) * 100, 2),
        },
    ]

    return {
        "isin":            req.isin,
        "symbol":          ticker,
        "historical_data": [
            {"date": hist_dates[i], "value": round(hist_values[i], 4)}
            for i in range(len(hist_values))
        ],
        "scenarios":    scenarios,
        "last_price":   round(last_price, 4),
        "currency":     currency,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok" if tfm is not None else "loading",
        "model":  "TimesFM 2.5 200M",
        "time":   datetime.utcnow().isoformat(),
    }
