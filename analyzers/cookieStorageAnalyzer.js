chrome.storage.local.get("googleCookies", (data) => {
    console.log("Stored Cookies:", data.googleCookies);
  });
  
  console.log("Local Storage Data:", localStorage);
  
  chrome.storage.local.get("googleCookies", (cookieData) => {
    const localStorageData = { ...localStorage };
    
    chrome.runtime.sendMessage({
      action: "analyzePrivacyData",
      data: {
        cookies: cookieData,
        localStorage: localStorageData
      }
    });
  });

const analyzeStoragePrivacy = (storageData) => {
    const findings = [];
    const insights = [];
    
    const addFinding = (category, detail, importance, privacyReference) => {
      findings.push({
        category,
        detail,
        importance,
        privacyReference,
        timestamp: new Date().toISOString()
      });
    };
  
    const analyzeCookies = (cookies) => {
      if (!cookies || !cookies.googleCookies) return;
      
      const cookieTypes = {
        preferences: ['PREF', 'NID', 'CONSENT'],
        security: ['SID', 'HSID', 'SSID'],
        analytics: ['_ga', '_gid', '__utma'],
        advertising: ['IDE', 'ANID', 'DV']
      };
  
      Object.entries(cookieTypes).forEach(([category, patterns]) => {
        const matches = Object.keys(cookies.googleCookies)
          .filter(name => patterns.some(pattern => name.includes(pattern)));
        
        if (matches.length > 0) {
          addFinding(
            'Cookie Usage',
            `Found ${category} related cookies: ${matches.join(', ')}`,
            'INFO',
            'Privacy Policy: We use various technologies to collect and store information, including cookies'
          );
        }
      });
    };
  
    const analyzeLocalStorage = (storage) => {
      const sensitivePatterns = [
        'preference',
        'setting',
        'id',
        'token',
        'session'
      ];
  
      Object.keys(storage).forEach(key => {
        const matchedPattern = sensitivePatterns.find(pattern => 
          key.toLowerCase().includes(pattern)
        );
  
        if (matchedPattern) {
          addFinding(
            'Local Storage',
            `Found item related to ${matchedPattern}: ${key}`,
            'INFO',
            'Privacy Policy: Browser web storage or application data caches'
          );
        }
      });
    };
  
    const addPrivacyControls = () => {
      insights.push({
        category: 'Privacy Controls',
        details: [
          {
            tool: 'Privacy Checkup',
            url: 'https://myaccount.google.com/privacycheckup',
            description: 'Review and adjust your privacy settings'
          },
          {
            tool: 'Activity Controls',
            url: 'https://myaccount.google.com/activitycontrols',
            description: 'Manage what information Google saves about your activity'
          },
          {
            tool: 'Ad Settings',
            url: 'https://adssettings.google.com',
            description: 'Control how Google personalizes ads for you'
          }
        ]
      });
    };
  
    analyzeCookies(storageData.cookies);
    analyzeLocalStorage(storageData.localStorage);
    addPrivacyControls();
  
    return {
      findings,
      insights,
      timestamp: new Date().toISOString(),
      summary: {
        totalFindings: findings.length,
        categories: [...new Set(findings.map(f => f.category))],
        privacyControlsAvailable: insights.length
      }
    };
  };
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzePrivacyData") {
      const privacyReport = analyzeStoragePrivacy({
        cookies: message.data.cookies,
        localStorage: message.data.localStorage
      });
      
      console.group('📊 Privacy Data Analysis');
      console.log('Analysis Timestamp:', privacyReport.timestamp);
      console.log('Categories Found:', privacyReport.summary.categories);
      
      if (privacyReport.findings.length > 0) {
        console.group('📌 Findings');
        privacyReport.findings.forEach(f => {
          console.log(`${f.category}: ${f.detail}`);
          console.log(`Reference: ${f.privacyReference}`);
        });
        console.groupEnd();
      }
      
      if (privacyReport.insights.length > 0) {
        console.group('🛡️ Privacy Controls');
        privacyReport.insights.forEach(i => {
          console.log('Category:', i.category);
          i.details.forEach(d => {
            console.log(`- ${d.tool}: ${d.description}`);
            console.log(`  URL: ${d.url}`);
          });
        });
        console.groupEnd();
      }
      console.groupEnd();
    }
  });