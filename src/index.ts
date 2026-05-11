import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import dns from "dns";
import connectDB from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import tenantRoutes from "./modules/tenant/tenant.routes";
import projectRoutes from "./modules/project/project.routes";
import workItemRoutes from "./modules/workItem/workItem.routes";
import sprintRoutes from "./modules/sprint/sprint.routes";
import componentRoutes from "./modules/component/component.routes";
import uploadRoutes from "./modules/upload/upload.routes";
import userRoutes from "./modules/user/user.routes";

dotenv.config();

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/work-items", workItemRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/components", componentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
