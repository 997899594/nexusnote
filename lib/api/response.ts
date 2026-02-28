/**
 * 统一 API 响应工具函数
 */

import { NextResponse } from "next/server";

/**
 * 成功响应
 * @param data - 响应数据
 * @param status - HTTP 状态码，默认 200
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * 创建资源成功响应 (201)
 */
export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * 无内容响应 (204)
 * 用于 DELETE 操作成功后
 */
export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}

/**
 * 分页响应
 */
export function apiPaginated<T>(
  items: T[],
  pagination: { page: number; pageSize: number; total: number },
) {
  return NextResponse.json({
    items,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}
