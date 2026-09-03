import { NextResponse, type NextRequest } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { isAuthApiError } from '@supabase/supabase-js'
import { z, ZodError, type ZodIssue } from 'zod'
import type { ApiFailure, ApiSuccess } from '@/types/api'

export class ApiError extends Error {
  status: number
  issues?: ZodIssue[]
  constructor(status: number, message: string, issues?: ZodIssue[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>({ data }, init)
}

export function fail(message: string, status: number, issues?: ZodIssue[]): NextResponse<ApiFailure> {
  const body: ApiFailure = { error: issues ? { message, issues } : { message } }
  return NextResponse.json<ApiFailure>(body, { status })
}

/** JSON body → schema. Invalid JSON → 400; schema failure → 422 with issues. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const result = schema.safeParse(raw)
  if (!result.success) throw new ApiError(422, 'Validation failed', result.error.issues)
  return result.data
}

/** URLSearchParams → plain object (last value wins) → schema. Failure → 422 with issues. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const params = new URL(request.url).searchParams
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })
  const result = schema.safeParse(obj)
  if (!result.success) throw new ApiError(422, 'Validation failed', result.error.issues)
  return result.data
}

/** NOT "RouteContext": Next 15.5 declares a global of that name. */
export type HandlerContext<P = Record<string, string>> = { params: Promise<P> }
export type HandlerFn<P = Record<string, string>> = (
  request: NextRequest,
  ctx: HandlerContext<P>,
) => Promise<Response>

type PostgrestLikeError = { code: string; message: string }

function isPostgrestLikeError(e: unknown): e is PostgrestLikeError {
  if (typeof e !== 'object' || e === null) return false
  const rec = e as Record<string, unknown>
  return typeof rec.code === 'string' && typeof rec.message === 'string'
}

function failFromPostgrest(e: PostgrestLikeError): NextResponse<ApiFailure> {
  switch (e.code) {
    case '23505':
      return fail('Already exists', 409)
    case '23503':
      return fail('Invalid reference', 422)
    case 'PGRST116':
      return fail('Not found', 404)
    default:
      console.error('[api] postgrest error', e.code, e.message)
      return fail('Internal error', 500)
  }
}

export function withHandler<P = Record<string, string>>(fn: HandlerFn<P>): HandlerFn<P> {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx)
    } catch (e: unknown) {
      unstable_rethrow(e)
      if (e instanceof ApiError) return fail(e.message, e.status, e.issues)
      if (e instanceof ZodError) return fail('Validation failed', 422, e.issues)
      if (isAuthApiError(e)) return fail(e.message, e.status ?? 500)
      if (isPostgrestLikeError(e)) return failFromPostgrest(e)
      console.error('[api] unhandled error', e)
      return fail('Internal error', 500)
    }
  }
}
