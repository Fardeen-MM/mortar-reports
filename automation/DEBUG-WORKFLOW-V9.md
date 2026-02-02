# Debug V9 Workflow Failure

## Add This Debug Step to Workflow

Add this BEFORE the "Generate report" step in `.github/workflows/process-interested-lead.yml`:

```yaml
- name: Debug V9 Environment
  run: |
    echo "=== DEBUG V9 ==="
    echo "Node version:"
    node --version
    
    echo ""
    echo "Files in automation:"
    ls -la
    
    echo ""
    echo "V9 files exist?"
    ls -la report-generator-v9.js report-v9-css.js
    
    echo ""
    echo "Research file:"
    REPORT_FILE=$(find reports -name "*-intel-v5.json" -o -name "*-research.json" -type f | head -1)
    echo "Found: $REPORT_FILE"
    ls -lh "$REPORT_FILE"
    
    echo ""
    echo "Research data structure:"
    node -e "const d=require('./$REPORT_FILE'); console.log('firmName:', d.firmName); console.log('location:', d.location); console.log('competitors:', d.competitors?.length || 0); console.log('gaps type:', Array.isArray(d.gaps) ? 'array' : typeof d.gaps);"
    
    echo ""
    echo "Test V9 load:"
    node -e "const g=require('./report-generator-v9.js'); console.log('✅ Module loads');" || echo "❌ Module failed to load"
    
    echo ""
    echo "Test CSS load:"
    node -e "const c=require('./report-v9-css.js'); const r=c(); console.log('✅ CSS loaded, length:', r.length);" || echo "❌ CSS failed to load"
    
    echo ""
    echo "Contact name:"
    echo "${{ steps.parse.outputs.contact_name }}"
  working-directory: ./automation
```

## Then Share Output

Run the workflow again and share:
1. The debug output
2. The actual error message from "Generate report" step

This will show exactly what's happening in the Actions environment.
