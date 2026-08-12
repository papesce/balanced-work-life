#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8001}"

exec vllm-mlx serve mlx-community/Qwen3-Coder-30B-A3B-Instruct-8bit --port "$PORT" --enable-auto-tool-choice --tool-call-parser qwen --continuous-batching --host 127.0.0.1
