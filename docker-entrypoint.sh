#!/bin/sh
set -e

pnpm db:migrate
exec pnpm dev --host 0.0.0.0
