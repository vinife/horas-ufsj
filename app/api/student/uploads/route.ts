import { createUploadHandlers } from "./_shared"

const handlers = createUploadHandlers("complementar")

export const GET = handlers.GET
export const POST = handlers.POST
