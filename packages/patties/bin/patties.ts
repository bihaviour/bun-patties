#!/usr/bin/env bun
import { main } from "../src/cli/index.ts";

const code = await main(process.argv.slice(2));
if (code !== null) process.exit(code);
