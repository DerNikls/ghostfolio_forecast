// apps/api/src/app/forecast/forecast.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ForecastRequestDto } from './dto/forecast-request.dto';
import { ForecastService } from './forecast.service';

@Controller('forecast')
export class ForecastController {
  public constructor(private readonly forecastService: ForecastService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  public async generateForecast(
    @Body() forecastRequestDto: ForecastRequestDto
  ): Promise<any> {
    return this.forecastService.generateForecast(forecastRequestDto);
  }
}
