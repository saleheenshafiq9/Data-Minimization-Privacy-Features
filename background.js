let API_KEY = "";

fetch(chrome.runtime.getURL("config.json"))
  .then(response => response.json())
  .then(config => {
    API_KEY = config.API_KEY;
  })
  .catch(error => console.error("[ERROR] Failed to load API Key:", error));


const SENSITIVITY_THRESHOLD = 75;
let currentController = null;

function removeInlineWarning() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const existingWarning = document.getElementById('inline-warning-box');
        if (existingWarning) existingWarning.remove();
      },
    });
  });
}

function showInlineWarning(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].url.startsWith('http')) return;

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (msg) => {
        if (document.getElementById('inline-warning-box')) return;

        const warningBox = document.createElement('div');
        warningBox.id = 'inline-warning-box';
        warningBox.style.position = 'fixed';
        warningBox.style.top = '10px';
        warningBox.style.right = '10px';
        warningBox.style.width = '30%';
        warningBox.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        warningBox.style.color = '#fff';
        warningBox.style.padding = '15px';
        warningBox.style.borderRadius = '8px';
        warningBox.style.zIndex = '10000';
        warningBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        warningBox.style.display = 'flex';
        warningBox.style.flexDirection = 'column';
        warningBox.style.alignItems = 'center';
        warningBox.style.justifyContent = 'center';

        const warningText = document.createElement('div');
        warningText.textContent = `⚠️ ${msg}`;
        warningText.style.textAlign = 'center';

        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.background = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '16px';
        closeButton.onclick = () => warningBox.remove();

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        clearButton.style.padding = '8px 12px';
        clearButton.style.marginTop = '10px';
        clearButton.style.backgroundColor = '#fff';
        clearButton.style.color = 'red';
        clearButton.style.border = 'none';
        clearButton.style.borderRadius = '5px';
        clearButton.style.cursor = 'pointer';
        clearButton.style.fontSize = '14px';
        clearButton.onclick = () => {
          chrome.runtime.sendMessage({ action: 'clearAddressBar' });
          warningBox.remove();
        };

        warningBox.appendChild(closeButton);
        warningBox.appendChild(warningText);
        warningBox.appendChild(clearButton);
        document.body.appendChild(warningBox);
      },
      args: [message],
    });
  });
}

function updateSuggestions(text, analysis, suggest) {
  const description = analysis.score > SENSITIVITY_THRESHOLD
    ? `⚠️ ${analysis.message} (Score: ${analysis.score})`
    : `✅ ${analysis.message} (Score: ${analysis.score})`;

  if (analysis.score > SENSITIVITY_THRESHOLD) {
    showInlineWarning(`Sensitive search detected! ${analysis.message}`);
  } else {
    removeInlineWarning();
  }

  suggest([{ content: text, description }]);
}

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  console.log('[DEBUG] Omnibox input:', text);

  if (!text || text.trim().length < 3) {
    removeInlineWarning();
    return;
  }

  try {
    if (currentController) currentController.abort();
    currentController = new AbortController();

    const analysis = await analyzeContent(text, currentController.signal);
    updateSuggestions(text, analysis, suggest);
  } catch (error) {
    console.error('[ERROR] Analysis failed:', error.message);
  }
});

chrome.omnibox.onInputEntered.addListener((text) => {
  console.log('[DEBUG] Executing search for:', text);
  chrome.tabs.create({ 
    url: `https://www.google.com/search?q=${encodeURIComponent(text)}` 
  });
});

async function analyzeContent(text, signal) {
  console.log('[DEBUG] Analyzing:', text);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    signal,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze text sensitivity and respond message should be less than 30 words and respond with JSON: {
            "score": 0-100,
            "message": "description",
            "risk": "high|medium|low"
          }`
        },
        { role: "user", content: text }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}`);
  }

  const data = await response.json();
  console.log('[DEBUG] API Response:', data);

  try {
    const result = JSON.parse(data.choices[0].message.content);
    if (typeof result.score !== 'number' || !result.message) {
      throw new Error('Invalid response format');
    }
    return result;
  } catch (error) {
    throw new Error('Error parsing API response');
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const requestData = {
      url: details.url,
      method: details.method,
      requestBody: details.requestBody,
      timeStamp: details.timeStamp,
      type: details.type,
      initiator: details.initiator
    };
    
    // Store request data to match with response later
    chrome.storage.local.set({ [`request_${details.requestId}`]: requestData });
    
    console.log("📤 Request Details:", requestData);
  },
  { urls: ["*://www.google.com/*"] },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const requestHeaders = details.requestHeaders.reduce((acc, header) => {
      acc[header.name] = header.value;
      return acc;
    }, {});
    
    // Store headers
    chrome.storage.local.set({ [`headers_${details.requestId}`]: requestHeaders });
    
    console.log("📋 Request Headers:", requestHeaders);
  },
  { urls: ["*://www.google.com/*"] },
  ["requestHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // Get the stored request data
    const requestData = await chrome.storage.local.get(`request_${details.requestId}`);
    const headerData = await chrome.storage.local.get(`headers_${details.requestId}`);
    
    const responseData = {
      url: details.url,
      statusCode: details.statusCode,
      ip: details.ip || "Unknown IP",
      responseHeaders: details.responseHeaders?.reduce((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {}),
      method: details.method,
      timeStamp: details.timeStamp,
      type: details.type,
      fromCache: details.fromCache,
      request: requestData[`request_${details.requestId}`],
      requestHeaders: headerData[`headers_${details.requestId}`]
    };

    // Clean up stored data
    chrome.storage.local.remove([
      `request_${details.requestId}`,
      `headers_${details.requestId}`
    ]);
    
    // Get cookies
    const cookies = await chrome.cookies.getAll({ domain: "www.google.com" });
    
    // Combine all data
    const fullNetworkData = {
      response: responseData,
      cookies: cookies
    };

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "logNetworkResponse",
          data: fullNetworkData
        });
      }
    });
  },
  { urls: ["*://www.google.com/*"] },
  ["responseHeaders"]
);


chrome.cookies.getAll({ domain: "www.google.com" }, (cookies) => {
  chrome.storage.local.set({ googleCookies: cookies }, () => {
    console.log("Cookies stored in local storage for content script.");
  });
});

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
              console.log(`${v.category}: ${v.detail}`);
              console.log(`Reference: ${v.policyReference}`);

              // 🔴 Send a message to the content script to show warning
              if (v.severity === "HIGH") {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                      chrome.tabs.sendMessage(tabs[0].id, {
                          action: "showPrivacyWarning",
                          message: `⚠️ Privacy Violation: ${v.detail}`
                      });
                  });
              }
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
  }
});
