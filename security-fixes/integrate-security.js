#!/usr/bin/env node
console.log("Security Integration Guide");
const crypto = require("crypto");
console.log("\n🔑 Generated Secure Tokens:\n");
console.log("DEV_DEBUG_TOKEN=" + crypto.randomBytes(32).toString("hex"));
console.log("SESSION_SECRET=" + crypto.randomBytes(32).toString("hex"));
