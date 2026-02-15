export interface Env {
    DB: D1Database;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Handle CORS
        if (method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        };

        // Root path check
        if (path === "/api/paper-cost" || path === "/") {
            return new Response(JSON.stringify({ success: true, message: "Paper cost API working ✅" }), {
                headers: corsHeaders,
            });
        }

        // Production records route: /api/production/[[id]]
        if (path.startsWith("/api/production")) {
            const parts = path.split("/").filter(Boolean);
            const id = parts[2] || null; // /api/production/:id -> index 2

            try {
                if (method === 'GET') {
                    if (id) {
                        const result = await env.DB.prepare(
                            'SELECT * FROM daily_production_records WHERE id = ?'
                        ).bind(id).first();

                        if (!result) {
                            return new Response(JSON.stringify({ error: 'Record not found' }), {
                                status: 404,
                                headers: corsHeaders,
                            });
                        }
                        return new Response(JSON.stringify(result), { headers: corsHeaders });
                    } else {
                        const result = await env.DB.prepare(
                            'SELECT * FROM daily_production_records ORDER BY date DESC'
                        ).all();
                        return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                    }
                }

                if (method === 'POST') {
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
                        calculated.date, calculated.production, calculated.outdone,
                        calculated.paper_quantity_kg, calculated.paper_rate, calculated.paper_cost, calculated.paper_cost_per_tube,
                        calculated.paste_quantity, calculated.paste_rate, calculated.paste_cost, calculated.paste_cost_per_tube,
                        calculated.outer_paste_quantity, calculated.outer_paste_rate, calculated.outer_paste_cost, calculated.outer_paste_cost_per_tube,
                        calculated.packing_quantity, calculated.packing_rate, calculated.packing_cost, calculated.packing_cost_per_tube,
                        calculated.labour_count, calculated.labour_wage, calculated.labour_cost, calculated.labour_cost_per_tube,
                        calculated.eb_units, calculated.eb_amount, calculated.eb_cost_per_tube,
                        calculated.overheads_amount, calculated.overheads_cost_per_tube,
                        calculated.food_amount, calculated.food_cost_per_tube,
                        calculated.grand_total_cost_per_tube
                    ).run();

                    return new Response(JSON.stringify({
                        success: true,
                        id: result.meta.last_row_id,
                        ...calculated
                    }), {
                        status: 201,
                        headers: corsHeaders,
                    });
                }

                if (method === 'PUT' && id) {
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
                        calculated.date, calculated.production, calculated.outdone,
                        calculated.paper_quantity_kg, calculated.paper_rate, calculated.paper_cost, calculated.paper_cost_per_tube,
                        calculated.paste_quantity, calculated.paste_rate, calculated.paste_cost, calculated.paste_cost_per_tube,
                        calculated.outer_paste_quantity, calculated.outer_paste_rate, calculated.outer_paste_cost, calculated.outer_paste_cost_per_tube,
                        calculated.packing_quantity, calculated.packing_rate, calculated.packing_cost, calculated.packing_cost_per_tube,
                        calculated.labour_count, calculated.labour_wage, calculated.labour_cost, calculated.labour_cost_per_tube,
                        calculated.eb_units, calculated.eb_amount, calculated.eb_cost_per_tube,
                        calculated.overheads_amount, calculated.overheads_cost_per_tube,
                        calculated.food_amount, calculated.food_cost_per_tube,
                        calculated.grand_total_cost_per_tube,
                        id
                    ).run();

                    return new Response(JSON.stringify({ success: true, ...calculated }), { headers: corsHeaders });
                }

                if (method === 'DELETE' && id) {
                    await env.DB.prepare(
                        'DELETE FROM daily_production_records WHERE id = ?'
                    ).bind(id).run();

                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: corsHeaders,
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: corsHeaders,
        });
    }
};

// Helper to calculate all values
function calculateRecord(data: any) {
    const { production } = data;

    const safeDivide = (num: number, den: number) => {
        if (den === 0) return 0;
        return Math.round((num / den) * 100) / 100;
    };

    const round = (num: number) => Math.round(num * 100) / 100;

    // Calculate costs
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
        paper_cost_per_tube +
        paste_cost_per_tube +
        outer_paste_cost_per_tube +
        packing_cost_per_tube +
        labour_cost_per_tube +
        eb_cost_per_tube +
        overheads_cost_per_tube +
        food_cost_per_tube
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
        grand_total_cost_per_tube,
    };
}
