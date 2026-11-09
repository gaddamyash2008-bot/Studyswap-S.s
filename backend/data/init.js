const { initializeDatabase } = require('../config/db');

async function main() {
  await initializeDatabase();
  console.log('StudySwap database initialized.');
}

main().catch((error) => {
  console.error('Initialization failed:', error);
  process.exit(1);
});
