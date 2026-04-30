import { createUploadHandlers } from "../_shared"

const handlers = createUploadHandlers("extensao")

export const GET = handlers.GET
export const POST = handlers.POST
export const DELETE = handlers.DELETE
