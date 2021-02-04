import * as ctl from "./controller.ts";

if (import.meta.main) {
  await ctl.CLI({
    calledFromMain: import.meta.main,
    calledFromMetaURL: import.meta.url,
    version: "v0.1.0",
  });
}
