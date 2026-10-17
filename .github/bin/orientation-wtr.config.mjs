import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { default: base } = await import(
  pathToFileURL(path.join(process.cwd(), "test/wtr.config.mjs")).href
);
const omit = process.env.ORIENTATION_OMIT_INCOMPLETE === "1";

export default {
  ...base,
  files: ["test/checks/mobile/css-orientation-lock.js"],
  testRunnerHtml(testFramework) {
    const html = base.testRunnerHtml(testFramework);
    if (!omit) {
      return html;
    }
    const hook = "axe.testUtils.registerHooks();";
    if (!html.includes(hook)) {
      throw new Error(
        "Source test HTML no longer has the expected hook registration",
      );
    }
    return html.replace(
      hook,
      `${hook}
      const orientationMessages = axe._audit.data.checks['css-orientation-lock'].messages;
      const orientationOriginalMessage = orientationMessages.incomplete;
      let orientationProofCount = 0;
      beforeEach(() => {
        assert.isString(orientationOriginalMessage);
        assert.strictEqual(orientationMessages.incomplete, orientationOriginalMessage);
        delete orientationMessages.incomplete;
        assert.isFalse(Object.prototype.hasOwnProperty.call(orientationMessages, 'incomplete'));
      });
      afterEach(() => {
        assert.isFalse(Object.prototype.hasOwnProperty.call(orientationMessages, 'incomplete'));
        orientationMessages.incomplete = orientationOriginalMessage;
        assert.strictEqual(orientationMessages.incomplete, orientationOriginalMessage);
        console.log('ORIENTATION_MUTATION_PROOF:' + JSON.stringify({
          count: ++orientationProofCount,
          absentBeforeTest: true,
          absentAfterTest: true,
          restored: true
        }));
      });`,
    );
  },
  reporters: [
    ...base.reporters,
    {
      onTestRunFinished({ sessions }) {
        mkdirSync(path.dirname(process.env.ORIENTATION_RESULTS), {
          recursive: true,
        });
        writeFileSync(
          process.env.ORIENTATION_RESULTS,
          JSON.stringify(
            sessions.map(({ status, errors, testResults, logs }) => ({
              status,
              errors,
              testResults,
              logs,
            })),
            null,
            2,
          ),
        );
      },
    },
  ],
};
