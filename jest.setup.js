import '@testing-library/jest-dom'

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
