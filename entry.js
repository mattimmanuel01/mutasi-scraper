const fs = require("fs");
const path = require("path");
const { ScrapBCA } = require("./");

const runScrapper = async (username, password) => {
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

const resultFilePath = path.join(__dirname, "result.txt");

const runScrapperAndAppend = async () => {
  try {
    const username = process.argv[2];
    const password = process.argv[3];

    const { currentTime, result } = await runScrapper(username, password);
    const dataToAppend = `${currentTime}\n${JSON.stringify(result)}\n---\n`;
    appendToFile(resultFilePath, dataToAppend);
  } catch (error) {
    console.error("Error running scrapper:", error);
  }
};

runScrapperAndAppend();
