module.exports = {
  apps: [
    {
      name: "writing-helper",
      cwd: "/Users/seunghyeonmaegmini/writing-helper",
      script: "npm",
      args: "run start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
