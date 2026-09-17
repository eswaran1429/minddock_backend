const express = require("express");
require("dotenv").config();

const userRoutes = require("./routes/user.routes");
const memoriesRoutes = require("./routes/memories.route");
const uploadImage = require("./controllers/upload_controller");
const upload = require("./middleware/upload");
const app = express();

app.use(express.json());
app.get('/', (req, res) => {
    res.send('API Working');
});
app.use("/", userRoutes);
app.use("/memories", memoriesRoutes);
app.post("/upload", upload.single("image"), uploadImage);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});