declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  interface SwaggerUIOptions {
    url: string;
    dom_id: string;
    deepLinking?: boolean;
    persistAuthorization?: boolean;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    tryItOutEnabled?: boolean;
    presets?: unknown[];
  }
  interface SwaggerUIBundleStatic {
    (options: SwaggerUIOptions): unknown;
    presets: { apis: unknown };
    SwaggerUIStandalonePreset?: unknown;
  }
  const SwaggerUIBundle: SwaggerUIBundleStatic;
  export default SwaggerUIBundle;
}
