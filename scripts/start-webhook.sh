#!/bin/bash

# Start Instantly webhook server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
WEBHOOK_SCRIPT="$WORKSPACE_DIR/webhooks/instantly-webhook.js"
PID_FILE="/tmp/instantly-webhook.pid"
LOG_FILE="/tmp/instantly-webhook.log"

# Load .env file if it exists
if [ -f "$WORKSPACE_DIR/.env" ]; then
  export $(cat "$WORKSPACE_DIR/.env" | grep -v '^#' | xargs)
fi

case "$1" in
  start)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "Webhook is already running (PID: $PID)"
        exit 1
      fi
    fi
    
    echo "Starting Instantly webhook..."
    nohup node "$WEBHOOK_SCRIPT" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    
    if ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
      echo "✅ Webhook started (PID: $(cat "$PID_FILE"))"
      echo "Logs: tail -f $LOG_FILE"
    else
      echo "❌ Failed to start webhook"
      cat "$LOG_FILE"
      exit 1
    fi
    ;;
    
  stop)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping webhook (PID: $PID)..."
        kill "$PID"
        rm "$PID_FILE"
        echo "✅ Webhook stopped"
      else
        echo "Webhook not running (stale PID file)"
        rm "$PID_FILE"
      fi
    else
      echo "Webhook not running"
    fi
    ;;
    
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
    
  status)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Webhook is running (PID: $PID)"
        echo "Health check:"
        curl -s http://localhost:3500/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3500/health
      else
        echo "❌ Webhook not running (stale PID file)"
      fi
    else
      echo "❌ Webhook not running"
    fi
    ;;
    
  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -f "$LOG_FILE"
    else
      echo "No log file found"
    fi
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
