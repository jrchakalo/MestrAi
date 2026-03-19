import '@testing-library/jest-dom'

// Set up environment variables for tests
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
	process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-123'
}

// Mock ESM modules that Jest has trouble with
jest.mock('remark-gfm', () => ({
	default: {},
}))

if (typeof globalThis.TextEncoder === 'undefined') {
	const { TextEncoder, TextDecoder } = require('util')
	globalThis.TextEncoder = TextEncoder
	globalThis.TextDecoder = TextDecoder
}

if (typeof globalThis.ReadableStream === 'undefined') {
	const { ReadableStream, TransformStream } = require('stream/web')
	globalThis.ReadableStream = ReadableStream
	globalThis.TransformStream = TransformStream
}

if (typeof globalThis.MessagePort === 'undefined') {
	const { MessageChannel, MessagePort } = require('worker_threads')
	globalThis.MessageChannel = MessageChannel
	globalThis.MessagePort = MessagePort
}

if (typeof globalThis.fetch === 'undefined' || typeof globalThis.Request === 'undefined') {
	const { fetch, Headers, Request, Response } = require('undici')
	globalThis.fetch = fetch
	globalThis.Headers = Headers
	globalThis.Request = Request
	globalThis.Response = Response
}
