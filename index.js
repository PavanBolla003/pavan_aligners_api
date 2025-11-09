import express from "express";
import cors from "cors";
import BodyParser from "body-parser";
import env from "dotenv";
import routes from "./routes/index.js";
env.config();

const app = express();


const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "30mb" }));

app.use(BodyParser.urlencoded({ extended: true }));

app.use("/dental-management-system/backend/api", routes);

app.use('/uploads', express.static("uploads"));

app.use((req, res) => {
    res.status(404).json({
        status: "Not Found",
        message: "Route Not Found",
    })
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
})