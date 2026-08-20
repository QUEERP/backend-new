const { spawn } = require('child_process');

const p = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'multi_currency_phase1', '--create-only'], {
  cwd: __dirname,
  env: process.env,
  shell: true
});

p.stdout.on('data', data => {
  const str = data.toString();
  console.log(str);
  if (str.includes('We need to reset the') || str.includes('Are you sure you want to create') || str.includes('warnings')) {
    console.log("SENDING YES");
    p.stdin.write('y\n');
  }
});
p.stderr.on('data', data => console.error(data.toString()));
p.on('close', code => console.log('Exited with', code));
