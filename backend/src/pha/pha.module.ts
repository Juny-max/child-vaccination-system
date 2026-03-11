import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PhaController } from './pha.controller';
import { PhaService } from './pha.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PhaController],
  providers: [PhaService],
})
export class PhaModule {}
