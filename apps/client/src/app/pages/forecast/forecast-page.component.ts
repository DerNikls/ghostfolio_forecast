// apps/client/src/app/pages/forecast/forecast-page.component.ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ForecastService } from '../../services/forecast.service';
import { ForecastChartComponent } from './forecast-chart/forecast-chart.component';

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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ForecastChartComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  selector: 'gf-forecast-page',
  standalone: true,
  styleUrls: ['./forecast-page.component.scss'],
  templateUrl: './forecast-page.component.html'
})
export class ForecastPageComponent implements OnInit, OnDestroy {
  public forecastForm: FormGroup;
  public isLoading = false;
  public forecastResult: ForecastResult | null = null;
  public errorMessage: string | null = null;

  public historicalRangeOptions = [
    { value: '1mo', label: '1 Month' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: '2y', label: '2 Years' },
    { value: '5y', label: '5 Years' }
  ];

  public forecastHorizonOptions = [
    { value: '1w', label: '1 Week' },
    { value: '2w', label: '2 Weeks' },
    { value: '1mo', label: '1 Month' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' }
  ];

  private readonly unsubscribeSubject = new Subject<void>();

  public constructor(
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly forecastService: ForecastService
  ) {}

  public ngOnInit(): void {
    this.forecastForm = this.fb.group({
      isin: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(12),
          Validators.pattern(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
        ]
      ],
      historicalRange: ['1y', Validators.required],
      forecastHorizon: ['1mo', Validators.required]
    });
  }

  public onSubmit(): void {
    if (this.forecastForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.forecastResult = null;
    this.changeDetectorRef.markForCheck();

    const { isin, historicalRange, forecastHorizon } = this.forecastForm.value;

    this.forecastService
      .generateForecast({ isin, historicalRange, forecastHorizon })
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (result) => {
          this.forecastResult = result;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            error?.message ||
            'An unknown error occurred.';
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency ?? 'EUR'
    }).format(value);
  }

  public formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  public getChangeClass(changePercent: number): string {
    return changePercent >= 0 ? 'text-success' : 'text-danger';
  }

  public getScenarioIcon(scenarioName: string): string {
    const icons: Record<string, string> = {
      bearish: 'trending-down-outline',
      base: 'trending-up-outline',
      bullish: 'rocket-outline'
    };
    return icons[scenarioName] ?? 'analytics-outline';
  }

  public ngOnDestroy(): void {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }
}
