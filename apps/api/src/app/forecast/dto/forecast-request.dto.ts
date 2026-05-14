// apps/api/src/app/forecast/dto/forecast-request.dto.ts
import { IsIn, IsString, Length, Matches } from 'class-validator';

export class ForecastRequestDto {
  @IsString()
  @Length(12, 12)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, {
    message: 'ISIN must be a valid 12-character ISIN code'
  })
  public isin: string;

  @IsString()
  @IsIn(['1mo', '3mo', '6mo', '1y', '2y', '5y'])
  public historicalRange: string;

  @IsString()
  @IsIn(['1w', '2w', '1mo', '3mo', '6mo', '1y'])
  public forecastHorizon: string;
}
