const os = require("os");
const localtunnel = require("localtunnel");
const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ENABLE_PUBLIC_TUNNEL = process.env.PUBLIC_TUNNEL === "1";
const TUNNEL_SUBDOMAIN = (process.env.TUNNEL_SUBDOMAIN || "").trim();

app.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces();
  const localIps = [];

  Object.values(nets).forEach((entries) => {
    (entries || []).forEach((net) => {
      if (net.family === "IPv4" && !net.internal) {
        localIps.push(net.address);
      }
    });
  });

  console.log(`GoBees running on http://localhost:${PORT} 🐝`);
  if (localIps.length > 0) {
    console.log("Open from other computers on the same network:");
    [...new Set(localIps)].forEach((ip) => {
      console.log(`http://${ip}:${PORT}`);
    });
  }

  if (ENABLE_PUBLIC_TUNNEL) {
    (async () => {
      try {
        const tunnel = await localtunnel({
          port: PORT,
          ...(TUNNEL_SUBDOMAIN ? { subdomain: TUNNEL_SUBDOMAIN } : {})
        });

        console.log("Public URL (worldwide access):");
        console.log(tunnel.url);

        tunnel.on("error", (err) => {
          console.error("Tunnel error:", err?.message || err);
        });
      } catch (err) {
        console.error("Could not create public tunnel:", err?.message || err);
      }
    })();
  } else {
    console.log("To enable worldwide access, run with PUBLIC_TUNNEL=1");
  }
});
