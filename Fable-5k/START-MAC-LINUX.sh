#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 market-scan/server.py
