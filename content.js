let API_KEY = "";

fetch(chrome.runtime.getURL("config.json"))
  .then(response => response.json())
  .then(config => {
    API_KEY = config.API_KEY;
  })
  .catch(error => console.error("[ERROR] Failed to load API Key:", error));

  const SENSITIVITY_THRESHOLD = 75;

  function showWarningBox(category, message, severity) {
    let existingWarning = document.getElementById("privacy-warning-box");
    if (existingWarning) existingWarning.remove();

    let warningBox = document.createElement("div");
    warningBox.id = "privacy-warning-box";
    warningBox.style.position = "fixed";
    warningBox.style.top = "10px";
    warningBox.style.right = "10px";
    warningBox.style.width = "30%";
    warningBox.style.backgroundColor = severity === "HIGH" ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 165, 0, 0.9)";
    warningBox.style.color = "white";
    warningBox.style.padding = "15px";
    warningBox.style.borderRadius = "8px";
    warningBox.style.zIndex = "10000";
    warningBox.style.textAlign = "center";
    warningBox.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    
    let warningText = document.createElement("div");
    warningText.innerHTML = `<strong>${category}</strong>: ${message}`;
    warningText.style.marginBottom = "10px";
    
    let closeButton = document.createElement("button");
    closeButton.textContent = "✖";
    closeButton.style.position = "absolute";
    closeButton.style.top = "5px";
    closeButton.style.right = "10px";
    closeButton.style.background = "transparent";
    closeButton.style.color = "white";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "16px";
    closeButton.style.cursor = "pointer";

    closeButton.addEventListener("click", () => {
        warningBox.remove();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            warningBox.remove();
        }
    });

    warningBox.appendChild(closeButton);
    warningBox.appendChild(warningText);
    document.body.appendChild(warningBox);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "showWarningBox") {
        showWarningBox(message.category, message.message, message.severity);
    }
});

let clearButton = document.createElement("button");
clearButton.textContent = "Clear";
clearButton.style.position = "relative";
clearButton.style.marginTop = "10px";
clearButton.style.padding = "10px";
clearButton.style.backgroundColor = "White";
clearButton.style.color = "red";
clearButton.style.border = "none";
clearButton.style.fontSize = "14px";
clearButton.style.borderRadius = "5px";
clearButton.style.cursor = "pointer";
clearButton.style.display = "none";

document.body.appendChild(clearButton);

let fullText = "";
const warningBox = document.createElement("div");
warningBox.style.position = "fixed";
warningBox.style.top = "10px";
warningBox.style.right = "10px";
warningBox.style.width = "25%";
warningBox.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
warningBox.style.color = "white";
warningBox.style.padding = "15px";
warningBox.style.borderRadius = "8px";
warningBox.style.zIndex = "10000";
warningBox.style.textAlign = "center";
warningBox.style.display = "none";
warningBox.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";

document.body.appendChild(warningBox);

function showInlineWarning(message, recommendation) {
  warningBox.innerHTML = "";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✖";
  closeButton.style.position = "absolute";
  closeButton.style.top = "5px";
  closeButton.style.right = "10px";
  closeButton.style.background = "transparent";
  closeButton.style.color = "white";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "16px";
  closeButton.style.cursor = "pointer";

  closeButton.addEventListener("click", () => {
    warningBox.style.display = "none";
    clearButton.style.display = "none";
  });

  const warningText = document.createElement("div");
  warningText.textContent = `Warning: ${message}`;
  warningText.style.marginTop = "10px";

  const recommendationText = document.createElement("div");
  recommendationText.textContent = `${recommendation}`;
  recommendationText.style.marginTop = "10px";

  const lineBreak = document.createElement("br");

  warningBox.appendChild(closeButton); 
  warningBox.appendChild(warningText); 
  warningBox.appendChild(lineBreak);
  warningBox.appendChild(recommendationText);
  warningBox.appendChild(lineBreak); 
  warningBox.appendChild(clearButton); 

  warningBox.style.display = "block";
  clearButton.style.display = "inline-block";
}


async function analyzeSensitivity(text) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze text sensitivity and respond message should be less than 30 words. Give recommendation like which words to remove less than 15 words. Respond with valid JSON: { "score": 0-100, "message": "description", "recommendation": "suggest" }`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    if (result.score > SENSITIVITY_THRESHOLD) {
      showInlineWarning(result.message, result.recommendation);
    } else {
      warningBox.style.display = "none";
      clearButton.style.display = "none";
    }

    return result;
  } catch (error) {
    console.error("Error analyzing sensitivity:", error);
  }
}

clearButton.addEventListener("click", () => {
  const searchBox = document.querySelector('input, textarea, [contenteditable="true"]');
  if (searchBox) {
    searchBox.value = "";
    warningBox.style.display = "none";
    clearButton.style.display = "none";
  }
});

document.addEventListener("keydown", async (event) => {
  const searchBox = document.querySelector("input[name='q']");

  if (event.key === "Backspace") {
    fullText = fullText.slice(0, -1);
  } else if (event.key.length === 1) {
    fullText += event.key;
  }
if(fullText.length>3){
  await analyzeSensitivity(fullText);
}
});