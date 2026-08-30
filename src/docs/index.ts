import { Application, Request, Response } from 'express';
import { openapiSpec } from './openapi-spec';
import { docsAuthMiddleware } from './docs-auth';
import { logger } from '../core/logger';

function renderSwaggerHtml(spec: any): string {
  const specJson = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sohopathi API Documentation (Private)</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://img.icons8.com/color/96/graduation-cap.png" />
  <style>
    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .swagger-ui .topbar {
      background-color: #0f172a;
      border-bottom: 2px solid #3b82f6;
    }
    .swagger-ui .topbar .topbar-wrapper img {
      content: url('https://img.icons8.com/color/96/graduation-cap.png');
      height: 40px;
    }
    .swagger-ui .btn.authorize {
      background-color: #2563eb;
      border-color: #2563eb;
      color: #ffffff;
    }
    .swagger-ui .btn.authorize svg {
      fill: #ffffff;
    }
    .swagger-ui .info {
      margin: 24px 0;
    }
    .swagger-ui .info .title {
      color: #0f172a;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${specJson};
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Mounts private Swagger UI and OpenAPI JSON endpoints onto the Express app.
 * Fully compatible with serverless environments (Vercel, Netlify, AWS Lambda) and local servers.
 * Protected by Basic Authentication matching DOCS_USER and DOCS_PASSWORD.
 */
export function mountDocs(app: Application): void {
  // 1. Raw OpenAPI Specification JSON (Basic Auth Protected)
  const specHandler = (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpec);
  };

  app.get('/docs/swagger.json', docsAuthMiddleware, specHandler);
  app.get('/api/docs/swagger.json', docsAuthMiddleware, specHandler);

  // 2. Swagger UI Standalone HTML (Basic Auth Protected)
  const htmlHandler = (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderSwaggerHtml(openapiSpec));
  };

  app.get('/docs', docsAuthMiddleware, htmlHandler);
  app.get('/docs/*', docsAuthMiddleware, htmlHandler);
  app.get('/api/docs', docsAuthMiddleware, htmlHandler);
  app.get('/api/docs/*', docsAuthMiddleware, htmlHandler);

  logger.info('[docs] Private Swagger documentation mounted at /docs and /api/docs (Basic Auth Protected)');
}

export { openapiSpec, docsAuthMiddleware };
