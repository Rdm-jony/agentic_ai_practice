import express from "express";
import { bmiRoutes } from "./module/sequential/bmi.controller";
import { essayRoutes } from "./module/parallal/essay.cotroller";
import { reviewRoutes } from "./module/conditional/review.controller";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use("/bmi", bmiRoutes)
app.use("/essay", essayRoutes)
app.use("/review", reviewRoutes)

// ✅ route prefix should start with "/"

app.get("/", (req, res) => {
  res.json("agent server running");
});

app.listen(port, () => {
  console.log(`agent server running on port ${port}`);
});
