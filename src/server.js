const express = require("express");
require("dotenv").config();

const userRoutes = require("./routes/user.routes");
const memoriesRoutes = require("./routes/memories.route");
const app = express();

app.use(express.json());
app.get('/', (req, res) => {
    res.send('API Working');
});
app.use("/", userRoutes);
app.use("/memories", memoriesRoutes);

app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
});