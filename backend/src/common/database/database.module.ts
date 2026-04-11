import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { QrTokenService } from '../qr-token.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, QrTokenService],
  exports: [DatabaseService, QrTokenService],
})
export class DatabaseModule {}
