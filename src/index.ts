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

        try {
            // Production records route: /api/production/[[id]]
            if (path.startsWith("/api/production")) {
                const parts = path.split("/").filter(Boolean);
                const id = parts[2] || null; // /api/production/:id -> index 2

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
                            eb_units, electricity_rate, eb_amount, eb_cost_per_tube,
                            overheads_amount, overheads_cost_per_tube,
                            food_amount, food_cost_per_tube,
                            others_amount,
                            waste_quantity_kg, waste_rate, waste_cost, waste_cost_per_tube,
                            grand_total_cost_per_tube,
                            rate_snapshot_used_that_day
                        ) VALUES (
                            ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?,
                            ?, ?,
                            ?,
                            ?, ?, ?, ?,
                            ?,
                            ?
                        )
                    `).bind(
                        calculated.date, calculated.production, calculated.outdone,
                        calculated.paper_quantity_kg, calculated.paper_rate, calculated.paper_cost, calculated.paper_cost_per_tube,
                        calculated.paste_quantity, calculated.paste_rate, calculated.paste_cost, calculated.paste_cost_per_tube,
                        calculated.outer_paste_quantity, calculated.outer_paste_rate, calculated.outer_paste_cost, calculated.outer_paste_cost_per_tube,
                        calculated.packing_quantity, calculated.packing_rate, calculated.packing_cost, calculated.packing_cost_per_tube,
                        calculated.labour_count, calculated.labour_wage, calculated.labour_cost, calculated.labour_cost_per_tube,
                        calculated.eb_units, calculated.electricity_rate || 0, calculated.eb_amount, calculated.eb_cost_per_tube,
                        calculated.overheads_amount, calculated.overheads_cost_per_tube,
                        calculated.food_amount, calculated.food_cost_per_tube,
                        calculated.others_amount || 0,
                        calculated.waste_quantity_kg || 0, calculated.waste_rate || 0, calculated.waste_cost || 0, calculated.waste_cost_per_tube || 0,
                        calculated.grand_total_cost_per_tube,
                        calculated.rate_snapshot_used_that_day || 0
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
                            eb_units = ?, electricity_rate = ?, eb_amount = ?, eb_cost_per_tube = ?,
                            overheads_amount = ?, overheads_cost_per_tube = ?,
                            food_amount = ?, food_cost_per_tube = ?,
                            others_amount = ?,
                            waste_quantity_kg = ?, waste_rate = ?, waste_cost = ?, waste_cost_per_tube = ?,
                            grand_total_cost_per_tube = ?,
                            rate_snapshot_used_that_day = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(
                        calculated.date, calculated.production, calculated.outdone,
                        calculated.paper_quantity_kg, calculated.paper_rate, calculated.paper_cost, calculated.paper_cost_per_tube,
                        calculated.paste_quantity, calculated.paste_rate, calculated.paste_cost, calculated.paste_cost_per_tube,
                        calculated.outer_paste_quantity, calculated.outer_paste_rate, calculated.outer_paste_cost, calculated.outer_paste_cost_per_tube,
                        calculated.packing_quantity, calculated.packing_rate, calculated.packing_cost, calculated.packing_cost_per_tube,
                        calculated.labour_count, calculated.labour_wage, calculated.labour_cost, calculated.labour_cost_per_tube,
                        calculated.eb_units, calculated.electricity_rate || 0, calculated.eb_amount, calculated.eb_cost_per_tube,
                        calculated.overheads_amount, calculated.overheads_cost_per_tube,
                        calculated.food_amount, calculated.food_cost_per_tube,
                        calculated.others_amount || 0,
                        calculated.waste_quantity_kg || 0, calculated.waste_rate || 0, calculated.waste_cost || 0, calculated.waste_cost_per_tube || 0,
                        calculated.grand_total_cost_per_tube,
                        calculated.rate_snapshot_used_that_day || 0,
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
            }

            // Market rates route: /api/rates
            if (path === '/api/rates') {
                if (method === 'GET') {
                    const result = await env.DB.prepare(
                        'SELECT * FROM rate_master ORDER BY updated_at DESC LIMIT 1'
                    ).first();
                    return new Response(JSON.stringify(result || {}), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json();
                    const result = await env.DB.prepare(`
                        INSERT INTO rate_master (
                            paper_rate, paste_rate, outer_paste_rate, packing_rate, labour_wage, electricity_rate, eb_amount
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        data.paper_rate,
                        data.paste_rate,
                        data.outer_paste_rate,
                        data.packing_rate,
                        data.labour_wage,
                        data.electricity_rate || 0,
                        data.eb_amount || 0
                    ).run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
                        status: 201,
                        headers: corsHeaders
                    });
                }
            }

            // --- LABORS API ---
            if (path.startsWith('/api/labors')) {
                const parts = path.split("/").filter(Boolean);
                const id = parts[2] || null;

                if (method === 'GET') {
                    // Fetch labors with their latest salary
                    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
                    const result = await env.DB.prepare(`
                        SELECT l.*, 
                        (SELECT salary FROM labor_salary_history 
                         WHERE labor_id = l.id AND effective_date <= ? 
                         ORDER BY effective_date DESC, created_at DESC LIMIT 1) as current_salary
                        FROM labors l
                        ORDER BY l.name ASC
                    `).bind(date).all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }

                if (method === 'POST') {
                    const data = await request.json();
                    // Part 1: Insert Labor
                    const result = await env.DB.prepare(`
                        INSERT INTO labors (name, is_active) VALUES (?, ?)
                    `).bind(data.name, 1).run();
                    const laborId = result.meta.last_row_id;
                    
                    // Part 2: Insert initial salary if provided
                    if (data.salary) {
                        await env.DB.prepare(`
                            INSERT INTO labor_salary_history (labor_id, salary, effective_date)
                            VALUES (?, ?, ?)
                        `).bind(laborId, data.salary, data.effective_date || new Date().toISOString().split('T')[0]).run();
                    }

                    return new Response(JSON.stringify({ success: true, id: laborId }), { status: 201, headers: corsHeaders });
                }

                if (method === 'PUT' && id) {
                    const data = await request.json();
                    if (data.action === 'update_salary') {
                        await env.DB.prepare(`
                            INSERT INTO labor_salary_history (labor_id, salary, effective_date)
                            VALUES (?, ?, ?)
                        `).bind(id, data.salary, data.effective_date).run();
                    } else {
                        await env.DB.prepare(`
                            UPDATE labors SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                        `).bind(data.name, data.is_active, id).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM labors WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // --- ATTENDANCE API ---
            if (path === '/api/attendance') {
                const date = url.searchParams.get('date');
                if (method === 'GET' && date) {
                    const result = await env.DB.prepare(`
                        SELECT a.*, l.name as labor_name 
                        FROM labor_attendance a
                        JOIN labors l ON a.labor_id = l.id
                        WHERE a.date = ?
                    `).bind(date).all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }

                if (method === 'POST') {
                    const data = await request.json(); // { date: '...', items: [ {labor_id, shifts, salary_rate_at_time} ] }
                    
                    // Delete existing for that date first (to overwrite)
                    await env.DB.prepare('DELETE FROM labor_attendance WHERE date = ?').bind(data.date).run();
                    
                    for (const item of data.items) {
                        await env.DB.prepare(`
                            INSERT INTO labor_attendance (date, labor_id, shifts, salary_rate_at_time)
                            VALUES (?, ?, ?, ?)
                        `).bind(data.date, item.labor_id, item.shifts, item.salary_rate_at_time).run();
                    }
                    
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: corsHeaders,
            });

        } catch (error: any) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: corsHeaders,
            });
        }
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
    const others_cost_per_tube = safeDivide(data.others_amount, production);

    const waste_cost = round(data.waste_quantity_kg * data.waste_rate);
    const waste_cost_per_tube = safeDivide(waste_cost, production);

    const grand_total_cost_per_tube = round(
        paper_cost_per_tube +
        paste_cost_per_tube +
        outer_paste_cost_per_tube +
        packing_cost_per_tube +
        labour_cost_per_tube +
        eb_cost_per_tube +
        overheads_cost_per_tube +
        food_cost_per_tube +
        others_cost_per_tube +
        waste_cost_per_tube
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
        overheads_amount: data.overheads_amount || 0,
        overheads_cost_per_tube,
        food_amount: data.food_amount || 0,
        food_cost_per_tube,
        others_amount: data.others_amount || 0,
        others_cost_per_tube,
        waste_quantity_kg: data.waste_quantity_kg || 0,
        waste_rate: data.waste_rate || 0,
        waste_cost,
        waste_cost_per_tube,
        electricity_rate: data.electricity_rate || 0,
        grand_total_cost_per_tube,
    };
}
