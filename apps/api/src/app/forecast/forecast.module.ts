// apps/api/src/app/forecast/forecast.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';

@Module({
  controllers: [ForecastController],
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 120000, // 2 minutes — TimesFM can be slow on first load
      maxRedirects: 3
    })
  ],
  providers: [ForecastService]
})
export class ForecastModule {}
