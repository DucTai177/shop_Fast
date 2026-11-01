import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiAgentController } from './ai-agent.controller.js';
import { AiAgentService } from './ai-agent.service.js';
import { TicketsService } from './tickets.service.js';
import { AiToolsService } from './tools/ai-tools.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AiAgentController],
  providers: [AiAgentService, TicketsService, AiToolsService],
  exports: [AiAgentService, TicketsService],
})
export class AiAgentModule {}
