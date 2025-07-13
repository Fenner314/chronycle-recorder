# Chronycle Recorder

Universal middleware for recording API requests across Node.js frameworks. Seamlessly capture, analyze, and replay HTTP requests for debugging, testing, and monitoring.

## Features

- Universal Middleware - Works with Express, NestJS, Fastify, and Koa
- Automatic Request Recording - Captures method, headers, body, response, and timing
- Smart Filtering - Automatically excludes static files and browser requests
- Configurable - Filter endpoints, set sampling rates, and customize behavior
- Full URL Capture - Handles port forwarding and proxy headers correctly
- Zero Dependencies - Lightweight with minimal overhead

## Installation

```
npm install chronycle-recorder
```

## Quick Start

### Express

```
const express = require('express');
const { expressRecorder } = require('chronycle-recorder');
const app = express();
app.use(expressRecorder({
apiKey: 'your-api-key',
chronycleUrl: 'https://your-chronycle-api.com',
}));
app.get('/api/users', (req, res) => {
res.json({ users: [] });
});
app.listen(3000);
```

### NestJS

```
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { nestjsRecorder } from 'chronycle-recorder';
async function bootstrap() {
const app = await NestFactory.create(AppModule);
app.use(nestjsRecorder({
apiKey: 'your-api-key',
sampleRate: 1.0,
exclude: ['/health', '/metrics'],
}));
await app.listen(3000);
}
bootstrap();
```

### Fastify

```
const fastify = require('fastify')();
const { fastifyRecorder } = require('chronycle-recorder');
fastify.addHook('preHandler', fastifyRecorder({
apiKey: 'your-api-key',
endpoints: ['/api/'], // Only record API endpoints
}));
fastify.get('/api/data', async (request, reply) => {
return { data: 'example' };
});
fastify.listen({ port: 3000 });
```

### Koa

```
const Koa = require('koa');
const { koaRecorder } = require('chronycle-recorder');
const app = new Koa();
app.use(koaRecorder({
apiKey: 'your-api-key',
timeout: 10000,
}));
app.use(async ctx => {
ctx.body = { message: 'Hello World' };
});
app.listen(3000);
```

## Configuration Options

| Option       | Type     | Default                            | Description                                       |
| ------------ | -------- | ---------------------------------- | ------------------------------------------------- |
| apiKey       | string   | Required                           | Your Chronycle API key                            |
| chronycleUrl | string   | https://chronycle-api.onrender.com | Chronycle API endpoint                            |
| endpoints    | string[] | undefined                          | Whitelist of endpoints to record (supports regex) |
| exclude      | string[] | []                                 | Endpoints to exclude from recording               |
| sampleRate   | number   | 1.0                                | Sampling rate (0.0 to 1.0)                        |
| timeout      | number   | 5000                               | Request timeout in milliseconds                   |
| silent       | boolean  | false                              | Suppress error logs                               |

## Advanced Usage

### Auto-Detection

The package can automatically detect your framework:

```
const { default: chronycleRecorder } = require('chronycle-recorder');
app.use(chronycleRecorder({
apiKey: 'your-api-key',
sampleRate: 0.1, // Record 10% of requests
}));
```

### NestJS Interceptor

For more control in NestJS applications:

```
import { createNestJSInterceptor } from 'chronycle-recorder';
@Controller('api')
@UseInterceptors(createNestJSInterceptor({
apiKey: 'your-api-key',
endpoints: ['/api/critical'],
}))
export class ApiController {
// Your controller methods
}
```

### Filtering Examples

```
// Record only API endpoints
app.use(expressRecorder({
apiKey: 'your-api-key',
endpoints: ['/api/', '/v1/'],
}));
// Exclude health checks and metrics
app.use(expressRecorder({
apiKey: 'your-api-key',
exclude: ['/health', '/metrics', '/status'],
}));
// Sample 25% of requests
app.use(expressRecorder({
apiKey: 'your-api-key',
sampleRate: 0.25,
}));
// Use regex patterns
app.use(expressRecorder({
apiKey: 'your-api-key',
endpoints: ['^/api/v[0-9]+/'],
exclude: ['\.(css|js|png|jpg|ico)$'],
}));
```

## What Gets Recorded

Each request capture includes:

```
{
method: 'GET',
endpoint: 'https://api.example.com/users',
headers: { /* request headers / },
queryParams: { / query parameters / },
requestBody: { / request body / },
duration: 150, // milliseconds
statusCode: 200,
responseHeaders: { / response headers / },
responseBody: { / response body */ }
}
```

## Smart Filtering

The package automatically excludes common non-API requests:

- Browser requests (.well-known, favicon.ico, robots.txt)
- Static files (.css, .js, .png, .jpg, etc.)
- Security files (security.txt, ads.txt)
- PWA files (manifest.json, service-worker.js)

## Framework Support

| Framework | Support     | Method                                        |
| --------- | ----------- | --------------------------------------------- |
| Express   | Full        | expressRecorder()                             |
| NestJS    | Full        | nestjsRecorder() or createNestJSInterceptor() |
| Fastify   | Full        | fastifyRecorder()                             |
| Koa       | Full        | koaRecorder()                                 |
| Universal | Auto-detect | chronycleRecorder()                           |

## Error Handling

The package is designed to fail silently to avoid disrupting your application:

```
app.use(expressRecorder({
apiKey: 'your-api-key',
silent: true, // Suppress error logs
timeout: 3000, // Lower timeout for faster failures
}));
```

## Environment Variables

You can also configure using environment variables:

```
CHRONYCLE_API_KEY=your-api-key
CHRONYCLE_URL=https://your-chronycle-api.com
CHRONYCLE_SAMPLE_RATE=0.1

app.use(expressRecorder({
apiKey: process.env.CHRONYCLE_API_KEY,
chronycleUrl: process.env.CHRONYCLE_URL,
sampleRate: parseFloat(process.env.CHRONYCLE_SAMPLE_RATE) || 1.0,
}));
```

## TypeScript Support

Full TypeScript support with type definitions:

```
import { ChronycleOptions, expressRecorder } from 'chronycle-recorder';
const options: ChronycleOptions = {
apiKey: 'your-api-key',
sampleRate: 0.5,
exclude: ['/health'],
};
app.use(expressRecorder(options));
```

## Performance Considerations

- Async Recording: Requests are recorded asynchronously without blocking your API
- Sampling: Use sampleRate to reduce overhead in high-traffic applications
- Filtering: Use endpoints whitelist for better performance than exclude blacklist
- Timeout: Set appropriate timeout values to prevent hanging requests

## Examples

Check out the examples directory for complete working examples:

- Express Example (./examples/express/)
- NestJS Example (./examples/nestjs/)
- Fastify Example (./examples/fastify/)
- Koa Example (./examples/koa/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

- Email: support@chronycle.com
- Issues: GitHub Issues
- Documentation: Chronycle Docs

---
