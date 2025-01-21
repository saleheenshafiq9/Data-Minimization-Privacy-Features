// Add a "Clear" button
let clearButton = document.createElement("button");
clearButton.textContent = "Clear";
clearButton.style.position = "fixed";
clearButton.style.bottom = "10px";
clearButton.style.right = "10px";
clearButton.style.padding = "10px";
clearButton.style.backgroundColor = "red";
clearButton.style.color = "white";
clearButton.style.border = "none";
clearButton.style.fontSize = "14px";
clearButton.style.borderRadius = "5px";
clearButton.style.cursor = "pointer";
clearButton.style.zIndex = "100000";
clearButton.style.display = "none"; // Initially hidden
document.body.appendChild(clearButton);

let fullText = ""; // Keeps track of the full text typed
const sensitivityThreshold = 50; // Sensitivity threshold for triggering notifications

// Create and style the red warning box
let redBox = document.createElement("div");
redBox.style.position = "fixed";
redBox.style.bottom = "50px";
redBox.style.right = "10px";
redBox.style.padding = "10px";
redBox.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
redBox.style.color = "white";
redBox.style.fontSize = "16px";
redBox.style.borderRadius = "5px";
redBox.style.zIndex = "100000";
redBox.style.display = "none"; // Initially hidden
document.body.appendChild(redBox);

// Function to initialize fullText with the Google search box content
function initializeGoogleSearchBox() {
  const searchBox = document.querySelector("input[name='q']"); // Google search box
  if (searchBox) {
    fullText = searchBox.value; // Initialize fullText with current value

    // Listen for input events to dynamically update fullText
    searchBox.addEventListener("input", () => {
      fullText = searchBox.value;
    });

    // Add functionality to clear the search box and remove red box when the button is clicked
    clearButton.addEventListener("click", () => {
      searchBox.value = ""; // Clear the search box value
      searchBox.dispatchEvent(new Event("input", { bubbles: true })); // Trigger input event
      searchBox.dispatchEvent(new Event("change", { bubbles: true })); // Trigger change event

      fullText = ""; // Reset fullText
      redBox.style.display = "none"; // Hide the red box
      clearButton.style.display = "none"; // Hide the "Clear" button
    });
  }
}

// Function to send text to OpenAI API and get the sensitivity score
async function analyzeSensitivity(text) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer API_KEY` // Replace with your OpenAI API key
      },
      body: JSON.stringify({
        model: "gpt-4", // Replace with the desired model (e.g., gpt-3.5-turbo)
        messages: [
          {
            role: "system",
            content: "You are an assistant that evaluates text sensitivity on a scale of 0 to 100. If the score is above 50, provide a list of sensitive words or phrases and a notification message. Respond in JSON format: {\"sensitivityScore\": number, \"notification\": string}."
          },
          {
            role: "user",
            content: `Evaluate the sensitivity of the following text: "${text}".`
          }
        ],
        max_tokens: 50, // Allows for a short response
        temperature: 0 // Ensure deterministic output
      })
    });

    const data = await response.json();
    console.log("Raw API Response:", data.choices[0].message.content);

    // Parse the JSON response returned by the API
    const parsedOutput = JSON.parse(data.choices[0].message.content);
    console.log("Parsed Output:", parsedOutput);

    return {
      sensitivityScore: parsedOutput.sensitivityScore || 0,
      notification: parsedOutput.notification || ""
    };
  } catch (error) {
    console.error("Error analyzing sensitivity:", error);
    return null;
  }
}

// Function to handle sensitivity-based notifications
function showRedBox(score, notification) {
  if (score > sensitivityThreshold) {
    redBox.style.display = "block"; // Show the red box
    redBox.textContent = `Warning: ${notification}`; // Display the notification
    clearButton.style.display = "block"; // Show the "Clear" button
  } else {
    redBox.style.display = "none"; // Hide the red box
    clearButton.style.display = "none"; // Hide the "Clear" button
  }
}

// Initialize Google search box content on page load
initializeGoogleSearchBox();

// Listen for keydown events to update fullText dynamically
document.addEventListener("keydown", async (event) => {
  const searchBox = document.querySelector("input[name='q']"); // Google search box

  if (event.key === "Backspace") {
    // Handle backspace: remove the last character from both the search box and fullText
    fullText = fullText.slice(0, -1);
    if (searchBox) searchBox.value = fullText;

    // Hide red box and clear button when backspace is pressed
    redBox.style.display = "none";
    clearButton.style.display = "none";
  } else if (event.key.length === 1) {
    // Append character to fullText and update the search box
    fullText += event.key;
    if (searchBox) searchBox.value = fullText;
  }

  // Trigger sensitivity analysis on specific characters
  if (event.key === " " || [".", "?", ";", "!"].includes(event.key)) {
    const result = await analyzeSensitivity(fullText);
    if (result !== null) {
      console.log(`Sensitivity Score: ${result.sensitivityScore}`);
      showRedBox(result.sensitivityScore, result.notification); // Show red box based on result
    }
  }
});
