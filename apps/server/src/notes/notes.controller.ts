import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common'
import { NotesService, CreateNoteDto } from './notes.service'

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /**
   * Extract a note and queue for AI classification
   * POST /notes/extract
   */
  @Post('extract')
  async extractNote(@Body() dto: CreateNoteDto) {
    return this.notesService.createNote(dto)
  }

  /**
   * Get all topics for a user
   * GET /notes/topics?userId=xxx
   */
  @Get('topics')
  async getTopics(@Query('userId') userId: string) {
    if (!userId) {
      return { error: 'userId is required', topics: [] }
    }
    const topics = await this.notesService.getTopics(userId)
    return { topics }
  }

  /**
   * Get all notes for a specific topic
   * GET /notes/topics/:topicId/notes
   */
  @Get('topics/:topicId/notes')
  async getTopicNotes(@Param('topicId') topicId: string) {
    const notes = await this.notesService.getTopicNotes(topicId)
    return { notes }
  }

  /**
   * Get pending/processing notes for a user
   * GET /notes/pending?userId=xxx
   */
  @Get('pending')
  async getPendingNotes(@Query('userId') userId: string) {
    if (!userId) {
      return { error: 'userId is required', notes: [] }
    }
    const notes = await this.notesService.getPendingNotes(userId)
    return { notes }
  }
}
