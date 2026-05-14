// apps/client/src/app/pages/forecast/forecast-chart/forecast-chart.component.ts
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { de } from 'date-fns/locale';

import {
  ForecastPoint,
  ForecastScenario
} from '../forecast-page.component';

Chart.register(
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip
);

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  selector: 'gf-forecast-chart',
  standalone: true,
  styleUrls: ['./forecast-chart.component.scss'],
  templateUrl: './forecast-chart.component.html'
})
export class ForecastChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() public currency: string = 'EUR';
  @Input() public historicalData: ForecastPoint[] = [];
  @Input() public scenarios: ForecastScenario[] = [];
  @Input() public symbol: string = '';

  @ViewChild('chartCanvas')
  public chartCanvas: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  public ngAfterViewInit(): void {
    this.buildChart();
  }

  public ngOnChanges(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    if (this.chartCanvas) {
      this.buildChart();
    }
  }

  public ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private buildChart(): void {
    if (!this.chartCanvas || !this.historicalData?.length) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const historicalDataset = {
      borderColor: '#6366f1',
      borderWidth: 2,
      data: this.historicalData.map((p) => ({
        x: new Date(p.date).getTime(),
        y: p.value
      })),
      fill: false,
      label: 'Historical',
      pointRadius: 0,
      tension: 0.1
    };

    const scenarioDatasets = this.scenarios.flatMap((scenario) => {
      const lineDataset = {
        borderColor: scenario.color,
        borderDash: [5, 5],
        borderWidth: 2,
        data: scenario.data.map((p) => ({
          x: new Date(p.date).getTime(),
          y: p.value
        })),
        fill: false,
        label: scenario.label,
        pointRadius: 0,
        tension: 0.1
      };

      const bandDataset = {
        backgroundColor: scenario.color + '20',
        borderWidth: 0,
        data: scenario.data.map((p) => ({
          x: new Date(p.date).getTime(),
          y: p.upper_bound ?? p.value
        })),
        fill: '+1',
        label: `${scenario.label} Band`,
        pointRadius: 0,
        showInLegend: false,
        tension: 0.1
      };

      const lowerDataset = {
        backgroundColor: scenario.color + '20',
        borderWidth: 0,
        data: scenario.data.map((p) => ({
          x: new Date(p.date).getTime(),
          y: p.lower_bound ?? p.value
        })),
        fill: false,
        label: `${scenario.label} Lower`,
        pointRadius: 0,
        showInLegend: false,
        tension: 0.1
      };

      return [bandDataset, lowerDataset, lineDataset];
    });

    const currency = this.currency;

    this.chart = new Chart(ctx, {
      data: {
        datasets: [historicalDataset, ...scenarioDatasets] as any
      },
      options: {
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            labels: {
              filter: (item) =>
                !item.text.includes('Band') && !item.text.includes('Lower')
            },
            position: 'top'
          },
          title: {
            display: !!this.symbol,
            text: `${this.symbol} — Price Forecast`
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (
                  ctx.dataset.label?.includes('Band') ||
                  ctx.dataset.label?.includes('Lower')
                ) {
                  return '';
                }
                const value = new Intl.NumberFormat('de-DE', {
                  currency,
                  style: 'currency'
                }).format(ctx.parsed.y);
                return `${ctx.dataset.label}: ${value}`;
              }
            },
            filter: (item) =>
              !item.dataset.label?.includes('Band') &&
              !item.dataset.label?.includes('Lower')
          }
        },
        responsive: true,
        scales: {
          x: {
            adapters: {
              date: { locale: de }
            },
            time: {
              displayFormats: {
                day: 'dd.MM.yy',
                month: 'MM.yyyy',
                week: 'dd.MM.yy'
              },
              unit: 'day'
            },
            type: 'time'
          },
          y: {
            ticks: {
              callback: (value) =>
                new Intl.NumberFormat('de-DE', {
                  currency,
                  maximumFractionDigits: 0,
                  style: 'currency'
                }).format(value as number)
            }
          }
        }
      },
      type: 'line'
    });
  }
}
