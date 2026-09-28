#!/usr/bin/env node
import { buildServer } from './registry';

const server = buildServer();
await server.run();