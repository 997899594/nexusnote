import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common'
import { SnapshotService, SnapshotDTO } from './snapshot.service'

@Controller('snapshots')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  /**
   * 同步快照到服务器
   * POST /snapshots/sync
   */
  @Post('sync')
  async syncSnapshots(@Body() body: { snapshots: SnapshotDTO[] }) {
    await this.snapshotService.saveSnapshots(body.snapshots)
    return { success: true, count: body.snapshots.length }
  }

  /**
   * 获取文档的所有快照
   * GET /snapshots/:documentId
   */
  @Get(':documentId')
  async getSnapshots(
    @Param('documentId') documentId: string,
    @Query('limit') limit?: string
  ) {
    const snapshots = await this.snapshotService.getSnapshots(
      documentId,
      limit ? parseInt(limit, 10) : 100
    )
    return { snapshots }
  }

  /**
   * 获取指定快照
   * GET /snapshots/detail/:snapshotId
   */
  @Get('detail/:snapshotId')
  async getSnapshot(@Param('snapshotId') snapshotId: string) {
    const snapshot = await this.snapshotService.getSnapshot(snapshotId)
    if (!snapshot) {
      return { error: 'Snapshot not found' }
    }
    return { snapshot }
  }

  /**
   * 获取最新快照时间戳（用于增量同步）
   * GET /snapshots/:documentId/latest-timestamp
   */
  @Get(':documentId/latest-timestamp')
  async getLatestTimestamp(@Param('documentId') documentId: string) {
    const timestamp = await this.snapshotService.getLatestSnapshotTimestamp(documentId)
    return { timestamp }
  }

  /**
   * 获取时间范围内的快照
   * GET /snapshots/:documentId/range?start=xxx&end=xxx
   */
  @Get(':documentId/range')
  async getSnapshotsByRange(
    @Param('documentId') documentId: string,
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    const snapshots = await this.snapshotService.getSnapshotsByTimeRange(
      documentId,
      parseInt(start, 10),
      parseInt(end, 10)
    )
    return { snapshots }
  }

  /**
   * 删除快照
   * DELETE /snapshots/:snapshotId
   */
  @Delete(':snapshotId')
  async deleteSnapshot(@Param('snapshotId') snapshotId: string) {
    await this.snapshotService.deleteSnapshot(snapshotId)
    return { success: true }
  }
}
