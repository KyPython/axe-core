import { mkdirSync, writeFileSync } from 'node:fs';
import base from '../../test/wtr.config.mjs';

export default {
  ...base,
  files: ['test/core/utils/get-frame-contexts.js'],
  reporters: [
    ...base.reporters,
    {
      onTestRunFinished({ sessions }) {
        mkdirSync('tmp', { recursive: true });
        writeFileSync(
          'tmp/spec-5468-unit.json',
          JSON.stringify(
            sessions.map(({ status, errors, testResults }) => ({
              status,
              errors,
              testResults
            })),
            null,
            2
          )
        );
      }
    }
  ]
};
