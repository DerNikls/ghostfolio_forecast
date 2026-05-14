// apps/client/src/app/services/forecast.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ForecastRequest {
  isin: string;
  historicalRange: string;
  forecastHorizon: string;
}

export interface ForecastPoint {
  date: string;
  value: number;
  lower_bound?: number;
  upper_bound?: number;
}

export interface ForecastScenario {
  name: string;
  label: string;
  color: string;
  description: string;
  data: ForecastPoint[];
  change_percent: number;
  final_value: number;
}

export interface ForecastResult {
  isin: string;
  symbol: string;
  historical_data: ForecastPoint[];
  scenarios: ForecastScenario[];
  last_price: number;
  currency: string;
  generated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ForecastService {
  public constructor(private readonly http: HttpClient) {}

  public generateForecast(request: ForecastRequest): Observable<ForecastResult> {
    return this.http.post<ForecastResult>('/api/forecast', request);
  }
}
