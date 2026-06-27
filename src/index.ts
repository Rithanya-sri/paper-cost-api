/// <reference types="@cloudflare/workers-types" />
import * as jose from 'jose';

export interface Env {
    DB: D1Database;
}

const FIREBASE_PROJECT_ID = "paper-cost-auth-v2";
const GOOGLE_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const OWNER_EMAILS = [
    "goldconeserode@gmail.com",
    "thangam44445@gmail.com",
];

const SUPERVISOR_EMAILS = [
    "goldconesoffice@gmail.com",
    "rithanya.sri04@gmail.com",
    "goldconesae@gmail.com",
    "goldconespse@gmail.com",
];

let publicKeys: Record<string, string> | null = null;
let lastFetch = 0;

async function getPublicKeys() {
    const now = Date.now();
    if (!publicKeys || (now - lastFetch) > 3600000) {
        const response = await fetch(GOOGLE_CERT_URL);
        publicKeys = await response.json() as Record<string, string>;
        lastFetch = now;
    }
    return publicKeys;
}

async function verifyToken(token: string) {
    try {
        const header = jose.decodeProtectedHeader(token);
        if (!header.kid) throw new Error("Missing kid");

        const keys = await getPublicKeys();
        if (!keys) throw new Error("Could not fetch public keys");
        const cert = keys[header.kid];
        if (!cert) throw new Error("Invalid kid");

        const publicKey = await jose.importX509(cert, 'RS256');
        const { payload } = await jose.jwtVerify(token, publicKey, {
            issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
            audience: FIREBASE_PROJECT_ID,
        });

        return payload;
    } catch (e) {
        console.error("Token verification failed:", e);
        return null;
    }
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
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

        // Authentication Middleware
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);

        if (!payload || !payload.email) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 403,
                headers: corsHeaders,
            });
        }

        const email = (payload.email as string).toLowerCase();
        const isOwner = OWNER_EMAILS.includes(email);
        const isSupervisor = SUPERVISOR_EMAILS.includes(email);

        if (!isOwner && !isSupervisor) {
            return new Response(JSON.stringify({ error: `Access Denied: ${email} is not authorized` }), {
                status: 403,
                headers: corsHeaders,
            });
        }

        try {
            // Labors route - MOVED TO TOP FOR PRIORITY
            if (path.includes('/api/labors')) {
                if (method === 'GET') {
                    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
                    const result = await env.DB.prepare(`
                        SELECT l.*, (SELECT salary FROM labor_salary_history WHERE labor_id = l.id AND effective_date <= ? ORDER BY effective_date DESC, created_at DESC LIMIT 1) as current_salary
                        FROM labors l 
                        WHERE l.is_active = 1
                        ORDER BY l.name ASC
                    `).bind(date).all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can add labors" }), { status: 403, headers: corsHeaders });
                    const data = await request.json() as any;
                    const result = await env.DB.prepare('INSERT INTO labors (name, is_active) VALUES (?, ?)').bind(data.name, 1).run();
                    if (data.salary) await env.DB.prepare('INSERT INTO labor_salary_history (labor_id, salary, effective_date) VALUES (?, ?, ?)').bind(result.meta.last_row_id, data.salary, data.effective_date || new Date().toISOString().split('T')[0]).run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'DELETE') {
                    if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can delete labors" }), { status: 403, headers: corsHeaders });
                    const id = url.searchParams.get('id');
                    
                    // Force the delete by temporarily bypassing foreign key checks
                    await env.DB.batch([
                        env.DB.prepare('PRAGMA foreign_keys = OFF'),
                        env.DB.prepare('DELETE FROM labors WHERE id = ?').bind(id),
                        env.DB.prepare('PRAGMA foreign_keys = ON')
                    ]);
                    
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'PUT') {
                    if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can update labors" }), { status: 403, headers: corsHeaders });
                    const parts = path.split("/").filter(Boolean);
                    const id = parts[parts.length - 1];
                    const data = await request.json() as any;
                    
                    if (data.action === 'update_salary') {
                        await env.DB.prepare('INSERT INTO labor_salary_history (labor_id, salary, effective_date) VALUES (?, ?, ?)').bind(id, data.salary, data.effective_date || new Date().toISOString().split('T')[0]).run();
                        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                    } else if (data.action === 'update_name') {
                        await env.DB.prepare('UPDATE labors SET name = ? WHERE id = ?').bind(data.name, id).run();
                        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                    } else if (data.action === 'toggle_hide') {
                        if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can hide/unhide labors" }), { status: 403, headers: corsHeaders });
                        const hidden = data.is_hidden ? 1 : 0;
                        await env.DB.prepare('UPDATE labors SET is_hidden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(hidden, id).run();
                        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                    }
                }
            }

            if (path.startsWith('/api/production')) {
                const parts = path.split('/').filter(Boolean);
                const id = parts.length > 2 ? parts[2] : null;

                if (method === 'GET') {
                    if (id) {
                        const result = await env.DB.prepare(
                            'SELECT * FROM daily_production_records WHERE id = ?'
                        ).bind(id).first();
                        if (!result) return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });
                        return new Response(JSON.stringify(result), { headers: corsHeaders });
                    } else {
                        const result = await env.DB.prepare(
                            'SELECT * FROM daily_production_records ORDER BY date DESC'
                        ).all();
                        return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                    }
                }

                if (method === 'POST') {
                    const data = await request.json() as any;
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
                            wood_cost, wood_cost_per_tube,
                            grand_total_cost_per_tube,
                            rate_snapshot_used_that_day,
                            shift_production,
                            machine_production
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
                        calculated.wood_cost || 0, calculated.wood_cost_per_tube || 0,
                        calculated.grand_total_cost_per_tube,
                        calculated.rate_snapshot_used_that_day || 0,
                        calculated.shift_production || null,
                        calculated.machine_production || null
                    ).run();

                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id, ...calculated }), { status: 201, headers: corsHeaders });
                }

                if (method === 'PUT' && id) {
                    if (!isOwner && !isSupervisor) {
                        return new Response(JSON.stringify({ error: "Only owners and supervisors can update records" }), { status: 403, headers: corsHeaders });
                    }
                    const data = await request.json() as any;
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
                            wood_cost = ?, wood_cost_per_tube = ?,
                            grand_total_cost_per_tube = ?,
                            rate_snapshot_used_that_day = ?,
                            shift_production = ?,
                            machine_production = ?,
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
                        calculated.wood_cost || 0, calculated.wood_cost_per_tube || 0,
                        calculated.grand_total_cost_per_tube,
                        calculated.rate_snapshot_used_that_day || 0,
                        calculated.shift_production || null,
                        calculated.machine_production || null,
                        id
                    ).run();
                    return new Response(JSON.stringify({ success: true, ...calculated }), { headers: corsHeaders });
                }

                if (method === 'DELETE' && id) {
                    if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can delete records" }), { status: 403, headers: corsHeaders });
                    
                    // First get the date of the record to delete associated attendance
                    const record = await env.DB.prepare('SELECT date FROM daily_production_records WHERE id = ?').bind(id).first() as any;
                    if (record && record.date) {
                        await env.DB.prepare('DELETE FROM labor_attendance WHERE date = ?').bind(record.date).run();
                    }
                    
                    await env.DB.prepare('DELETE FROM daily_production_records WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Market rates route
            if (path === '/api/rates') {
                if (method === 'GET') {
                    const result = await env.DB.prepare('SELECT * FROM rate_master ORDER BY updated_at DESC LIMIT 1').first();
                    return new Response(JSON.stringify(result || {}), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    if (!isOwner) return new Response(JSON.stringify({ error: "Only owners can update rates" }), { status: 403, headers: corsHeaders });
                    const data = await request.json() as any;
                    await env.DB.prepare(`
                        INSERT INTO rate_master (paper_rate, paste_rate, outer_paste_rate, packing_rate, labour_wage, electricity_rate, eb_amount, waste_rate)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(data.paper_rate, data.paste_rate, data.outer_paste_rate, data.packing_rate, data.labour_wage, data.electricity_rate || 0, data.eb_amount || 0, data.waste_rate || 0).run();
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }



            // Attendance route
            if (path === '/api/attendance') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    const startDate = url.searchParams.get('startDate');
                    const endDate = url.searchParams.get('endDate');

                    if (startDate && endDate) {
                        const results = await env.DB.prepare(`
                            SELECT a.*, l.name as labor_name 
                            FROM labor_attendance a 
                            JOIN labors l ON a.labor_id = l.id 
                            WHERE a.date BETWEEN ? AND ?
                        `).bind(startDate, endDate).all();
                        return new Response(JSON.stringify(results.results), { headers: corsHeaders });
                    } else {
                        const results = await env.DB.prepare(`
                            SELECT a.*, l.name as labor_name 
                            FROM labor_attendance a 
                            JOIN labors l ON a.labor_id = l.id 
                            WHERE a.date = ?
                        `).bind(date).all();
                        return new Response(JSON.stringify(results.results), { headers: corsHeaders });
                    }
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    await env.DB.prepare('DELETE FROM labor_attendance WHERE date = ?').bind(data.date).run();
                    for (const item of data.items) {
                        await env.DB.prepare('INSERT INTO labor_attendance (date, labor_id, shifts, salary_rate_at_time, work_location) VALUES (?, ?, ?, ?, ?)').bind(data.date, item.labor_id, item.shifts, item.salary_rate_at_time, item.work_location || 'Cones').run();
                    }
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }

            // Labor Payroll (Dynamic Carry-forward)
            if (path === '/api/labor-payroll') {
                if (method === 'GET') {
                    const week_start_date = url.searchParams.get('week_start_date');
                    const results = await env.DB.prepare('SELECT * FROM labor_weekly_payroll WHERE week_start_date = ?').bind(week_start_date).all();
                    
                    // If no records for this week, we might want to fetch the previous week's balances to auto-fill.
                    // We can just return the previous week's balances as a separate array to help the frontend.
                    const prevDate = new Date(week_start_date!);
                    prevDate.setDate(prevDate.getDate() - 7);
                    const prev_week_start_date = prevDate.toISOString().split('T')[0];
                    const prev_results = await env.DB.prepare('SELECT labor_id, balance_amount FROM labor_weekly_payroll WHERE week_start_date = ?').bind(prev_week_start_date).all();

                    return new Response(JSON.stringify({
                        current_week: results.results,
                        previous_week: prev_results.results
                    }), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any; 
                    // data: { week_start_date, payroll: [{labor_id, additional_amount, previous_balance, total_payable, paid_amount, balance_amount, paid_status}] }
                    for (const p of data.payroll) {
                        await env.DB.prepare(`
                            INSERT OR REPLACE INTO labor_weekly_payroll 
                            (labor_id, week_start_date, additional_amount, previous_balance, total_payable, paid_amount, balance_amount, paid_status, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `).bind(
                            p.labor_id, 
                            data.week_start_date, 
                            p.additional_amount || 0,
                            p.previous_balance || 0,
                            p.total_payable || 0,
                            p.paid_amount || 0,
                            p.balance_amount || 0,
                            p.paid_status || 'Unpaid'
                        ).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Paper Varieties CRUD
            if (path.startsWith('/api/paper-varieties')) {
                const parts = path.split("/").filter(Boolean);
                const id = parts.length > 2 ? parts[2] : null;

                if (method === 'GET') {
                    const result = await env.DB.prepare('SELECT * FROM paper_varieties ORDER BY name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const result = await env.DB.prepare('INSERT INTO paper_varieties (name, current_stock) VALUES (?, ?)')
                        .bind(data.name, data.current_stock || 0)
                        .run();
                    
                    await env.DB.prepare('INSERT INTO raw_materials (material_name, variety, current_stock) VALUES (?, ?, ?)')
                        .bind(`Paper - ${data.name}`, '', data.current_stock || 0).run();
                        
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    const old = await env.DB.prepare('SELECT name FROM paper_varieties WHERE id = ?').bind(id).first() as any;
                    
                    await env.DB.prepare('UPDATE paper_varieties SET name = ?, current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(data.name, data.current_stock || 0, id)
                        .run();
                        
                    if (old) {
                        await env.DB.prepare('UPDATE raw_materials SET material_name = ?, current_stock = ? WHERE material_name = ?')
                            .bind(`Paper - ${data.name}`, data.current_stock || 0, `Paper - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    const old = await env.DB.prepare('SELECT name FROM paper_varieties WHERE id = ?').bind(id).first() as any;
                    await env.DB.prepare('DELETE FROM paper_varieties WHERE id = ?').bind(id).run();
                    if (old) {
                        await env.DB.prepare('DELETE FROM raw_materials WHERE material_name = ?').bind(`Paper - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Paper Usage (per date)
            if (path === '/api/paper-usage') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });
                    
                    const usages = await env.DB.prepare('SELECT * FROM daily_paper_usage WHERE date = ?').bind(date).all();
                    const reels = await env.DB.prepare('SELECT * FROM reel_usage WHERE date = ?').bind(date).all();
                    
                    return new Response(JSON.stringify({
                        usages: usages.results,
                        reels: reels.results
                    }), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const date = data.date;
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });

                    const batchStatements = [
                        env.DB.prepare('DELETE FROM daily_paper_usage WHERE date = ?').bind(date),
                        env.DB.prepare('DELETE FROM reel_usage WHERE date = ?').bind(date)
                    ];

                    for (const u of data.usages) {
                        batchStatements.push(
                            env.DB.prepare(`
                                INSERT INTO daily_paper_usage 
                                (date, paper_variety_id, current_stock, used_stock_today, balance_stock, reels_count, price) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).bind(date, u.paper_variety_id, u.current_stock || 0, u.used_stock_today || 0, u.balance_stock || 0, u.reels_count || 0, u.price || 0)
                        );

                        // Update current_stock in paper_varieties table permanently
                        batchStatements.push(
                            env.DB.prepare('UPDATE paper_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                                .bind(u.balance_stock || 0, u.paper_variety_id)
                        );
                        
                        // Sync deduction to raw_materials
                        const variety = await env.DB.prepare('SELECT name FROM paper_varieties WHERE id = ?').bind(u.paper_variety_id).first() as any;
                        if (variety) {
                            batchStatements.push(
                                env.DB.prepare('UPDATE raw_materials SET current_stock = ? WHERE material_name = ?')
                                    .bind(u.balance_stock || 0, `Paper - ${variety.name}`)
                            );
                        }

                        if (u.reels && Array.isArray(u.reels)) {
                            for (const r of u.reels) {
                                batchStatements.push(
                                    env.DB.prepare(`
                                        INSERT INTO reel_usage 
                                        (date, paper_variety_id, reel_index, weight, production, avg_pattern_weight, cone_weight, crushing_strength, description) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                    `).bind(
                                        date, 
                                        u.paper_variety_id, 
                                        r.reel_index, 
                                        r.weight || 0, 
                                        r.production || 0, 
                                        r.avg_pattern_weight || 0, 
                                        r.cone_weight || 0, 
                                        r.crushing_strength || 0, 
                                        r.description || ""
                                    )
                                );
                            }
                        }
                    }

                    await env.DB.batch(batchStatements);
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }

            // Paste Varieties CRUD
            if (path.startsWith('/api/paste-varieties')) {
                const parts = path.split("/").filter(Boolean);
                const id = parts.length > 2 ? parts[2] : null;

                if (method === 'GET') {
                    const result = await env.DB.prepare('SELECT * FROM paste_varieties ORDER BY name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const result = await env.DB.prepare('INSERT INTO paste_varieties (name, current_stock) VALUES (?, ?)')
                        .bind(data.name, data.current_stock || 0)
                        .run();
                        
                    await env.DB.prepare('INSERT INTO raw_materials (material_name, variety, current_stock) VALUES (?, ?, ?)')
                        .bind(`Paste - ${data.name}`, '', data.current_stock || 0).run();
                        
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    const old = await env.DB.prepare('SELECT name FROM paste_varieties WHERE id = ?').bind(id).first() as any;
                    
                    await env.DB.prepare('UPDATE paste_varieties SET name = ?, current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(data.name, data.current_stock || 0, id)
                        .run();
                        
                    if (old) {
                        await env.DB.prepare('UPDATE raw_materials SET material_name = ?, current_stock = ? WHERE material_name = ?')
                            .bind(`Paste - ${data.name}`, data.current_stock || 0, `Paste - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    const old = await env.DB.prepare('SELECT name FROM paste_varieties WHERE id = ?').bind(id).first() as any;
                    await env.DB.prepare('DELETE FROM paste_varieties WHERE id = ?').bind(id).run();
                    if (old) {
                        await env.DB.prepare('DELETE FROM raw_materials WHERE material_name = ?').bind(`Paste - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Paste Usage (per date)
            if (path === '/api/paste-usage') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });
                    
                    const usages = await env.DB.prepare('SELECT * FROM daily_paste_usage WHERE date = ?').bind(date).all();
                    
                    return new Response(JSON.stringify({
                        usages: usages.results
                    }), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const date = data.date;
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });

                    const batchStatements = [
                        env.DB.prepare('DELETE FROM daily_paste_usage WHERE date = ?').bind(date)
                    ];

                    for (const u of data.usages) {
                        batchStatements.push(
                            env.DB.prepare(`
                                INSERT INTO daily_paste_usage 
                                (date, paste_variety_id, current_stock, used_stock_today, balance_stock, price) 
                                VALUES (?, ?, ?, ?, ?, ?)
                            `).bind(date, u.paste_variety_id, u.current_stock || 0, u.used_stock_today || 0, u.balance_stock || 0, u.price || 0)
                        );

                        // Update current_stock in paste_varieties table permanently
                        batchStatements.push(
                            env.DB.prepare('UPDATE paste_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                                .bind(u.balance_stock || 0, u.paste_variety_id)
                        );
                        
                        // Sync deduction to raw_materials
                        const variety = await env.DB.prepare('SELECT name FROM paste_varieties WHERE id = ?').bind(u.paste_variety_id).first() as any;
                        if (variety) {
                            batchStatements.push(
                                env.DB.prepare('UPDATE raw_materials SET current_stock = ? WHERE material_name = ?')
                                    .bind(u.balance_stock || 0, `Paste - ${variety.name}`)
                            );
                        }
                    }

                    await env.DB.batch(batchStatements);
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }

            // Wood Varieties
            if (path.startsWith('/api/wood-varieties')) {
                const parts = path.split('/').filter(Boolean);
                const id = parts.length > 2 ? parts[2] : null;

                if (method === 'GET') {
                    const varieties = await env.DB.prepare('SELECT * FROM wood_varieties ORDER BY name ASC').all();
                    return new Response(JSON.stringify(varieties.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    if (!data.name) return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400, headers: corsHeaders });
                    const result = await env.DB.prepare('INSERT INTO wood_varieties (name, current_stock) VALUES (?, ?)')
                        .bind(data.name, data.current_stock || 0)
                        .run();
                        
                    await env.DB.prepare('INSERT INTO raw_materials (material_name, variety, current_stock) VALUES (?, ?, ?)')
                        .bind(`Wood - ${data.name}`, '', data.current_stock || 0).run();
                        
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    const old = await env.DB.prepare('SELECT name FROM wood_varieties WHERE id = ?').bind(id).first() as any;
                    
                    await env.DB.prepare('UPDATE wood_varieties SET name = ?, current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(data.name, data.current_stock || 0, id)
                        .run();
                        
                    if (old) {
                        await env.DB.prepare('UPDATE raw_materials SET material_name = ?, current_stock = ? WHERE material_name = ?')
                            .bind(`Wood - ${data.name}`, data.current_stock || 0, `Wood - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    const old = await env.DB.prepare('SELECT name FROM wood_varieties WHERE id = ?').bind(id).first() as any;
                    await env.DB.prepare('DELETE FROM wood_varieties WHERE id = ?').bind(id).run();
                    if (old) {
                        await env.DB.prepare('DELETE FROM raw_materials WHERE material_name = ?').bind(`Wood - ${old.name}`).run();
                    }
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Wood Usage (per date)
            if (path === '/api/wood-usage') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });
                    
                    const usages = await env.DB.prepare('SELECT * FROM daily_wood_usage WHERE date = ?').bind(date).all();
                    
                    return new Response(JSON.stringify({
                        usages: usages.results
                    }), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const date = data.date;
                    if (!date) return new Response(JSON.stringify({ error: "Missing date" }), { status: 400, headers: corsHeaders });

                    const batchStatements = [
                        env.DB.prepare('DELETE FROM daily_wood_usage WHERE date = ?').bind(date)
                    ];

                    for (const u of data.usages) {
                        batchStatements.push(
                            env.DB.prepare(`
                                INSERT INTO daily_wood_usage 
                                (date, wood_variety_id, current_stock, used_stock_today, balance_stock, price) 
                                VALUES (?, ?, ?, ?, ?, ?)
                            `).bind(date, u.wood_variety_id, u.current_stock || 0, u.used_stock_today || 0, u.balance_stock || 0, u.price || 0)
                        );

                        // Update current_stock in wood_varieties table permanently
                        batchStatements.push(
                            env.DB.prepare('UPDATE wood_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                                .bind(u.balance_stock || 0, u.wood_variety_id)
                        );
                        
                        // Sync deduction to raw_materials
                        const variety = await env.DB.prepare('SELECT name FROM wood_varieties WHERE id = ?').bind(u.wood_variety_id).first() as any;
                        if (variety) {
                            batchStatements.push(
                                env.DB.prepare('UPDATE raw_materials SET current_stock = ? WHERE material_name = ?')
                                    .bind(u.balance_stock || 0, `Wood - ${variety.name}`)
                            );
                        }
                    }

                    await env.DB.batch(batchStatements);
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
                }
            }

            // Product Varieties
            if (path.startsWith('/api/product-varieties')) {
                const parts = path.split('/');
                const id = parts.length > 2 ? parts[parts.length - 1] : null;

                if (method === 'GET') {
                    const result = await env.DB.prepare('SELECT * FROM product_varieties ORDER BY product_name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    if (!data.product_name) return new Response(JSON.stringify({ error: 'Product Name is required' }), { status: 400, headers: corsHeaders });
                    const result = await env.DB.prepare('INSERT INTO product_varieties (product_name, dimension, color) VALUES (?, ?, ?)')
                        .bind(data.product_name, data.dimension || '', data.color || '')
                        .run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM product_varieties WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Customers (Order Tracking)
            if (path.startsWith('/api/customers')) {
                const parts = path.split('/');
                const id = parts.length > 2 ? parts[parts.length - 1] : null;

                if (method === 'GET') {
                    const result = await env.DB.prepare('SELECT * FROM customers ORDER BY name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    if (!data.name) return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400, headers: corsHeaders });
                    const result = await env.DB.prepare('INSERT INTO customers (name) VALUES (?)')
                        .bind(data.name)
                        .run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    await env.DB.prepare('UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(data.name, id)
                        .run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Orders (Order Tracking)
            if (path.startsWith('/api/orders')) {
                const parts = path.split('/');
                const id = parts.length > 2 ? parts[parts.length - 1] : null;

                if (method === 'GET') {
                    const customer_id = url.searchParams.get('customer_id');
                    let result;
                    if (customer_id) {
                        result = await env.DB.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').bind(customer_id).all();
                    } else {
                        result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                    }
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }
                if (method === 'POST') {
                    const data = await request.json() as any;
                    const result = await env.DB.prepare(`
                        INSERT INTO orders (customer_id, job_card_no, product_name, dimension, color, quantity, raw_material_check, delivery_date, order_taken_date, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        data.customer_id, data.job_card_no || '', data.product_name || '', data.dimension || '',
                        data.color || '', data.quantity || 0, data.raw_material_check || '', data.delivery_date || '', data.order_taken_date || '', data.status || 'Pending'
                    ).run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    let newStatus = data.status || 'Pending';
                    const delQty = data.delivered_quantity || 0;
                    if (delQty >= (data.quantity || 0)) {
                        newStatus = 'Delivered';
                    }
                    await env.DB.prepare(`
                        UPDATE orders SET 
                        customer_id = ?, job_card_no = ?, product_name = ?, dimension = ?, color = ?, quantity = ?, raw_material_check = ?, delivery_date = ?, order_taken_date = ?, status = ?, stock_check_status = ?, delivered_quantity = ?, actual_delivery_date = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(
                        data.customer_id, data.job_card_no || '', data.product_name || '', data.dimension || '',
                        data.color || '', data.quantity || 0, data.raw_material_check || '', data.delivery_date || '', data.order_taken_date || '', newStatus, data.stock_check_status || '', delQty, data.actual_delivery_date || null, id
                    ).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Raw Materials Stock Management
            if (path.startsWith('/api/raw-materials')) {
                const parts = path.split('/');
                // /api/raw-materials/check or /api/raw-materials/:id
                const lastPart = parts[parts.length - 1];
                const isCheck = lastPart === 'check';
                const id = (!isCheck && parts.length > 3) ? lastPart : null;

                // GET all raw materials
                if (method === 'GET' && !id) {
                    const result = await env.DB.prepare('SELECT * FROM raw_materials ORDER BY material_name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }

                // GET single raw material
                if (method === 'GET' && id) {
                    const result = await env.DB.prepare('SELECT * FROM raw_materials WHERE id = ?').bind(id).first();
                    return new Response(JSON.stringify(result), { headers: corsHeaders });
                }

                // POST check stock availability
                if (method === 'POST' && isCheck) {
                    const data = await request.json() as any;
                    // data.required_materials = [{material_id, required_quantity}]
                    const required = data.required_materials || [];
                    const insufficient: any[] = [];
                    let allSufficient = true;

                    for (const req of required) {
                        const mat = await env.DB.prepare('SELECT * FROM raw_materials WHERE id = ?').bind(req.material_id).first() as any;
                        if (mat) {
                            if (mat.current_stock < req.required_quantity) {
                                allSufficient = false;
                                insufficient.push({
                                    id: mat.id,
                                    material_name: mat.material_name,
                                    variety: mat.variety,
                                    unit: mat.unit,
                                    current_stock: mat.current_stock,
                                    required_quantity: req.required_quantity,
                                    shortage: req.required_quantity - mat.current_stock
                                });
                            }
                        }
                    }

                    return new Response(JSON.stringify({
                        status: allSufficient ? 'Enough Stock' : 'Have to Order',
                        insufficient_materials: insufficient
                    }), { headers: corsHeaders });
                }

                // POST add new raw material
                if (method === 'POST' && !isCheck) {
                    const data = await request.json() as any;
                    const result = await env.DB.prepare(`
                        INSERT INTO raw_materials (material_name, variety, unit, minimum_stock, current_stock, last_updated)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).bind(
                        data.material_name || '', data.variety || '', data.unit || 'Kg',
                        data.minimum_stock || 0, data.current_stock || 0
                    ).run();

                    // Log stock update
                    if (data.current_stock > 0) {
                        await env.DB.prepare(`
                            INSERT INTO stock_updates (raw_material_id, quantity_added, update_type, notes)
                            VALUES (?, ?, ?, ?)
                        `).bind(result.meta.last_row_id, data.current_stock, data.update_type || 'Initial', 'Initial stock entry').run();
                    }
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }

                // PUT update raw material
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    const current = await env.DB.prepare('SELECT current_stock FROM raw_materials WHERE id = ?').bind(id).first() as any;

                    await env.DB.prepare(`
                        UPDATE raw_materials SET
                        material_name = ?, variety = ?, unit = ?, minimum_stock = ?, current_stock = ?,
                        last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(
                        data.material_name || '', data.variety || '', data.unit || 'Kg',
                        data.minimum_stock || 0, data.current_stock || 0, id
                    ).run();

                    // Log the stock change
                    if (current && data.current_stock !== undefined) {
                        const diff = (data.current_stock || 0) - (current.current_stock || 0);
                        if (diff !== 0) {
                            await env.DB.prepare(`
                                INSERT INTO stock_updates (raw_material_id, quantity_added, quantity_used, update_type, notes)
                                VALUES (?, ?, ?, ?, ?)
                            `).bind(
                                id,
                                diff > 0 ? diff : 0,
                                diff < 0 ? Math.abs(diff) : 0,
                                data.update_type || 'Manual',
                                data.notes || ''
                            ).run();
                        }
                        
                        // Sync back to varieties if it's a unified material
                        const materialName = data.material_name || '';
                        if (materialName.startsWith('Paper - ')) {
                            const varietyName = materialName.substring(8);
                            await env.DB.prepare('UPDATE paper_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?')
                                .bind(data.current_stock || 0, varietyName).run();
                        } else if (materialName.startsWith('Wood - ')) {
                            const varietyName = materialName.substring(7);
                            await env.DB.prepare('UPDATE wood_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?')
                                .bind(data.current_stock || 0, varietyName).run();
                        } else if (materialName.startsWith('Paste - ')) {
                            const varietyName = materialName.substring(8);
                            await env.DB.prepare('UPDATE paste_varieties SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?')
                                .bind(data.current_stock || 0, varietyName).run();
                        }
                    }

                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

                // DELETE raw material
                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM raw_materials WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            // Product Stock Management
            if (path.startsWith('/api/product-stock')) {
                const parts = path.split('/');
                const lastPart = parts[parts.length - 1];
                const isCheck = lastPart === 'check';
                const id = (!isCheck && parts.length > 3) ? lastPart : null;

                // GET all product stock
                if (method === 'GET' && !id && !isCheck) {
                    const result = await env.DB.prepare('SELECT * FROM product_stock ORDER BY product_name ASC').all();
                    return new Response(JSON.stringify(result.results), { headers: corsHeaders });
                }

                // GET single product stock
                if (method === 'GET' && id) {
                    const result = await env.DB.prepare('SELECT * FROM product_stock WHERE id = ?').bind(id).first();
                    return new Response(JSON.stringify(result), { headers: corsHeaders });
                }

                // POST check stock availability for an order
                if (method === 'POST' && isCheck) {
                    const data = await request.json() as any;
                    const product_name = data.product_name || '';
                    const required_quantity = Number(data.required_quantity) || 0;

                    // Find matching product stock (by product_name, case-insensitive)
                    const stockResult = await env.DB.prepare(
                        'SELECT * FROM product_stock WHERE LOWER(product_name) = LOWER(?)'
                    ).bind(product_name).first() as any;

                    // Get total pending order quantity for this product
                    const pendingOrders = await env.DB.prepare(
                        `SELECT SUM(quantity - COALESCE(delivered_quantity, 0)) as total_pending 
                         FROM orders WHERE LOWER(product_name) = LOWER(?) AND status = 'Pending'`
                    ).bind(product_name).first() as any;

                    const totalPending = Number(pendingOrders?.total_pending) || 0;
                    const currentStock = stockResult ? Number(stockResult.current_stock) || 0 : 0;
                    const netAvailable = currentStock - totalPending;

                    let status: string;
                    let needToPrepare = 0;
                    if (netAvailable >= 0) {
                        status = 'Enough to Deliver';
                    } else {
                        needToPrepare = Math.abs(netAvailable);
                        status = 'Need to Prepare More';
                    }

                    return new Response(JSON.stringify({
                        status,
                        product_name,
                        current_stock: currentStock,
                        total_pending_orders: totalPending,
                        net_available: netAvailable,
                        required_quantity,
                        need_to_prepare: needToPrepare,
                        stock_found: !!stockResult
                    }), { headers: corsHeaders });
                }

                // POST add new product stock
                if (method === 'POST' && !isCheck) {
                    const data = await request.json() as any;
                    if (!data.product_name) return new Response(JSON.stringify({ error: 'Product name is required' }), { status: 400, headers: corsHeaders });
                    const result = await env.DB.prepare(`
                        INSERT INTO product_stock (product_name, variety, unit, daily_production, current_stock, minimum_stock, last_updated)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).bind(
                        data.product_name || '',
                        data.variety || '',
                        data.unit || 'Pieces',
                        data.daily_production || 0,
                        data.current_stock || 0,
                        data.minimum_stock || 0
                    ).run();
                    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201, headers: corsHeaders });
                }

                // PUT update product stock
                if (method === 'PUT' && id) {
                    const data = await request.json() as any;
                    await env.DB.prepare(`
                        UPDATE product_stock SET
                        product_name = ?, variety = ?, unit = ?, daily_production = ?,
                        current_stock = ?, minimum_stock = ?,
                        last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(
                        data.product_name || '',
                        data.variety || '',
                        data.unit || 'Pieces',
                        data.daily_production || 0,
                        data.current_stock || 0,
                        data.minimum_stock || 0,
                        id
                    ).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

                // DELETE product stock
                if (method === 'DELETE' && id) {
                    await env.DB.prepare('DELETE FROM product_stock WHERE id = ?').bind(id).run();
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });

        } catch (error: any) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }
};

function calculateRecord(data: any) {
    const { production } = data;
    const safeDivide = (num: number, den: number) => { if (den === 0) return 0; return Math.round((num / den) * 100) / 100; };
    const round = (num: number) => Math.round(num * 100) / 100;

    const paper_cost = data.paper_cost !== undefined ? round(data.paper_cost) : round(data.paper_quantity_kg * data.paper_rate);
    const paper_cost_per_tube = data.paper_cost_per_tube !== undefined ? round(data.paper_cost_per_tube) : safeDivide(paper_cost, production);
    const paste_cost = data.paste_cost !== undefined ? round(data.paste_cost) : round(data.paste_quantity * data.paste_rate);
    const paste_cost_per_tube = data.paste_cost_per_tube !== undefined ? round(data.paste_cost_per_tube) : safeDivide(paste_cost, production);
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
    const waste_cost = round((data.waste_quantity_kg || 0) * (data.waste_rate || 0));
    const waste_cost_per_tube = safeDivide(waste_cost, production);

    const wood_cost = data.wood_cost !== undefined ? round(data.wood_cost) : 0;
    const wood_cost_per_tube = data.wood_cost_per_tube !== undefined ? round(data.wood_cost_per_tube) : safeDivide(wood_cost, production);

    const grand_total_cost_per_tube = data.grand_total_cost_per_tube !== undefined 
        ? round(data.grand_total_cost_per_tube) 
        : round(paper_cost_per_tube + paste_cost_per_tube + outer_paste_cost_per_tube + packing_cost_per_tube + labour_cost_per_tube + eb_cost_per_tube + overheads_cost_per_tube + food_cost_per_tube + others_cost_per_tube + waste_cost_per_tube + wood_cost_per_tube);

    return { ...data, paper_cost, paper_cost_per_tube, paste_cost, paste_cost_per_tube, outer_paste_cost, outer_paste_cost_per_tube, packing_cost, packing_cost_per_tube, labour_cost, labour_cost_per_tube, eb_cost_per_tube, overheads_amount: data.overheads_amount || 0, overheads_cost_per_tube, food_amount: data.food_amount || 0, food_cost_per_tube, others_amount: data.others_amount || 0, others_cost_per_tube, waste_quantity_kg: data.waste_quantity_kg || 0, waste_rate: data.waste_rate || 0, waste_cost, waste_cost_per_tube, wood_cost, wood_cost_per_tube, grand_total_cost_per_tube };
}
