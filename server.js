const path = require('path');
const { createApp } = require('./src/app');
const { Store } = require('./src/store');

const PORT = process.env.PORT || 3000;
const store = new Store(
  path.join(__dirname, 'data', 'db.json'),
  path.join(__dirname, 'data', 'seed.json')
);

createApp(store).listen(PORT, () => {
  console.log(`Comms Hub running at http://localhost:${PORT}`);
});
