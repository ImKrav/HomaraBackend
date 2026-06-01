// ============================================
// Homara — HTTP API Entry Point (TS)
// ============================================

import { envConfig } from "../config/env.config.js";
import app from "../http/express-server.js";

const PORT = envConfig.port;

app.listen(PORT, () => {
  console.log(`🏠 Homara API activa en http://localhost:${PORT} (Hexagonal + TS)`);
  console.log(`📄 Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
});
