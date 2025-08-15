const express = require('express');
const app = express();
app.use(express.json());
app.post('/test', (req, res) => {
  console.log('BODY:', req.body);
  res.json({ body: req.body });
});
app.listen(5001, () => console.log('Test server running on 5001'));