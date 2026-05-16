const { spawn } = require('child_process');

const queries = [
    'ALTER TABLE labor_weekly_adjustments ADD COLUMN previous_balance REAL DEFAULT 0;',
    'ALTER TABLE labor_weekly_adjustments ADD COLUMN total_payable REAL DEFAULT 0;',
    'ALTER TABLE labor_weekly_adjustments ADD COLUMN paid_amount REAL DEFAULT 0;',
    'ALTER TABLE labor_weekly_adjustments ADD COLUMN balance_amount REAL DEFAULT 0;',
    'ALTER TABLE labor_weekly_adjustments ADD COLUMN paid_status TEXT DEFAULT "Unpaid";'
];

async function run() {
    for (const q of queries) {
        await new Promise(resolve => {
            const p = spawn('npx.cmd', [
                'wrangler', 'd1', 'execute', 'paper_cost_db',
                '--local',
                '--command', q
            ]);
            
            p.stdout.on('data', d => console.log(d.toString()));
            p.stderr.on('data', d => console.error(d.toString()));
            p.on('close', resolve);
        });
    }
}

run();
