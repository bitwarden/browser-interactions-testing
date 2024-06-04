import fs from "fs";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
  TestStatus,
  TestStep,
} from "@playwright/test/reporter";

class MarkdownReporter implements Reporter {
  lines: string[];
  outputFolder: string;
  steps: string;
  totalFailedTests: number;
  totalPassedTests: number;
  totalSkippedTests: number;
  totalTests: number;

  constructor(options: { outputFolder?: string } = {}) {
    this.lines = [];
    this.outputFolder = options.outputFolder || ".";
    this.steps = "";
    this.totalFailedTests = 0;
    this.totalPassedTests = 0;
    this.totalSkippedTests = 0;
    this.totalTests = 0;
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    // @TODO report on pass/failure of steps
    if (step.category === "test.step") {
      this.steps += `- ${step.title}\n`;
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const resultStatus = result.status;
    this.totalTests++;

    if (resultStatus === "passed") {
      this.totalPassedTests++;
    }

    if (resultStatus === "skipped") {
      this.totalSkippedTests++;
    }

    if (["failed", "timedOut", "interrupted"].includes(resultStatus)) {
      this.totalFailedTests++;
    }

    let testSummary =
      "\n<details><summary><h2>" +
      getSymbolByStatus(resultStatus) +
      ` (${resultStatus}) ` +
      `${test.parent.title} > ${test.title}` +
      "</h2></summary>\n" +
      `<h3>${test.parent.parent?.title || ""}</h3>\n\n`;

    if (this.steps !== "") {
      testSummary += this.steps;
    }

    if (test.annotations.length) {
      let isFirstIssueAnnotation = true;
      testSummary += "\n<h3>Details</h3>\n\n";

      for (const { type, description } of test.annotations) {
        if (type === "issue") {
          if (!isFirstIssueAnnotation) {
            // Close previous issue annotation details
            testSummary += `</details>`;
          } else {
            isFirstIssueAnnotation = false;
          }

          testSummary += `<details><summary><h4>${description}</h4></summary>\n\n`;
        }

        if (type === "issue-details") {
          // Issue details that belong to the parent issue; relies on array order
          testSummary += `- ${description}\n`;
        }
      }
      // Close last issue annotation details
      testSummary += "</details>\n";
    }

    // Close parent test summary details
    testSummary += "\n</details>";

    this.lines = [...this.lines, testSummary];

    this.steps = "";
  }

  onEnd(result: FullResult) {
    const markdownDoc = [
      "# Test Summary",
      `\nTotal tests: ${this.totalTests} | Passed: ${this.totalPassedTests} | Failed: ${this.totalFailedTests} | Skipped: ${this.totalSkippedTests}\n`,
      ...this.lines,
    ].join("\n");

    fs.writeFileSync(
      `${__dirname}/${this.outputFolder}/test-summary.md`,
      markdownDoc,
    );
  }
}

function getSymbolByStatus(status: TestStatus) {
  if (status === "skipped") {
    return "⏭";
  }

  if (status === "passed") {
    return "✅";
  }

  // "failed" | "timedOut" | "interrupted"
  else {
    return "❌";
  }
}

export default MarkdownReporter;
