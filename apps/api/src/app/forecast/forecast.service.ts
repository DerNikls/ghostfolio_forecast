// apps/api/src/app/forecast/forecast.service.ts
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ForecastRequestDto } from './dto/forecast-request.dto';

@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly timesfmServiceUrl: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.timesfmServiceUrl =
      this.configService.get<string>('TIMESFM_SERVICE_URL') ??
      'http://localhost:8001';
  }

  public async generateForecast(dto: ForecastRequestDto): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.timesfmServiceUrl}/api/forecast`, {
          forecast_horizon: dto.forecastHorizon,
          historical_range: dto.historicalRange,
          isin: dto.isin
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Forecast failed for ISIN ${dto.isin}: ${error?.message}`
      );

      // Forward a readable error message to the client
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Failed to generate forecast. Please try again.';

      throw new InternalServerErrorException(message);
    }
  }
}
