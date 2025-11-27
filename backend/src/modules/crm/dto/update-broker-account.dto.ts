import { PartialType } from '@nestjs/swagger';
import { CreateBrokerAccountDto } from './create-broker-account.dto';

export class UpdateBrokerAccountDto extends PartialType(CreateBrokerAccountDto) {}