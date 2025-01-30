const analyzeToSCompliance = (networkData) => {
  const violations = [];
  const warnings = [];

  const addViolation = (category, detail, severity, tosReference) => {
      violations.push({
          category,
          detail,
          severity,
          tosReference,
          timestamp: new Date().toISOString(),
          relatedRequest: networkData.url
      });
  };

  const getHeaderValue = (headers, key) => headers[key] || "Not Provided";

  if (!networkData.url || ['.jpg', '.png', '.css', '.js', '.woff', '.ico'].some(ext => networkData.url.endsWith(ext))) {
      return;
  }

  const checkAutomatedAccess = () => {
      const robotsHeaders = getHeaderValue(networkData.requestHeaders, 'User-Agent').toLowerCase();
      const isAutomatedRequest = robotsHeaders.includes('bot') || robotsHeaders.includes('crawler');

      if (isAutomatedRequest) {
          addViolation(
              'Automated Access',
              'Potential automated access detected through User-Agent',
              'HIGH',
              "Section: Don't abuse our services - using automated means to access content"
          );
      }
  };

  const checkAPIAbuse = () => {
      const suspiciousEndpoints = ['/training/', '/scrape/', '/bulk/', '/mass/'];

      if (suspiciousEndpoints.some(endpoint => networkData.url.includes(endpoint))) {
          addViolation(
              'API Abuse',
              'Accessing endpoints typically associated with bulk data collection',
              'MEDIUM',
              "Section: Don't abuse our services - accessing or using our services in fraudulent or deceptive ways"
          );
      }
  };

  const checkContentExtraction = () => {
      const suspiciousPatterns = [
          networkData.url.includes('/download/all'),
          networkData.url.includes('format=json'),
          networkData.url.includes('output=xml'),
          getHeaderValue(networkData.requestHeaders, 'Accept').includes('application/json')
      ];

      if (suspiciousPatterns.some(pattern => pattern)) {
          warnings.push({
              category: 'Content Extraction',
              detail: 'Potential systematic content extraction detected',
              reference: "Section: Permission to use your content"
          });
      }
  };

  const checkReverseEngineering = () => {
      const suspiciousHeaders = ['X-Debug', 'X-Debug-Mode', 'X-Debug-Token'];

      const hasDebugHeaders = suspiciousHeaders.some(header => networkData.requestHeaders[header]);

      if (hasDebugHeaders) {
          addViolation(
              'Reverse Engineering',
              'Debug headers detected that might indicate reverse engineering attempts',
              'HIGH',
              "Section: Don't abuse our services - reverse engineering our services"
          );
      }
  };

  const checkAITraining = () => {
      const mlPatterns = ['/train/', '/dataset/', '/corpus/', '/collect/', '/batch/'];

      if (mlPatterns.some(pattern => networkData.url.includes(pattern))) {
          addViolation(
              'AI Training',
              'Pattern suggesting AI model training activity detected',
              'HIGH',
              "Section: Don't abuse our services - using AI-generated content to develop machine learning models"
          );
      }
  };

  const analyzeResponsePatterns = () => {
      const responseSize = parseInt(getHeaderValue(networkData.responseHeaders, 'content-length'), 10);
      const responseType = getHeaderValue(networkData.responseHeaders, 'content-type');

      if (responseSize > 10000000) {
          warnings.push({
              category: 'Bulk Download',
              detail: 'Large response size might indicate bulk data collection',
              reference: "Section: Don't abuse our services"
          });
      }
  };

  checkAutomatedAccess();
  checkAPIAbuse();
  checkContentExtraction();
  checkReverseEngineering();
  checkAITraining();
  analyzeResponsePatterns();

  const complianceReport = {
      violations,
      warnings,
      timestamp: new Date().toISOString(),
      analyzedRequest: networkData.url,
      summary: {
          totalViolations: violations.length,
          totalWarnings: warnings.length,
          riskLevel: violations.length > 0 ? 'HIGH' : warnings.length > 0 ? 'MEDIUM' : 'LOW'
      }
  };

  chrome.storage.local.get({ tosReports: [] }, (data) => {
      const reports = data.tosReports;
      reports.push(complianceReport);

      if (reports.length > 50) reports.shift();

      chrome.storage.local.set({ tosReports: reports });
  });

  return complianceReport;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "logNetworkResponse") {
      const complianceReport = analyzeToSCompliance(message.data.response);

      console.group('🔍 ToS Compliance Analysis');
      console.log('Analysis Timestamp:', complianceReport.timestamp);
      console.log('Analyzed Request:', complianceReport.analyzedRequest);
      console.log('Risk Level:', complianceReport.summary.riskLevel);

      if (complianceReport.violations.length > 0) {
          console.group('⚠️ Violations');
          complianceReport.violations.forEach(v => {
              let severityLabel = v.severity === 'HIGH' ? '🔴 HIGH' : v.severity === 'MEDIUM' ? '🟠 MEDIUM' : '🟢 LOW';
              console.log(`${severityLabel} | ${v.category}: ${v.detail}`);
              console.log(`Reference: ${v.tosReference}`);
          });
          console.groupEnd();
      }

      if (complianceReport.warnings.length > 0) {
          console.group('⚠️ Warnings');
          complianceReport.warnings.forEach(w => {
              console.log(`${w.category}: ${w.detail}`);
          });
          console.groupEnd();
      }
      console.groupEnd();

      if (complianceReport.summary.riskLevel === 'HIGH') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "showWarningBox",
                category: "ToS Violation",
                message: complianceReport.violations[0].detail,
                severity: "HIGH"
            });
        });
    }
    
  }
});
