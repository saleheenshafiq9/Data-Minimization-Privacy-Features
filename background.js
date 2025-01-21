chrome.runtime.onInstalled.addListener(() => {
  console.log("Data Minimization Privacy Extension installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === "keepAlive") {
    sendResponse({ status: "alive" });
  }
});
