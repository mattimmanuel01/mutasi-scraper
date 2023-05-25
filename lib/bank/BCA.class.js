const ScraperBank = require("../BrowserClasses");
const { UA } = require("../helper/UA");
const BCASelectors = require("../helper/selector/BCASelector");
const BCAParser = require("../helper/Parser");

class ScrapBCA extends ScraperBank {
  constructor(user, pass, args) {
    super(user, pass, args);
  }

  /**
   * Login to BCA
   * @date 2023-05-23
   * @returns {Promise <>}
   */
  async login() {
    const page = await this.launchBrowser();
    try {
      await page.setUserAgent(UA());
      await page.goto(BCASelectors.LOGIN_PAGE.url, {
        waitUntil: "networkidle2",
      });
      await page.reload({ waitUntil: "domcontentloaded" });

      await page.type(BCASelectors.LOGIN_PAGE.userField, this.user, {
        delay: 100,
      });
      await page.waitForSelector(BCASelectors.LOGIN_PAGE.passField);
      await page.type(BCASelectors.LOGIN_PAGE.passField, this.pass);
      await this.sleep(700);

      const navigationPromise = page.waitForNavigation({
        waitUntil: "networkidle2",
      });
      const clickPromise = page.click(BCASelectors.LOGIN_PAGE.submitButton);

      await Promise.race([
        Promise.all([navigationPromise, clickPromise]),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Timeout: No action after clicking submitButton")
              ),
            10000
          )
        ),
      ]);

      page.on("dialog", async (dialog) => {
        await dialog.accept();
        throw new Error(dialog.message());
      });

      return page;
    } catch (e) {
      await this.closeBrowser(page);
      console.error("Error login, Timeout.");
      return null;
    }
  }

  /**
   * Get Settlement from selected date
   * @date 2023-04-17
   * @param {string} tglawal ( Harus berbentuk string )
   * @param {string} blnawal ( Harus berbentuk string )
   * @param {string} tglakhir ( Harus berbentuk string )
   * @param {string} blnakhir ( Harus berbentuk string )
   * @returns {Promise}
   */
  async getSettlement(tglawal, blnawal, tglakhir, blnakhir) {
    const page = await this.login();
    let newPage;
    if (!page) throw new Error("Login failed");
    try {
      await page.goto(BCASelectors.SETTLEMENT_PAGE.url, {
        waitUntil: "networkidle2",
      });
      await page.reload({
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(BCASelectors.SETTLEMENT_PAGE.settlementLink);
      const settlementLinkPromise = page.click(
        BCASelectors.SETTLEMENT_PAGE.settlementLink
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Settlement link timeout")), 10000)
      );
      await Promise.race([settlementLinkPromise, timeoutPromise]);

      const pageTarget = page.target();
      const newTarget = await page
        .browser()
        .waitForTarget((target) => target.opener() === pageTarget);
      newPage = await newTarget.page();
      await newPage.setUserAgent(UA());
      await newPage.waitForSelector("#startDt", {
        waitUntil: "networkidle2",
      });
      await newPage;
      await newPage.reload({
        waitUntil: "networkidle2",
      });
      const padStart2 = (num) => num.toString().padStart(2, "0");
      await newPage.select(
        BCASelectors.SETTLEMENT_PAGE.startDateField,
        padStart2(tglawal)
      );
      await newPage.select(
        BCASelectors.SETTLEMENT_PAGE.startMonthField,
        blnawal.toString()
      );
      await newPage.select(
        BCASelectors.SETTLEMENT_PAGE.endDateField,
        padStart2(tglakhir)
      );
      await newPage.select(
        BCASelectors.SETTLEMENT_PAGE.endMonthField,
        blnakhir.toString()
      );
      await newPage.waitForSelector(BCASelectors.SETTLEMENT_PAGE.submitButton);
      await newPage.click(BCASelectors.SETTLEMENT_PAGE.submitButton, {
        delay: 1500,
      });
      await newPage.waitForNavigation();
      await newPage.waitForSelector(
        BCASelectors.SETTLEMENT_PAGE.settlementTable,
        {
          waitUntil: "networkidle2",
        }
      );
      await page.waitForTimeout(3000);
      const result = await newPage.evaluate(() => document.body.innerHTML);
      let parser = new BCAParser(result, BCASelectors.PARSING_FIELD);
      let resultsettlement = parser.parse();
      const exists = await this.checkIfReturnToLogin(
        newPage,
        BCASelectors.LOGIN_PAGE.userField
      );
      if (exists) {
        throw new Error("Loopback detected");
      }
      if (newPage) {
        await this.logoutAndClose(newPage);
      } else {
        await this.logoutAndClose(page);
      }
      return resultsettlement;
    } catch (error) {
      console.error(error);
      if (newPage) {
        await this.logoutAndClose(newPage);
      } else {
        await this.logoutAndClose(page);
      }
      throw error;
    }
  }

  /**
   * Function to logout and close the browser
   * @date 2023-04-17
   * @param {string} page
   * @returns {Promise}
   */
  async logoutAndClose(page) {
    await page.waitForTimeout(3000); // Wait for any necessary actions or processes before logging out
    await page.goto(BCASelectors.LOGOUT_PAGE.url, {
      waitUntil: "networkidle2",
    });

    await page.close(); // Close the page
    await page.browser().close(); // Close the browser
  }

  /**
   * Function to check if the return to login page element exists
   * @date 2023-04-17
   * @param {string} page
   * @param {string} selector
   * @returns {Promise}
   */
  async checkIfReturnToLogin(page, selector) {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = ScrapBCA;
