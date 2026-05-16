const { spawn } = require('child_process');

const p = spawn('npx.cmd', [
    'wrangler', 'd1', 'execute', 'paper_cost_db',
    '--remote',
    '--file', './migration.sql'
]);

p.stdout.on('data', d => {
    const str = d.toString();
    console.log(str);
    if (str.includes('Ok to proceed?')) {
        p.stdin.write('y\n');
    }
});

p.stderr.on('data', d => {
    console.error(d.toString());
});

p.on('close', code => {
    console.log('Migration finished with exit code:', code);
});
