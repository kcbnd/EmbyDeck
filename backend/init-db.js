const { migrate } = require('./dist/db/migrate');

console.log('Initializing database...');
migrate();
console.log('Database initialized successfully!');
