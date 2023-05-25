const fs = require("fs");
const path = require("path");
const { ScrapBCA } = require("./");
const mysql = require("mysql");
const moment = require("moment");
const crypto = require("crypto");

function generateMD5Hash(data) {
  const hash = crypto.createHash("md5").update(data).digest("hex");
  return hash;
}

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

    await insertIntoDb(result);
  } catch (error) {
    console.error("Error running scrapper:", error);
  }
};

const insertIntoDb = async (data) => {
  try {
    if (!data.accountNo) {
      return;
    }

    // MySQL database connection configuration
    const connection = mysql.createConnection({
      host: "103.120.64.81",
      user: "cdauto",
      password: "Pr0sesOtomatis1",
      database: "buana_cs",
    });
    // Connect to the MySQL server
    connection.connect();
    const transactions = data.transactions.slice(1); // Ignore the first transaction

    for (const transaction of transactions) {
      const { tanggal, keterangan, mutasi, saldoakhir } = transaction;

      const formattedDate = moment(tanggal, "DD/MM").format(
        "YYYY-MM-DD HH:mm:ss"
      );
      const keteranganNoName = keterangan.replace(transaction.nama, "");
      const convertedAmount = transaction.mutasi.replace(/,/g, "");

      const keteranganNoNameNoMutasi = keteranganNoName.replace(
        convertedAmount,
        "[ToBeRemoved]"
      );

      const regexPattern = /(TRSF E-BANKING CR)(.*?)\[ToBeRemoved\](.*)/;
      const [, transactionCode, invoiceNumber, description] =
        keteranganNoNameNoMutasi.match(regexPattern);

      if (
        !transactionCode.includes("CR") ||
        keterangan.includes("BUNGA") ||
        keterangan.includes("INTEREST")
      ) {
        continue;
      }
      console.log("e");

      const amount = parseFloat(mutasi.replace(/,/g, ""));
      const balance = parseFloat(saldoakhir.replace(/,/g, ""));

      const currentDate = new Date();
      const crawldate = moment(currentDate).format("YYYY-MM-DD");
      const unixTime = Math.floor(currentDate.getTime() / 1000);

      const dataToHash =
        String(data.bank) +
        String(data.type) +
        String(amount) +
        String(data.transid) +
        String(balance);

      const md5Hash = generateMD5Hash(dataToHash);
      console.log(md5Hash);
      // Check if the MD5 hash already exists in the database
      const query = "SELECT md5 FROM bilo_mutasi_bank WHERE md5 = ?";
      const results = await new Promise((resolve, reject) => {
        connection.query(query, [md5Hash], (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        });
      });

      if (results.length > 0) {
        console.log(
          "Record with the same MD5 hash already exists. Skipping insertion."
        );
        continue;
      }

      const record = {
        bank: "BCA",
        bankid: "BCA",
        transid: `BCA~  ${transactionCode}\n${invoiceNumber}\n${convertedAmount}\n${description}\n${transaction.nama}`,
        type: "CR",
        amount,
        balance,
        date: crawldate,
        crawldate,
        crawltime: unixTime,
        gateway: "billingotomatis",
        md5: md5Hash,
        banktime: formattedDate,
        invoiceno: 0,
        processstatus: 0,
        comment: "",
      };

      // Insert record into the database
      await new Promise((resolve, reject) => {
        connection.query(
          "INSERT INTO bilo_mutasi_bank SET ?",
          record,
          (error, results) => {
            if (error) {
              reject(error);
            } else {
              console.log("Record inserted successfully.");
              resolve();
            }
          }
        );
      });
    }

    // Close the database connection
    connection.end();
  } catch (error) {
    console.error("Error: ", error);
  }
};

runScrapperAndAppend();
