import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsIn, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class SnapshotItemDto {
  @IsString()
  id!: string

  @IsString()
  documentId!: string

  @IsString()
  yjsState!: string // base64 encoded

  @IsString()
  plainText!: string

  @IsNumber()
  timestamp!: number

  @IsIn(['auto', 'manual', 'ai_edit', 'collab_join', 'restore'])
  trigger!: 'auto' | 'manual' | 'ai_edit' | 'collab_join' | 'restore'

  @IsOptional()
  @IsString()
  summary?: string

  @IsNumber()
  wordCount!: number

  @IsOptional()
  @IsNumber()
  diffAdded?: number

  @IsOptional()
  @IsNumber()
  diffRemoved?: number
}

export class SyncSnapshotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnapshotItemDto)
  snapshots!: SnapshotItemDto[]
}

export class GetSnapshotsQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number
}

export class GetSnapshotsRangeQueryDto {
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  start!: number

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  end!: number
}
