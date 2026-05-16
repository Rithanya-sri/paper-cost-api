const { spawn } = require('child_process');

const queries = [
    'CREATE TABLE IF NOT EXISTS labor_weekly_payroll (id INTEGER PRIMARY KEY AUTOINCREMENT, labor_id INTEGER NOT NULL, week_start_date TEXT NOT NULL, additional_amount REAL DEFAULT 0, previous_balance REAL DEFAULT 0, total_payable REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance_amount REAL DEFAULT 0, paid_status TEXT DEFAULT "Unpaid", created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(labor_id, week_start_date));',
    'INSERT OR IGNORE INTO labor_weekly_payroll (labor_id, week_start_date, additional_amount) SELECT labor_id, week_start_date, amount FROM labor_weekly_adjustments;'
];

async function run() {
    for (const q of queries) {
        await new Promise(resolve => {
            const p = spawn('npx.cmd', [
                'wrangler', 'd1', 'execute', 'paper_cost_db',
                '--remote',
                '--command', q
            ]);
            
            p.stdout.on('data', d => {
                const str = d.toString();
                console.log(str);
                if (str.includes('Ok to proceed?')) {
                    p.stdin.write('y\n');
                }
            });
            p.stderr.on('data', d => console.error(d.toString()));
            p.on('close', resolve);
        });
    }
    console.log("Migration finished!");
}

run();
