import axios from 'axios'
import { catchError, tap } from 'rxjs'

export interface ChronycleOptions {
	apiKey: string
	chronycleUrl?: string
	endpoints?: string[]
	exclude?: string[]
	sampleRate?: number
	timeout?: number
	silent?: boolean
	disableSmartFiltering?: boolean // Disable smart filtering for static files
}

export interface RequestData {
	method: string
	endpoint: string
	headers: Record<string, any>
	queryParams: Record<string, any>
	requestBody: any
	duration: number
	statusCode: number
	responseHeaders: Record<string, any>
	responseBody: any
}

// Universal middleware factory
export function chronycleRecorder(options: ChronycleOptions) {
	return (req: any, res: any, next: any) => {
		const startTime = Date.now()

		// Normalize request data across frameworks
		const requestData = normalizeRequest(req)

		// Apply filters
		if (!shouldRecord(requestData.endpoint, options)) {
			return next()
		}

		// Capture response
		interceptResponse(res, requestData, startTime, options)

		next()
	}
}

// Express-specific middleware
function expressRecorder(options: ChronycleOptions) {
	return (req: any, res: any, next: any) => {
		const startTime = Date.now()

		const requestData = {
			method: req.method,
			endpoint: getFullUrl(req),
			headers: req.headers,
			queryParams: req.query,
			requestBody: req.body,
		}

		if (!shouldRecord(requestData.endpoint, options)) {
			return next()
		}

		// Capture response
		const originalSend = res.send
		res.send = function (data: any) {
			const duration = Date.now() - startTime

			recordRequest(
				{
					...requestData,
					duration,
					statusCode: res.statusCode,
					responseHeaders: res.getHeaders(),
					responseBody: data,
				},
				options
			)

			return originalSend.call(this, data)
		}

		next()
	}
}

// Fastify-specific middleware
function fastifyRecorder(options: ChronycleOptions) {
	return async (request: any, reply: any) => {
		const startTime = Date.now()

		const requestData = {
			method: request.method,
			endpoint: getFullUrl(request),
			headers: request.headers,
			queryParams: request.query,
			requestBody: request.body,
		}

		if (!shouldRecord(requestData.endpoint, options)) {
			return
		}

		// Hook into response
		reply.addHook('onSend', async (request: any, reply: any, payload: any) => {
			const duration = Date.now() - startTime

			recordRequest(
				{
					...requestData,
					duration,
					statusCode: reply.statusCode,
					responseHeaders: reply.getHeaders(),
					responseBody: payload,
				},
				options
			)

			return payload
		})
	}
}

export function nestjsRecorder(options: ChronycleOptions) {
	return (req: any, res: any, next: any) => {
		const startTime = Date.now()

		const requestData = {
			method: req.method,
			endpoint: getFullUrl(req),
			headers: req.headers,
			queryParams: req.query,
			requestBody: req.body,
		}

		if (!shouldRecord(requestData.endpoint, options)) {
			return next()
		}

		// Capture response using NestJS interceptor pattern
		const originalSend = res.send
		const originalJson = res.json

		res.send = function (data: any) {
			const duration = Date.now() - startTime

			recordRequest(
				{
					...requestData,
					duration,
					statusCode: res.statusCode,
					responseHeaders: res.getHeaders(),
					responseBody: data,
				},
				options
			)

			return originalSend.call(this, data)
		}

		res.json = function (data: any) {
			const duration = Date.now() - startTime

			recordRequest(
				{
					...requestData,
					duration,
					statusCode: res.statusCode,
					responseHeaders: res.getHeaders(),
					responseBody: data,
				},
				options
			)

			return originalJson.call(this, data)
		}

		next()
	}
}

// NestJS Interceptor (more idiomatic)
export interface NestJSInterceptor {
	intercept(context: any, next: any): any
}

export function createNestJSInterceptor(
	options: ChronycleOptions
): NestJSInterceptor {
	return {
		intercept(context: any, next: any) {
			const startTime = Date.now()
			const request = context.switchToHttp().getRequest()
			const response = context.switchToHttp().getResponse()

			const requestData = {
				method: request.method,
				endpoint: request.originalUrl || request.url,
				headers: request.headers,
				queryParams: request.query,
				requestBody: request.body,
			}

			if (!shouldRecord(requestData.endpoint, options)) {
				return next.handle()
			}

			return next.handle().pipe(
				// Using RxJS operators (common in NestJS)
				tap((data: any) => {
					const duration = Date.now() - startTime

					recordRequest(
						{
							...requestData,
							duration,
							statusCode: response.statusCode,
							responseHeaders: response.getHeaders(),
							responseBody: data,
						},
						options
					)
				}),
				catchError((error: any) => {
					const duration = Date.now() - startTime

					recordRequest(
						{
							...requestData,
							duration,
							statusCode: error.status || 500,
							responseHeaders: response.getHeaders(),
							responseBody: error.message || 'Internal Server Error',
						},
						options
					)

					throw error
				})
			)
		},
	}
}

// NestJS Guard (for specific endpoints)
export function createNestJSGuard(options: ChronycleOptions) {
	return class ChronycleGuard {
		canActivate(context: any): boolean {
			const request = context.switchToHttp().getRequest()
			const endpoint = request.originalUrl || request.url

			// Only record if endpoint matches criteria
			if (shouldRecord(endpoint, options)) {
				// Store start time for later use
				request.chronycleStartTime = Date.now()
				request.chronycleOptions = options
			}

			return true // Always allow access
		}
	}
}

// Koa-specific middleware
function koaRecorder(options: ChronycleOptions) {
	return async (ctx: any, next: any) => {
		const startTime = Date.now()

		const requestData = {
			method: ctx.method,
			endpoint: getFullUrl(ctx),
			headers: ctx.headers,
			queryParams: ctx.query,
			requestBody: ctx.request.body,
		}

		if (!shouldRecord(requestData.endpoint, options)) {
			return await next()
		}

		await next()

		const duration = Date.now() - startTime

		recordRequest(
			{
				...requestData,
				duration,
				statusCode: ctx.status,
				responseHeaders: ctx.response.headers,
				responseBody: ctx.body,
			},
			options
		)
	}
}

async function autoDetectFramework(options: ChronycleOptions) {
	// Try to detect the framework being used
	try {
		// Check for NestJS
		const nestjs = await import('@nestjs/core').catch(() => null)
		if (nestjs) {
			console.log('Chronycle: Detected NestJS framework')
			return nestjsRecorder(options)
		}
	} catch {}

	try {
		// Check for Express
		const express = await import('express').catch(() => null)
		if (express) {
			console.log('Chronycle: Detected Express framework')
			return expressRecorder(options)
		}
	} catch {}

	// try {
	// 	// Check for Fastify
	// 	const fastify = await import('fastify').catch(() => null)
	// 	if (fastify) {
	// 		console.log('Chronycle: Detected Fastify framework')
	// 		return fastifyRecorder(options)
	// 	}
	// } catch {}

	try {
		// Check for Koa
		const koa = await import('koa').catch(() => null)
		if (koa) {
			console.log('Chronycle: Detected Koa framework')
			return koaRecorder(options)
		}
	} catch {}

	// Default to universal middleware
	console.log('Chronycle: Using universal middleware')
	return chronycleRecorder(options)
}

// Alternative: Runtime detection based on request/response objects
export function detectFrameworkFromContext(
	req: any,
	res: any,
	options: ChronycleOptions
) {
	// NestJS detection (has specific properties)
	if (
		req &&
		res &&
		req.route &&
		typeof req.route.path === 'string' &&
		req.app &&
		req.app._router
	) {
		console.log('Chronycle: Detected NestJS framework from context')
		return nestjsRecorder(options)
	}

	// Express detection
	if (
		req &&
		res &&
		typeof res.send === 'function' &&
		req.originalUrl !== undefined
	) {
		console.log('Chronycle: Detected Express framework from context')
		return expressRecorder(options)
	}

	// Koa detection
	if (req && req.ctx && typeof req.ctx.body !== 'undefined') {
		console.log('Chronycle: Detected Koa framework from context')
		return koaRecorder(options)
	}

	// Fastify detection
	if (
		req &&
		res &&
		typeof res.send === 'function' &&
		req.routerPath !== undefined
	) {
		console.log('Chronycle: Detected Fastify framework from context')
		return fastifyRecorder(options)
	}

	// Default to universal middleware
	console.log('Chronycle: Using universal middleware')
	return chronycleRecorder(options)
}

// Process-based detection (checks global objects)
export function detectFrameworkFromProcess(options: ChronycleOptions) {
	// Check if NestJS is in the process
	if (typeof process !== 'undefined' && process.versions) {
		// Look for NestJS in loaded modules
		if (
			typeof (global as any).NestFactory !== 'undefined' ||
			(typeof module !== 'undefined' &&
				module.children?.some((m) => m.id.includes('@nestjs/core')))
		) {
			console.log('Chronycle: Detected NestJS framework from process')
			return nestjsRecorder(options)
		}

		// Look for Express in loaded modules
		if (
			typeof (global as any).Express !== 'undefined' ||
			(typeof module !== 'undefined' &&
				module.children?.some((m) => m.id.includes('express')))
		) {
			console.log('Chronycle: Detected Express framework from process')
			return expressRecorder(options)
		}

		// Look for Fastify in loaded modules
		if (
			typeof (global as any).Fastify !== 'undefined' ||
			(typeof module !== 'undefined' &&
				module.children?.some((m) => m.id.includes('fastify')))
		) {
			console.log('Chronycle: Detected Fastify framework from process')
			return fastifyRecorder(options)
		}

		// Look for Koa in loaded modules
		if (
			typeof (global as any).Koa !== 'undefined' ||
			(typeof module !== 'undefined' &&
				module.children?.some((m) => m.id.includes('koa')))
		) {
			console.log('Chronycle: Detected Koa framework from process')
			return koaRecorder(options)
		}
	}

	// Default to universal middleware
	console.log('Chronycle: Using universal middleware')
	return chronycleRecorder(options)
}

// Helper functions
function getFullUrl(req: any): string {
	console.log('getFullUrl called with req:', req)
	// Try to get the protocol
	const protocol =
		req.protocol ||
		(req.secure ? 'https' : 'http') ||
		(req.connection?.encrypted ? 'https' : 'http') ||
		'http'

	// Get the host
	const host =
		req.headers?.['x-forwarded-host'] ||
		req.get?.('host') ||
		req.headers?.host ||
		'localhost'

	// Get the path
	const path = req.originalUrl || req.url || '/'
	console.log('protocol: ', protocol)
	console.log('host: ', host)
	console.log('path: ', path)

	return `${protocol}://${host}${path}`
}

function normalizeRequest(req: any): any {
	console.log('Raw request:', req)
	return {
		method: req.method,
		endpoint: getFullUrl(req),
		headers: req.headers,
		queryParams: req.query || {},
		requestBody: req.body,
	}
}

function shouldRecord(endpoint: string, options: ChronycleOptions): boolean {
	// Sample rate check
	if (options.sampleRate && Math.random() > options.sampleRate) {
		return false
	}

	// Default excludes for common browser/tool requests that aren't real API endpoints
	const defaultExcludes = options.disableSmartFiltering
		? []
		: [
				'/.well-known', // Browser/tool discovery endpoints
				'/favicon.ico', // Browser favicon requests
				'/robots.txt', // SEO crawler files
				'/sitemap.xml', // SEO sitemap files
				'/apple-touch-icon', // iOS home screen icons
				'/manifest.json', // PWA manifest
				'/browserconfig.xml', // Windows tile configuration
				'/crossdomain.xml', // Flash cross-domain policy
				'/ads.txt', // Advertising related
				'/security.txt', // Security contact info
				'/humans.txt', // Human-readable credits
				'/service-worker.js', // Service worker files
				'/sw.js', // Service worker files (short name)
			]

	// Combine user excludes with default excludes
	const userExcludes = options.exclude || []
	const allExcludes = [...defaultExcludes, ...userExcludes]

	// Exclude list check - support both string includes and regex patterns
	if (
		allExcludes.some((pattern) => {
			if (typeof pattern === 'string') {
				return endpoint.includes(pattern) || endpoint.startsWith(pattern)
			}
			return endpoint.match(new RegExp(pattern))
		})
	) {
		return false
	}

	// Additional smart filtering: exclude static file extensions
	const staticFileExtensions = options.disableSmartFiltering
		? []
		: [
				'.css',
				'.js',
				'.png',
				'.jpg',
				'.jpeg',
				'.gif',
				'.svg',
				'.ico',
				'.woff',
				'.woff2',
				'.ttf',
				'.eot',
				'.map',
				'.webp',
				'.avif',
			]

	if (staticFileExtensions.some((ext) => endpoint.toLowerCase().endsWith(ext))) {
		return false
	}

	// Endpoints whitelist check
	if (options.endpoints && options.endpoints.length > 0) {
		return options.endpoints.some((pattern) => {
			if (typeof pattern === 'string') {
				return endpoint.includes(pattern) || endpoint.startsWith(pattern)
			}
			return endpoint.match(new RegExp(pattern))
		})
	}

	return true
}

function interceptResponse(
	res: any,
	requestData: any,
	startTime: number,
	options: ChronycleOptions
) {
	const originalSend = res.send || res.end

	res.send = res.end = function (data: any) {
		const duration = Date.now() - startTime

		recordRequest(
			{
				...requestData,
				duration,
				statusCode: res.statusCode,
				responseHeaders: res.getHeaders ? res.getHeaders() : {},
				responseBody: data,
			},
			options
		)

		return originalSend.call(this, data)
	}
}

const CHRONYCLE_API_URL = 'https://chronycle-api.onrender.com'
const RECORD_ENDPOINT = '/api/v1/recording'

async function recordRequest(
	requestData: RequestData,
	options: ChronycleOptions
) {
	try {
		await axios.post(`${CHRONYCLE_API_URL}${RECORD_ENDPOINT}`, requestData, {
			headers: {
				'x-api-key': options.apiKey,
				'Content-Type': 'application/json',
			},
			timeout: options.timeout || 5000,
		})
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(message)
		if (!options.silent) {
			console.warn('Chronycle recording failed:', message)
		}
	}
}

// Export everything
export {
	chronycleRecorder as default,
	expressRecorder,
	fastifyRecorder,
	koaRecorder,
	autoDetectFramework,
}

// Usage examples:
/*
// Auto-detect framework
app.use(autoDetectFramework({
  apiKey: 'your-api-key',
  chronycleUrl: 'https://your-api.com',
}));

// Express-specific
app.use(expressRecorder({
  apiKey: 'your-api-key',
  chronycleUrl: 'https://your-api.com',
  sampleRate: 0.1,
  exclude: ['/health', '/metrics'],
}));

// Fastify-specific
fastify.addHook('preHandler', fastifyRecorder({
  apiKey: 'your-api-key',
  chronycleUrl: 'https://your-api.com',
}));
*/
