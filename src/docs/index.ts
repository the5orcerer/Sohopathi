import { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './openapi-spec';
import { docsAuthMiddleware } from './docs-auth';
import { logger } from '../core/logger';

const customCss = `
  .swagger-ui .topbar {
    background-color: #0f172a;
    border-bottom: 2px solid #3b82f6;
  }
  .swagger-ui .topbar .topbar-wrapper img {
    content: url('https://img.icons8.com/color/96/graduation-cap.png');
    height: 40px;
  }
  .swagger-ui .info {
    margin: 20px 0;
  }
  .swagger-ui .info .title {
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .swagger-ui .btn.authorize {
    background-color: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
  }
  .swagger-ui .btn.authorize svg {
    fill: #ffffff;
  }
`;

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'Sohopathi API Documentation (Private)',
  customCss,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
};

/**
 * Mounts private Swagger UI and OpenAPI JSON endpoints onto the Express app.
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

  // 2. Swagger UI HTML & Assets (Basic Auth Protected)
  app.use('/docs', docsAuthMiddleware, swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));
  app.use('/api/docs', docsAuthMiddleware, swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));

  logger.info('[docs] Private Swagger documentation mounted at /docs and /api/docs (Basic Auth Protected)');
}

export { openapiSpec, docsAuthMiddleware };

