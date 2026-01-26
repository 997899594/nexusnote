import { IsString, IsOptional, IsNumber, Min, Max, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

export class IndexDocumentDto {
  @IsString()
  @MinLength(1)
  documentId!: string

  @IsString()
  @MinLength(20, { message: 'Text must be at least 20 characters for indexing' })
  plainText!: string
}

export class SearchQueryDto {
  @IsString()
  @MinLength(1, { message: 'Search query cannot be empty' })
  q!: string

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(50)
  topK?: number

  @IsOptional()
  @IsString()
  userId?: string
}
