const fs = require("fs");
const path = require("path");
const { ScrapBCA } = require("../");
const { promisify } = require("util");

const rl = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question[promisify.custom] = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const questionAsync = promisify(rl.question).bind(rl);

const runScrapper = async () => {
  const username = await questionAsync("BCA Username: ");
  const password = await questionAsync("BCA Password: ");
  const today = new Date();
  const month = String(today.getMonth() + 1);
  const day = String(today.getDate());

  const scraper = new ScrapBCA(username, password, {
    headless: false,
  });

  // tglawal, blnawal, tglakhir, blnakhir
  const result = await scraper.getSettlement(day, month, day, month);

  return {
    currentTime: getCurrentTime(),
    result,
  };
};

const getCurrentTime = () => {
  const today = new Date();
  const hours = String(today.getHours()).padStart(2, "0");
  const minutes = String(today.getMinutes()).padStart(2, "0");
  return `Run on ${hours}:${minutes}`;
};

const appendToFile = (filePath, data) => {
  fs.appendFileSync(filePath, data + "\n");
};

const intervalMinutes = 5;
const resultFilePath = path.join(__dirname, "result.txt");

const runScrapperAndAppend = async () => {
  try {
    const { currentTime, result } = await runScrapper();
    const dataToAppend = `${currentTime}\n${JSON.stringify(result)}\n---\n`;
    appendToFile(resultFilePath, dataToAppend);
  } catch (error) {
    console.error("Error running scrapper:", error);
  }
};

runScrapperAndAppend();
setInterval(runScrapperAndAppend, intervalMinutes * 60 * 1000);
