import type { Env } from "./env";

export type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string>,
) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
}

export class ApiRouter {
  private readonly routes: Route[] = [];

  add(method: string, pathname: string, handler: RouteHandler): this {
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new URLPattern({ pathname }),
      handler,
    });
    return this;
  }

  // GET is the only verb this read-only API uses; add() covers any future verb.
  get(p: string, h: RouteHandler) { return this.add("GET", p, h); }

  async dispatch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
    for (const route of this.routes) {
      if (route.method !== request.method.toUpperCase()) continue;
      const match = route.pattern.exec({ pathname: new URL(request.url).pathname });
      if (!match) continue;
      const params = match.pathname.groups as Record<string, string>;
      return await route.handler(request, env, ctx, params);
    }
    return null;
  }
}
