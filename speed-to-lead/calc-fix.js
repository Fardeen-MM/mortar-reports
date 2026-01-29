// Fixed calculator code
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded');
  
  // Get all elements
  const inquiries = document.getElementById('inquiries');
  const afterHours = document.getElementById('afterHours');
  const responseTime = document.getElementById('responseTime');
  const conversion = document.getElementById('conversion');
  const caseValue = document.getElementById('caseValue');
  const marketingSpend = document.getElementById('marketingSpend');
  
  const toggles = document.querySelectorAll('.toggle-switch');
  console.log('Found elements:', {
    inquiries: !!inquiries,
    toggles: toggles.length
  });

  // Initialize service values
  const serviceValues = {};
  toggles.forEach(toggle => {
    const service = toggle.dataset.service;
    const value = parseFloat(toggle.dataset.value);
    serviceValues[service] = { value, active: true };
  });
  
  console.log('Service values:', serviceValues);

  // Format currency helper
  function formatCurrency(num) {
    return '$' + Math.round(num).toLocaleString();
  }

  // Main calculation function
  function calculate() {
    const inq = parseInt(inquiries.value);
    const afterHoursPct = parseInt(afterHours.value);
    const respTime = parseInt(responseTime.value);
    const conv = parseInt(conversion.value) / 100;
    const val = parseInt(caseValue.value);
    const spend = parseInt(marketingSpend.value);

    // Update all displays
    document.getElementById('inquiriesDisplay').textContent = inq;
    document.getElementById('afterHoursDisplay').textContent = afterHoursPct + '%';
    document.getElementById('responseTimeDisplay').textContent = respTime + (respTime === 1 ? ' hour' : ' hours');
    document.getElementById('conversionDisplay').textContent = Math.round(conv * 100) + '%';
    document.getElementById('caseValueDisplay').textContent = formatCurrency(val);
    document.getElementById('marketingSpendDisplay').textContent = formatCurrency(spend);

    // Calculate current revenue
    const currentClients = inq * conv;
    const currentRevenue = currentClients * val;
    
    const currentRevenueEl = document.getElementById('currentRevenue');
    const currentRevenue2El = document.getElementById('currentRevenue2');
    if (currentRevenueEl) currentRevenueEl.textContent = formatCurrency(currentRevenue);
    if (currentRevenue2El) currentRevenue2El.textContent = formatCurrency(currentRevenue);

    // Calculate projected revenue from active services
    let projectedRevenue = 0;
    Object.values(serviceValues).forEach(service => {
      if (service.active) projectedRevenue += service.value;
    });
    
    projectedRevenue = Math.max(projectedRevenue, currentRevenue);

    // Update projected revenue display
    document.getElementById('projectedRevenue').textContent = formatCurrency(projectedRevenue);

    // Calculate breakdown
    const monthlyIncrease = projectedRevenue - currentRevenue;
    const yearlyIncrease = monthlyIncrease * 12;
    const newClients = val > 0 ? (monthlyIncrease / val) : 0;

    document.getElementById('monthlyIncrease').textContent = formatCurrency(monthlyIncrease);
    document.getElementById('yearlyIncrease').textContent = formatCurrency(yearlyIncrease);
    document.getElementById('newClients').textContent = newClients.toFixed(1);

    // Calculate ROI
    const ourCost = 2500;
    const netGain = monthlyIncrease - ourCost;
    const rawROI = netGain > 0 ? ((netGain / ourCost) * 100) : 0;
    const roi = Math.min(rawROI, 600).toFixed(0);
    document.getElementById('roiValue').textContent = roi + '%';
    
    console.log('Calculated:', {
      currentRevenue,
      projectedRevenue,
      monthlyIncrease,
      newClients,
      roi
    });
  }

  // Add toggle click handlers
  toggles.forEach(toggle => {
    toggle.style.cursor = 'pointer';
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const service = this.dataset.service;
      this.classList.toggle('active');
      serviceValues[service].active = this.classList.contains('active');
      
      console.log('Toggle clicked:', service, serviceValues[service].active);
      calculate();
    });
  });

  // Add slider event listeners
  inquiries.addEventListener('input', calculate);
  afterHours.addEventListener('input', calculate);
  responseTime.addEventListener('input', calculate);
  conversion.addEventListener('input', calculate);
  caseValue.addEventListener('input', calculate);
  marketingSpend.addEventListener('input', calculate);

  // Run initial calculation
  calculate();
  
  console.log('Calculator initialized');
});
