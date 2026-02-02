#!/bin/bash
# Monitor for next lead and validate all fixes

LAST_RUN_ID="21594311936"  # Starr report (before fixes)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 MONITORING FOR NEXT LEAD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Last processed lead: Starr, Begin & King (14:37:35)"
echo "Time: $(date)"
echo ""
echo "Checking every 30 seconds..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
    # Check for new runs
    LATEST=$(curl -s "https://api.github.com/repos/Fardeen-MM/mortar-reports/actions/runs?per_page=5" | \
        python3 -c "
import sys, json
runs = json.load(sys.stdin)['workflow_runs']
lead_runs = [r for r in runs if 'Process Interested Lead' in r['name']]
if lead_runs:
    print(lead_runs[0]['id'])
else:
    print('none')
" 2>/dev/null)
    
    if [ "$LATEST" != "none" ] && [ "$LATEST" != "$LAST_RUN_ID" ]; then
        echo ""
        echo "🚨 NEW LEAD DETECTED!"
        echo "Run ID: $LATEST"
        echo ""
        
        # Get details
        curl -s "https://api.github.com/repos/Fardeen-MM/mortar-reports/actions/runs/$LATEST" | \
            python3 -c "
import sys, json
from datetime import datetime
r = json.load(sys.stdin)
print(f\"Started: {r['created_at'][11:19]}\")
print(f\"Status: {r['status']}\")
print(f\"Branch: {r['head_sha'][:7]}\")
print(f\"URL: {r['html_url']}\")
" 2>/dev/null
        
        echo ""
        echo "✅ New lead processing started!"
        echo "Monitor at: https://github.com/Fardeen-MM/mortar-reports/actions/runs/$LATEST"
        echo ""
        break
    fi
    
    # Show heartbeat
    echo -n "."
    sleep 30
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 MONITORING COMPLETE - New lead detected"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
