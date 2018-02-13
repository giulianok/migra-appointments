const _ = require("lodash/fp");
const { range } = require("lodash");
const cheerio = require("cheerio");
const Request = require("request-promise");
const phantomjs = require("phantomjs-prebuilt");
const webdriverio = require("webdriverio");
const wdOpts = { desiredCapabilities: { browserName: "phantomjs" } };
const fs = require("fs");

const _URL = "https://my.uscis.gov/en/appointment";

let _List = [
  { name: "Miami", zipCode: 33137 },
  { name: "West Palm Beach", zipCode: 33404 },
  { name: "New York", zipCode: 10004 },
  { name: "Springfield", zipCode: 62703 },
  { name: "Wichita", zipCode: 67260 }
];

let _Generic = range(10000, 40000, 40);

_List = [..._Generic.map(zipCode => ({ name: "N/A", zipCode })), ..._List];

const _found = [];

function delay(time) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), time);
  });
}

function Info(...args) {
  return console.info(...args, "\n");
}

function save(fileName, data) {
  fs.writeFileSync(
    `./${fileName}.txt`,
    _.join(";\r", _.map(({ name, zipCode }) => `${name}, ${zipCode}`, _found))
  );
}

async function getAppointments(browser, list = [], index = 0) {
  console.log("\n\n", "-------------", "\n\n");

  if (index >= list.length) {
    return Info("*** WE ARE DONE! ***");
  }

  const city = list[index];

  Info(
    `-- ${index} -- LOOKING AT ${city.name}, ${city.zipCode} | ${
      _found.length
    } appointments found`
  );

  if (index % 5) {
    await delay(1000 * 5);
  }

  await browser.url(_URL);

  Info("Click on find button");

  await browser.click("#create-button");

  Info("Get page title");

  let title = await browser.getText(
    ".with-padding-bottom-15.with-margin-bottom-30.with-border-bottom.page-header"
  );

  Info(`Set input value with ${city.zipCode}`);

  await browser.setValue("#appointments_appointment_zip", city.zipCode);

  Info("Click on find");

  await browser.click("#field_office_query");

  Info("Delay...");

  await delay(1000 * 3);

  try {
    let error = await browser.getText(".uscis-alert-content");
    if (error) {
      Info(error);
      return getAppointments(browser, list, ++index);
    }
  } catch (e) {}

  Info("Select the first location");

  await browser.click(`.appointment-field-offices button:first-child`);

  Info("Delay...");

  await delay(1000);

  Info("Click on See Available Appointments");

  try {
    await browser.click(
      '.field-office-form.hide-field-office-form[style="display: block;"] input[value="See Available Appointments"]'
    );
  } catch (e) {
    await browser.click('input[value="See Available Appointments"]');
  }

  let status = await browser.getText(`.appointment-time-slots h4`);

  let isAvailable =
    status !==
    "Currently, there are no available appointments. Please check again tomorrow.";

  if (isAvailable) {
    Info(
      `HEY! There's appointments availables in ${city.name}, ${city.zipCode}`
    );
    let newCityName = await browser.getText(".field-office-header-name");
    if (!_.find(["name", newCityName], _found)) {
      _found.push({ name: newCityName, zipCode: city.zipCode });
    }
    save(`found-${city.zipCode}`, _found);
  } else {
    Info(status);
  }

  return getAppointments(browser, list, ++index);
}

async function checkMiami() {}

function Run() {
  Info(`Initializing... ${_List.length} zip codes to discover`);
  phantomjs.run("--webdriver=4444").then(async program => {
    let browser = webdriverio.remote(wdOpts).init();

    await getAppointments(browser, _List, 507);

    console.log(_found);
  });
}

Run();
