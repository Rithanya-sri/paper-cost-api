var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-c90ugt/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-c90ugt/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };
    if (path === "/api/paper-cost" || path === "/") {
      return new Response(JSON.stringify({ success: true, message: "Paper cost API working \u2705" }), {
        headers: corsHeaders
      });
    }
    if (path.startsWith("/api/production")) {
      const parts = path.split("/").filter(Boolean);
      const id = parts[2] || null;
      try {
        if (method === "GET") {
          if (id) {
            const result = await env.DB.prepare(
              "SELECT * FROM daily_production_records WHERE id = ?"
            ).bind(id).first();
            if (!result) {
              return new Response(JSON.stringify({ error: "Record not found" }), {
                status: 404,
                headers: corsHeaders
              });
            }
            return new Response(JSON.stringify(result), { headers: corsHeaders });
          } else {
            const result = await env.DB.prepare(
              "SELECT * FROM daily_production_records ORDER BY date DESC"
            ).all();
            return new Response(JSON.stringify(result.results), { headers: corsHeaders });
          }
        }
        if (method === "POST") {
          const data = await request.json();
          const calculated = calculateRecord(data);
          const result = await env.DB.prepare(`
                        INSERT INTO daily_production_records (
                            date, production, outdone,
                            paper_quantity_kg, paper_rate, paper_cost, paper_cost_per_tube,
                            paste_quantity, paste_rate, paste_cost, paste_cost_per_tube,
                            outer_paste_quantity, outer_paste_rate, outer_paste_cost, outer_paste_cost_per_tube,
                            packing_quantity, packing_rate, packing_cost, packing_cost_per_tube,
                            labour_count, labour_wage, labour_cost, labour_cost_per_tube,
                            eb_units, eb_amount, eb_cost_per_tube,
                            overheads_amount, overheads_cost_per_tube,
                            food_amount, food_cost_per_tube,
                            grand_total_cost_per_tube
                        ) VALUES (
                            ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?,
                            ?, ?,
                            ?, ?,
                            ?
                        )
                    `).bind(
            calculated.date,
            calculated.production,
            calculated.outdone,
            calculated.paper_quantity_kg,
            calculated.paper_rate,
            calculated.paper_cost,
            calculated.paper_cost_per_tube,
            calculated.paste_quantity,
            calculated.paste_rate,
            calculated.paste_cost,
            calculated.paste_cost_per_tube,
            calculated.outer_paste_quantity,
            calculated.outer_paste_rate,
            calculated.outer_paste_cost,
            calculated.outer_paste_cost_per_tube,
            calculated.packing_quantity,
            calculated.packing_rate,
            calculated.packing_cost,
            calculated.packing_cost_per_tube,
            calculated.labour_count,
            calculated.labour_wage,
            calculated.labour_cost,
            calculated.labour_cost_per_tube,
            calculated.eb_units,
            calculated.eb_amount,
            calculated.eb_cost_per_tube,
            calculated.overheads_amount,
            calculated.overheads_cost_per_tube,
            calculated.food_amount,
            calculated.food_cost_per_tube,
            calculated.grand_total_cost_per_tube
          ).run();
          return new Response(JSON.stringify({
            success: true,
            id: result.meta.last_row_id,
            ...calculated
          }), {
            status: 201,
            headers: corsHeaders
          });
        }
        if (method === "PUT" && id) {
          const data = await request.json();
          const calculated = calculateRecord(data);
          await env.DB.prepare(`
                        UPDATE daily_production_records SET
                            date = ?, production = ?, outdone = ?,
                            paper_quantity_kg = ?, paper_rate = ?, paper_cost = ?, paper_cost_per_tube = ?,
                            paste_quantity = ?, paste_rate = ?, paste_cost = ?, paste_cost_per_tube = ?,
                            outer_paste_quantity = ?, outer_paste_rate = ?, outer_paste_cost = ?, outer_paste_cost_per_tube = ?,
                            packing_quantity = ?, packing_rate = ?, packing_cost = ?, packing_cost_per_tube = ?,
                            labour_count = ?, labour_wage = ?, labour_cost = ?, labour_cost_per_tube = ?,
                            eb_units = ?, eb_amount = ?, eb_cost_per_tube = ?,
                            overheads_amount = ?, overheads_cost_per_tube = ?,
                            food_amount = ?, food_cost_per_tube = ?,
                            grand_total_cost_per_tube = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(
            calculated.date,
            calculated.production,
            calculated.outdone,
            calculated.paper_quantity_kg,
            calculated.paper_rate,
            calculated.paper_cost,
            calculated.paper_cost_per_tube,
            calculated.paste_quantity,
            calculated.paste_rate,
            calculated.paste_cost,
            calculated.paste_cost_per_tube,
            calculated.outer_paste_quantity,
            calculated.outer_paste_rate,
            calculated.outer_paste_cost,
            calculated.outer_paste_cost_per_tube,
            calculated.packing_quantity,
            calculated.packing_rate,
            calculated.packing_cost,
            calculated.packing_cost_per_tube,
            calculated.labour_count,
            calculated.labour_wage,
            calculated.labour_cost,
            calculated.labour_cost_per_tube,
            calculated.eb_units,
            calculated.eb_amount,
            calculated.eb_cost_per_tube,
            calculated.overheads_amount,
            calculated.overheads_cost_per_tube,
            calculated.food_amount,
            calculated.food_cost_per_tube,
            calculated.grand_total_cost_per_tube,
            id
          ).run();
          return new Response(JSON.stringify({ success: true, ...calculated }), { headers: corsHeaders });
        }
        if (method === "DELETE" && id) {
          await env.DB.prepare(
            "DELETE FROM daily_production_records WHERE id = ?"
          ).bind(id).run();
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
function calculateRecord(data) {
  const { production } = data;
  const safeDivide = /* @__PURE__ */ __name((num, den) => {
    if (den === 0)
      return 0;
    return Math.round(num / den * 100) / 100;
  }, "safeDivide");
  const round = /* @__PURE__ */ __name((num) => Math.round(num * 100) / 100, "round");
  const paper_cost = round(data.paper_quantity_kg * data.paper_rate);
  const paper_cost_per_tube = safeDivide(paper_cost, production);
  const paste_cost = round(data.paste_quantity * data.paste_rate);
  const paste_cost_per_tube = safeDivide(paste_cost, production);
  const outer_paste_cost = round(data.outer_paste_quantity * data.outer_paste_rate);
  const outer_paste_cost_per_tube = safeDivide(outer_paste_cost, production);
  const packing_cost = round(data.packing_quantity * data.packing_rate);
  const packing_cost_per_tube = safeDivide(packing_cost, production);
  const labour_cost = round(data.labour_count * data.labour_wage);
  const labour_cost_per_tube = safeDivide(labour_cost, production);
  const eb_cost_per_tube = safeDivide(data.eb_amount, production);
  const overheads_cost_per_tube = safeDivide(data.overheads_amount, production);
  const food_cost_per_tube = safeDivide(data.food_amount, production);
  const grand_total_cost_per_tube = round(
    paper_cost_per_tube + paste_cost_per_tube + outer_paste_cost_per_tube + packing_cost_per_tube + labour_cost_per_tube + eb_cost_per_tube + overheads_cost_per_tube + food_cost_per_tube
  );
  return {
    ...data,
    paper_cost,
    paper_cost_per_tube,
    paste_cost,
    paste_cost_per_tube,
    outer_paste_cost,
    outer_paste_cost_per_tube,
    packing_cost,
    packing_cost_per_tube,
    labour_cost,
    labour_cost_per_tube,
    eb_cost_per_tube,
    overheads_cost_per_tube,
    food_cost_per_tube,
    grand_total_cost_per_tube
  };
}
__name(calculateRecord, "calculateRecord");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-c90ugt/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-c90ugt/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
