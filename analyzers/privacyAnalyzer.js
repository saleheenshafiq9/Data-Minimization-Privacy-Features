const analyzePrivacyCompliance = (networkData) => {
  const violations = [];
  const warnings = [];

  const addPrivacyIssue = (category, detail, severity, policyReference) => {
      violations.push({
          category,
          detail,
          severity,
          policyReference,
          timestamp: new Date().toISOString(),
          relatedRequest: networkData.url
      });
  };

  const getHeaderValue = (headers, key) => headers[key] || "Not Provided";

  if (!networkData.url || ['.jpg', '.png', '.css', '.js', '.woff', '.ico'].some(ext => networkData.url.endsWith(ext))) {
      return;
  }

  const checkDataCollection = () => {
      const sensitiveDataPatterns = {
          location: /location|lat|long|coords/i,
          deviceInfo: /device|browser|hardware|platform/i,
          userActivity: /activity|behavior|interaction/i,
          personalInfo: /name|email|phone|address/i,
          searchHistory: /search|query|keywords/i,
          audioData: /audio|voice|sound/i
      };

      Object.entries(sensitiveDataPatterns).forEach(([type, pattern]) => {
          if (pattern.test(networkData.url) || pattern.test(JSON.stringify(networkData.requestHeaders))) {
              warnings.push({
                  category: 'Data Collection',
                  detail: `Collecting ${type} data - ensure user consent is obtained`,
                  reference: 'Section: Why Google Collects Data'
              });
          }
      });
  };

  const checkLocationData = () => {
      const locationIndicators = [
          getHeaderValue(networkData.requestHeaders, 'Geolocation'),
          getHeaderValue(networkData.requestHeaders, 'GPS'),
          networkData.url.includes('latitude'),
          networkData.url.includes('longitude'),
          getHeaderValue(networkData.requestHeaders, 'X-Forwarded-For')
      ];

      if (locationIndicators.some(indicator => indicator)) {
          addPrivacyIssue(
              'Location Data',
              'Location data being collected - verify user location settings consent',
              'HIGH',
              'Section: Your location information'
          );
      }
  };

  const checkThirdPartySharing = () => {
      const thirdPartyDomains = ['analytics', 'tracking', 'advertising', 'marketing', 'metrics'];

      if (thirdPartyDomains.some(domain => networkData.url.includes(domain))) {
          addPrivacyIssue(
              'Third-Party Sharing',
              'Data being shared with third-party services',
              'MEDIUM',
              'Section: When Google shares your information'
          );
      }
  };

  const checkSensitiveData = () => {
      const sensitivePatterns = {
          creditCard: /card|credit|payment/i,
          healthcare: /health|medical|treatment/i,
          biometric: /biometric|fingerprint|facial/i,
          government: /ssn|passport|license/i
      };

      Object.entries(sensitivePatterns).forEach(([type, pattern]) => {
          if (pattern.test(networkData.url) || pattern.test(JSON.stringify(networkData.requestHeaders))) {
              addPrivacyIssue(
                  'Sensitive Data',
                  `Potential ${type} data transmission detected`,
                  'HIGH',
                  'Section: When Google shares your information - With your consent'
              );
          }
      });
  };

  const checkSecurityMeasures = () => {
      if (!networkData.url.startsWith('https')) {
          addPrivacyIssue(
              'Security',
              'Insecure data transmission - HTTPS required',
              'HIGH',
              'Section: Keeping your information secure'
          );
      }

      const requiredHeaders = ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options'];

      requiredHeaders.forEach(header => {
          if (!networkData.responseHeaders[header]) {
              warnings.push({
                  category: 'Security Headers',
                  detail: `Missing security header: ${header}`,
                  reference: 'Section: Keeping your information secure'
              });
          }
      });
  };

  const checkDataRetention = () => {
      const cachingHeaders = getHeaderValue(networkData.responseHeaders, 'Cache-Control');
      const longCaching = cachingHeaders.includes('max-age=') && parseInt(cachingHeaders.split('max-age=')[1]) > 2592000; // 30 days

      if (longCaching) {
          warnings.push({
              category: 'Data Retention',
              detail: 'Long-term data caching detected',
              reference: 'Section: Retaining your information'
          });
      }
  };

  checkDataCollection();
  checkLocationData();
  checkThirdPartySharing();
  checkSensitiveData();
  checkSecurityMeasures();
  checkDataRetention();

  const privacyReport = {
      violations,
      warnings,
      timestamp: new Date().toISOString(),
      analyzedRequest: networkData.url,
      summary: {
          totalViolations: violations.length,
          totalWarnings: warnings.length,
          privacyRiskLevel: violations.length > 0 ? 'HIGH' : warnings.length > 0 ? 'MEDIUM' : 'LOW'
      }
  };

  chrome.storage.local.get({ privacyReports: [] }, (data) => {
      const reports = data.privacyReports;
      reports.push(privacyReport);

      if (reports.length > 50) reports.shift();

      chrome.storage.local.set({ privacyReports: reports });
  });

  return privacyReport;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "logNetworkResponse") {
      const privacyReport = analyzePrivacyCompliance(message.data.response);

      console.group('🔏 Privacy Policy Compliance Analysis');
      console.log('Analysis Timestamp:', privacyReport.timestamp);
      console.log('Analyzed Request:', privacyReport.analyzedRequest);
      console.log('Privacy Risk Level:', privacyReport.summary.privacyRiskLevel);

      if (privacyReport.violations.length > 0) {
          console.group('🚫 Privacy Violations');
          privacyReport.violations.forEach(v => {
              let severityLabel = v.severity === 'HIGH' ? '🔴 HIGH' : v.severity === 'MEDIUM' ? '🟠 MEDIUM' : '🟢 LOW';
              console.log(`${severityLabel} | ${v.category}: ${v.detail}`);
              console.log(`Reference: ${v.policyReference}`);
          });
          console.groupEnd();
      }

      if (privacyReport.warnings.length > 0) {
          console.group('⚠️ Privacy Warnings');
          privacyReport.warnings.forEach(w => {
              console.log(`${w.category}: ${w.detail}`);
          });
          console.groupEnd();
      }
      console.groupEnd();

      if (privacyReport.summary.privacyRiskLevel === 'HIGH') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "showWarningBox",
                category: "Privacy Violation",
                message: privacyReport.violations[0].detail,
                severity: "HIGH"
            });
        });
    }
    
  }
});
