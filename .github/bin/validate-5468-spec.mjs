import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

const require = createRequire(import.meta.url);
const expected = JSON.parse(
  readFileSync('.github/bin/spec-5468-expectations.json', 'utf8')
);

function checkResults(tests, failures, contract) {
  assert.equal(tests, contract.tests, 'Unexpected test count');
  assert.deepEqual(
    failures.sort((a, b) => a.title.localeCompare(b.title)),
    [...contract.failures].sort((a, b) => a.title.localeCompare(b.title)),
    'Expected only the documented baseline assertion failures'
  );
}

function flatten(suite, titles = []) {
  const parents = [...titles, suite.name].filter(Boolean);
  return [
    ...suite.tests.map(test => ({
      ...test,
      title: [...parents, test.name].join(' > ')
    })),
    ...suite.suites.flatMap(child => flatten(child, parents))
  ];
}

rmSync('tmp/spec-5468-unit.json', { force: true });
const unit = spawnSync(
  'pnpm',
  [
    'exec',
    'web-test-runner',
    '--config',
    '.github/bin/spec-5468-wtr.config.mjs'
  ],
  { stdio: 'inherit', timeout: 240000 }
);
assert.ifError(unit.error);
assert.equal(unit.status, 1, 'Baseline unit regressions must fail');
const sessions = JSON.parse(readFileSync('tmp/spec-5468-unit.json', 'utf8'));
assert.equal(sessions.length, 1);
assert.equal(sessions[0].status, 'FINISHED');
assert.deepEqual(sessions[0].errors, [], 'Unexpected runner errors');
const tests = flatten(sessions[0].testResults);
assert.ok(
  tests.every(test => !test.skipped),
  'No tests may be skipped'
);
checkResults(
  tests.length,
  tests
    .filter(test => !test.passed)
    .map(test => ({ title: test.title, message: test.error.message })),
  expected.unit
);

const browser = process.env.WTR_BROWSER;
assert.ok(['chrome', 'firefox'].includes(browser));
const builder = new Builder().forBrowser(browser);
if (browser === 'chrome') {
  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  );
  if (process.env.CHROME_BIN) {
    options.setBinaryPath(process.env.CHROME_BIN);
  }
  builder
    .setChromeOptions(options)
    .setChromeService(
      new chrome.ServiceBuilder(
        process.env.CHROMEDRIVER_BIN || require('chromedriver').path
      )
    );
} else {
  const options = new firefox.Options().addArguments('-headless');
  if (process.env.FIREFOX_BIN) {
    options.setBinary(process.env.FIREFOX_BIN);
  }
  builder.setFirefoxOptions(options);
}

const driver = await builder.build();
try {
  await driver.get(`http://localhost:9876/${expected.integration.url}`);
  const result = await driver.wait(
    () => driver.executeScript('return window.mochaResults || null'),
    120000,
    'Integration tests did not complete'
  );
  writeFileSync(
    'tmp/spec-5468-integration.json',
    JSON.stringify(result, null, 2)
  );
  assert.equal(result.pending, 0, 'No tests may be pending');
  assert.equal(result.tests, result.passes + result.failures);
  assert.equal(result.failures, result.reports.length);
  checkResults(
    result.tests,
    result.reports.map(report => ({
      title: [...report.titles, report.name].join(' > '),
      message: report.message
    })),
    expected.integration
  );
} finally {
  await driver.quit();
}

process.stdout.write('Exact baseline regressions and all controls verified.\n');
