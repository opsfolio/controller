import {
  artfPersist as ap,
  artfPersistDoc as apd,
  colors,
  contextMgr as cm,
  docopt,
  extend as ex,
  fs,
  govnImCore as gimc,
  govnImTrSQL as gimtr,
  govnImTrSqlDia as dia,
  govnSvcVersion as gsv,
  inflect,
  inspect as insp,
  path,
  safety,
  shell,
  specModule as sm,
  uuid,
  valueMgr as vm,
} from "./deps.ts";
import * as model from "./models/common.gim.ts";

export function determineVersion(importMetaURL: string): Promise<string> {
  return gsv.determineVersionFromRepoTag(
    importMetaURL,
    { repoIdentity: "opsfolio/controller" },
  );
}

export interface CommandHandlerCaller {
  readonly calledFromMetaURL: string;
  readonly calledFromMain: boolean;
  readonly version: string;
  readonly projectHome?: string;
}

export function defaultDocoptSpec(caller: CommandHandlerCaller): string {
  const targetable = "[<target>]...";
  const usesSingleSqliteDB = "[--db=<db-file>]";
  const usesMultipleSqliteDBs = "[--db=<db-file>]...";
  const observable = "[--verbose] [--dry-run]";
  const transactionID = "[--tx-id=<uuid>]";
  const hookable = `[--hooks=<glob>]... [--arg=<name>]... [--argv=<value>]...`;
  return `
Opsfolio ${caller.version}.

Usage:
  opsfolio inspect sql ${targetable} ${hookable}
  opsfolio sqlite create ${targetable} ${usesSingleSqliteDB} ${transactionID} ${observable}
  opsfolio sqlite describe ${targetable} ${usesMultipleSqliteDBs} ${transactionID} ${observable}
  opsfolio sqlite clean ${targetable} ${usesMultipleSqliteDBs} ${transactionID} ${observable}
  opsfolio osquery atc init ${usesMultipleSqliteDBs} ${transactionID} ${hookable} ${observable}
  opsfolio osquery atc clean ${transactionID} ${hookable} ${observable}
  opsfolio clean ${targetable} ${usesMultipleSqliteDBs} ${transactionID} ${hookable} ${observable}
  opsfolio doctor ${targetable} ${hookable} 
  opsfolio version ${targetable} ${hookable}
  opsfolio -h | --help

Options:
  <target>                                One or more identifiers that the hook will understand
  <sql-dest-file>                         SQL destination file, "-" for STDOUT [default: -]
  --db=DB_FILE                            Name of SQLite database file [default: opsfolio.db]
  --tx-id=TRANSACTION_ID                  Unique ID that can be used to identify a build or generator sequence (defaults to UUIDv4.generate())
  --hooks=GLOB                            Glob of hooks which will be found and executed [default: {content,data,static}/**/*.hook-pubctl.*]
  --arg=NAME                              Name of an arbitrary argument to pass to handler
  --argv=VALUE                            Value of an arbitrary argument to pass to handler, must match same order as --arg
  --dry-run                               Show what will be done (but don't actually do it) [default: false]
  --verbose                               Be explicit about what's going on [default: false]
  -h --help                               Show this screen
`;
}

export interface OpsfolioCommandHandler<
  OC extends OpsfolioController,
> {
  (ctx: OC): Promise<true | void>;
}

export enum HookLifecycleStep {
  DOCTOR = "doctor",
  INSPECT = "inspect",
  CLEAN = "clean",
  UPDATE = "update",
}

export interface HookContext<OC extends OpsfolioController>
  extends ex.CommandProxyPluginContext<OC>, insp.InspectionContext, cm.Context {
  readonly pluginPathRelativeToProjectHome: string;
  readonly createMutableTextArtifact: (
    options: ap.MutableTextArtifactOptions,
  ) => ap.MutableTextArtifact;
  readonly persistExecutableScriptArtifact: (
    artifactName: vm.TextValue,
    artifact: ap.TextArtifact,
    options?: ap.PersistArtifactOptions,
  ) => ap.PersistenceResult | undefined;
  readonly persistTextArtifact: (
    artifactName: vm.TextValue,
    artifact: ap.TextArtifact,
    options?: ap.PersistArtifactOptions,
  ) => ap.PersistenceResult | undefined;
  readonly onInspectionDiags?: (
    // deno-lint-ignore no-explicit-any
    id: insp.InspectionDiagnostics<any, Error>,
    suggestedCategory?: string,
  ) => void;
}

export function isHookContext<PC extends OpsfolioController>(
  o: unknown,
): o is HookContext<PC> {
  if (!ex.isCommandProxyPluginContext(o)) return false;
  const isHookCtx = safety.typeGuard<HookContext<PC>>("persistTextArtifact");
  return isHookCtx(o);
}

// deno-lint-ignore require-await
export async function defaultOpsfolioHook<
  OC extends OpsfolioController,
>(hc: HookContext<OC>): Promise<ex.DenoFunctionModuleHandlerResult> {
  return defaultOpsfolioHookSync(hc);
}

export function defaultOpsfolioHookSync<
  OC extends OpsfolioController,
>(hc: HookContext<OC>): ex.DenoFunctionModuleHandlerResult {
  switch (hc.command.proxyCmd) {
    case HookLifecycleStep.DOCTOR:
      if (hc.container.oco.isVerbose) {
        console.log(
          colors.dim(`[${hc.plugin.source.abbreviatedName}]`),
          `No external dependencies in`,
          colors.cyan(hc.plugin.source.friendlyName),
        );
      }
      return defaultOpsfolioHookResultEnhancer(hc);

    case HookLifecycleStep.INSPECT:
    case HookLifecycleStep.CLEAN:
    case HookLifecycleStep.UPDATE:
      if (hc.container.oco.isVerbose) {
        console.log(
          colors.dim(`[${hc.plugin.source.abbreviatedName}]{INFO}`),
          `command '${colors.yellow(hc.command.proxyCmd)}' not implemented in`,
          colors.cyan(hc.plugin.source.friendlyName),
        );
      }
      return defaultOpsfolioHookResultEnhancer(hc);
  }

  if (hc.container.oco.isVerbose) {
    console.log(
      colors.dim(`[${hc.plugin.source.abbreviatedName}]{INFO}`),
      `unknown command '${colors.yellow(hc.command.proxyCmd)}' in ${
        colors.cyan(hc.plugin.source.friendlyName)
      }`,
    );
  }
  return defaultOpsfolioHookResultEnhancer(hc);
}

/**
 * defaultPubCtlHookResultEnhancer should be called by all Deno TypeScript
 * hooks so that we can do centralized "enhancing" of the results of any
 * hook. This allows logging, middleware, and other standard function 
 * handling capabilities.
 * @param dfmhResult 
 */
export function defaultOpsfolioHookResultEnhancer<
  PC extends OpsfolioController,
>(
  hc: HookContext<PC>,
  dfmhResult?: ex.DenoFunctionModuleHandlerResult,
): ex.DenoFunctionModuleHandlerResult {
  if (!dfmhResult) return {};
  return dfmhResult;
}

export interface CliArgsSupplier {
  readonly cliArgs: docopt.DocOptions;
}

export interface OpsfolioControllerOptions {
  readonly projectHome: string;
  readonly targets: string[];
  readonly hooksGlobs: string[];
  readonly arguments: Record<string, string>;
  readonly transactionID: string;
  readonly isVerbose: boolean;
  readonly isDryRun: boolean;
  readonly hostID: string;
}

export function opsfolioControllerOptions(
  caller: CommandHandlerCaller,
  cliArgs: docopt.DocOptions,
): OpsfolioControllerOptions {
  const {
    "--project": projectArg,
    "--hooks": hooksArg,
    "--verbose": verboseArg,
    "--dry-run": dryRunArg,
    "--tx-id": transactionIdArg,
    "<target>": targetsArg,
    "--arg": argNames,
    "--argv": argsValues,
  } = cliArgs;
  const projectHome = projectArg
    ? projectArg as string
    : (caller.projectHome || Deno.cwd());
  const hooksGlobs = hooksArg as string[];
  const isDryRun = dryRunArg ? true : false;
  const isVerbose = isDryRun || (verboseArg ? true : false);
  const transactionID = transactionIdArg
    ? transactionIdArg.toString()
    : uuid.v4.generate();
  const targets = targetsArg as string[];

  const defaultHookGlobs = ["*.hook-opsfolio.*"];
  defaultHookGlobs.forEach((dg) => {
    if (!hooksGlobs.find((hg) => hg == dg)) hooksGlobs.unshift(dg);
  });

  const customArgs: Record<string, string> = {};
  if (argNames) {
    const an = argNames as string[];
    const av = argsValues as string[];

    if (an.length == av.length) {
      for (let i = 0; i < an.length; i++) {
        const key = an[i];
        const value = av[i];
        customArgs[key] = value;
      }
    } else {
      console.error(
        colors.brightRed("--arg and --argv must be balanced") + ": ",
        `there are ${colors.yellow(an.length.toString())} arg names and ${
          colors.yellow(av.length.toString())
        } values`,
      );
    }
  }

  const projectHomeAbs = path.isAbsolute(projectHome)
    ? projectHome
    : path.resolve(Deno.cwd(), projectHome);
  return {
    projectHome: projectHomeAbs,
    targets,
    hooksGlobs,
    transactionID,
    isDryRun,
    isVerbose,
    arguments: customArgs,
    hostID: Deno.hostname(), // TODO: make "hostID" CLI configurable
  };
}

export class OpsfolioControllerPluginsManager<
  O extends OpsfolioControllerOptions,
  C extends OpsfolioController,
> extends ex.fs.CommandProxyFileSystemPluginsManager<C> {
  readonly fsPH: ap.FileSystemPersistenceHandler;
  constructor(readonly pc: C, readonly cli: CliArgsSupplier, readonly pco: O) {
    super(
      pc,
      {}, // TODO add allowable commands for better error checking / typesafety?
      {
        discoveryPath: pco.projectHome,
        localFsSources: pco.hooksGlobs,
        shellCmdEnvVarsDefaultPrefix: "OPSFOLIOHOOK_",
      },
    );
    this.fsPH = new ap.FileSystemPersistenceHandler({
      projectPath: pco.projectHome,
      destPath: pco.projectHome,
      dryRun: pco.isDryRun,
      report: (ctx, ph, result) => {
        console.log(
          "Created",
          colors.yellow(
            typeof result === "string"
              ? result
              : result.finalArtifactNamePhysicalRel,
          ),
        );
      },
    });
  }

  createExecutePluginContext(
    command: ex.ProxyableCommand,
    plugin: ex.Plugin,
    options?: {
      readonly onActivity?: ex.PluginActivityReporter;
    },
  ): ex.CommandProxyPluginContext<C> {
    const result: HookContext<C> = {
      isContext: true,
      execEnvs: {
        isExecutionEnvironments: true,
        environmentsName: inflect.guessCaseValue(
          "OpsfolioControllerPluginsManager",
        ),
      },
      pluginPathRelativeToProjectHome:
        ex.fs.isFileSystemPluginSource(plugin.source)
          ? path.relative(
            this.pco.projectHome,
            path.dirname(plugin.source.absPathAndFileName),
          )
          : "(ex.fs.isFileSystemPluginSource(plugin.source) is false)",
      createMutableTextArtifact: (options) => {
        return this.fsPH.createMutableTextArtifact(result, options);
      },
      persistExecutableScriptArtifact: (artifactName, artifact, options?) => {
        return this.fsPH.persistTextArtifact(
          result,
          artifactName,
          artifact,
          { chmod: 0o755, ...options },
        );
      },
      persistTextArtifact: (artifactName, artifact, options?) => {
        return this.fsPH.persistTextArtifact(
          result,
          artifactName,
          artifact,
          options,
        );
      },
      onActivity: options?.onActivity || ((a) => {
        console.log(a.message);
        return a;
      }),
      container: this.executive,
      plugin,
      command,
    };
    return result;
  }

  enhanceShellCmd(
    pc: ex.CommandProxyPluginContext<C>,
    suggestedCmd: string[],
  ): string[] {
    if (!isHookContext(pc)) throw new Error("pc must be HookContext");
    const cmd = [...suggestedCmd];
    cmd.push(pc.command.proxyCmd);
    if (this.pco.targets.length > 0) {
      cmd.push(...this.pco.targets);
    }
    if (this.pco.isVerbose) cmd.push("--verbose");
    if (this.pco.isDryRun) cmd.push("--dry-run");
    for (
      const arg of Object.entries(pc.arguments || this.pco.arguments)
    ) {
      const [name, value] = arg;
      cmd.push(name, value);
    }
    return cmd;
  }

  prepareShellCmdEnvVars(
    pc: ex.CommandProxyPluginContext<C>,
    envVarsPrefix: string,
  ): Record<string, string> {
    const result = super.prepareShellCmdEnvVars(pc, envVarsPrefix);
    if (!isHookContext(pc)) throw new Error("pc must be HookContext");
    if (!ex.fs.isDiscoverFileSystemPluginSource(pc.plugin.source)) {
      throw new Error(
        "pc.plugin.source must be DiscoverFileSystemPluginSource",
      );
    }
    const hookHome = path.dirname(pc.plugin.source.absPathAndFileName);
    result[`${envVarsPrefix}BUILD_HOST_ID`] = this.pco.hostID;
    result[`${envVarsPrefix}TRANSACTION_ID`] = this.pco.transactionID;
    result[`${envVarsPrefix}VERBOSE`] = this.pco.isVerbose ? "1" : "0";
    result[`${envVarsPrefix}DRY_RUN`] = this.pco.isDryRun ? "1" : "0";
    result[`${envVarsPrefix}PROJECT_HOME_ABS`] =
      path.isAbsolute(this.pco.projectHome)
        ? this.pco.projectHome
        : path.join(Deno.cwd(), this.pco.projectHome);
    result[`${envVarsPrefix}PROJECT_HOME_REL`] = path.relative(
      hookHome,
      this.pco.projectHome,
    );
    result[`${envVarsPrefix}OPTIONS_JSON`] = JSON.stringify(
      this.cli.cliArgs,
    );
    if (this.pco.targets.length > 0) {
      result[`${envVarsPrefix}TARGETS`] = this.pco.targets.join(" ");
    }
    const cmdArgs = pc.arguments || this.pco.arguments;
    if (Object.keys(cmdArgs).length > 0) {
      result[`${envVarsPrefix}ARGS_JSON`] = JSON.stringify(cmdArgs);
    }
    return result;
  }
}

export class StringArrayPersistenceHandler implements ap.PersistenceHandler {
  readonly results: ap.PersistenceResult[] = [];
  readonly resultsMap: Map<string, ap.PersistenceResult> = new Map();
  readonly text: string[] = [];

  constructor() {}

  createMutableTextArtifact(
    ctx: cm.Context,
    options: ap.MutableTextArtifactOptions,
  ): ap.MutableTextArtifact {
    return new ap.DefaultTextArtifact(options);
  }

  public persistTextArtifact(
    ctx: cm.Context,
    artifactName: vm.TextValue,
    artifact: ap.TextArtifact,
    options?: ap.PersistArtifactOptions,
  ): ap.PersistenceResult {
    this.text.push(artifact.text(ctx));
    const finalLogical = vm.resolveTextValue(ctx, artifactName);
    const exists = this.resultsMap.get(finalLogical);
    if (!exists) {
      const pr = {
        origArtifactName: artifactName,
        finalArtifactNameLogical: finalLogical,
        finalArtifactNamePhysical: finalLogical,
        finalArtifactNamePhysicalRel: finalLogical,
        finalArtifactNamePhysicalAbs: finalLogical,
        artifactText: artifact.text(ctx),
        artifacts: [artifact],
        overwroteExisting: [],
      };
      this.resultsMap.set(finalLogical, pr);
      this.results.push(pr);
      return pr;
    } else {
      const pr = {
        ...exists,
        artifactText: exists.artifactText + artifact.textFragment(ctx),
        artifacts: [...exists.artifacts, artifact],
      };
      this.resultsMap.set(finalLogical, pr);
      return pr;
    }
  }

  handleError(
    ctx: cm.Context,
    artifactName: vm.TextValue,
    artifact: ap.TextArtifact,
    code: number,
    message: string,
  ): void {
    console.error(`[${code}] ${message} (${artifactName})`);
  }
}

export class OpsfolioController implements ex.PluginExecutive {
  readonly pluginsMgr: OpsfolioControllerPluginsManager<
    OpsfolioControllerOptions,
    OpsfolioController
  >;
  constructor(
    readonly cli: CliArgsSupplier,
    readonly oco: OpsfolioControllerOptions,
  ) {
    this.pluginsMgr = new OpsfolioControllerPluginsManager<
      OpsfolioControllerOptions,
      OpsfolioController
    >(this, cli, oco);
  }

  async initController(): Promise<void> {
    await this.pluginsMgr.init();
  }

  reportShellCmd(cmd: string): string {
    if (this.oco.isVerbose && !this.oco.isDryRun) {
      console.log(colors.brightCyan(cmd));
    }
    return cmd;
  }

  validateHooks(): void {
    for (const glob of this.oco.hooksGlobs) {
      console.log(`Searched for hooks in '${colors.yellow(glob)}'`);
    }

    let firstValid = true;
    for (const hook of this.pluginsMgr.plugins) {
      if (firstValid) {
        console.log("--", colors.brightCyan("Registered hooks"), "--");
        firstValid = false;
      }
      const hookCtx: HookContext<OpsfolioController> = {
        isContext: true,
        execEnvs: {
          isExecutionEnvironments: true,
          environmentsName: inflect.guessCaseValue("validateHooks"),
        },
        container: this,
        plugin: hook,
        command: { proxyCmd: HookLifecycleStep.DOCTOR },
        onActivity: (a: ex.PluginActivity): ex.PluginActivity => {
          if (this.oco.isVerbose) {
            console.log(a.message);
          }
          return a;
        },
        pluginPathRelativeToProjectHome:
          ex.fs.isFileSystemPluginSource(hook.source)
            ? path.relative(
              this.oco.projectHome,
              path.dirname(hook.source.absPathAndFileName),
            )
            : "(ex.fs.isFileSystemPluginSource(plugin.source) is false)",
        createMutableTextArtifact: (options) => {
          return new ap.DefaultTextArtifact(options);
        },
        persistExecutableScriptArtifact: () => {
          return undefined;
        },
        persistTextArtifact: () => {
          return undefined;
        },
      };
      if (ex.isShellExePlugin<OpsfolioController>(hook)) {
        if (hook.envVars) {
          console.log(
            colors.yellow(hook.source.friendlyName),
            colors.green(hook.nature.identity),
            colors.blue("will be called with environment variables"),
            hook.envVars(hookCtx),
          );
        } else {
          console.log(
            colors.yellow(hook.source.friendlyName),
            colors.green(hook.nature.identity),
          );
        }
        console.log(colors.dim(hook.shellCmd(hookCtx).join(" ")));
        continue;
      }
      if (ex.isDenoModulePlugin(hook)) {
        if (ex.isDenoFunctionModulePlugin(hook)) {
          console.log(
            colors.yellow(hook.source.friendlyName),
            colors.green(hook.nature.identity),
            hook.isAsync
              ? colors.brightBlue("async function Deno module")
              : colors.brightBlue("sync function Deno module"),
          );
        } else {
          console.log(
            colors.yellow(hook.source.friendlyName),
            colors.green(hook.nature.identity),
            ex.isActionPlugin(hook)
              ? colors.brightBlue("executable Deno module")
              : colors.brightBlue("not executable Deno module"),
          );
        }
      }
    }

    let firstInvalid = true;
    for (const ipr of this.pluginsMgr.invalidPlugins) {
      if (firstInvalid) {
        console.log(
          "--",
          colors.red("Hooks that could not be registered"),
          "--",
        );
        firstInvalid = false;
      }
      console.log(colors.yellow(ipr.source.systemID));
      for (const issue of ipr.issues) {
        console.warn(
          issue.diagnostics.map((d) => colors.red(d.toString())).join("\n"),
        );
      }
    }
  }

  async executeHooks(command: ex.ProxyableCommand): Promise<void> {
    await this.pluginsMgr.execute(command);
  }

  async inspect() {
    await this.executeHooks({ proxyCmd: HookLifecycleStep.INSPECT });
  }

  async clean() {
    await this.executeHooks({ proxyCmd: HookLifecycleStep.CLEAN });
  }

  // deno-lint-ignore require-await
  async informationModelSpec(): Promise<
    sm.Specification<gimc.InformationModel>
  > {
    return sm.specFactory.spec<gimc.InformationModel>(
      new model.CommonModel(),
    );
  }

  async inspectSQL(destFileName = "-") {
    if (destFileName == "-") {
      const ph = new ap.ConsolePersistenceHandler();
      const [ctx, imt] = gimtr.transformRdbmsModel(
        gimtr.RdbmsSqlTransformer,
        await this.informationModelSpec(),
        dia.SQLiteDialect,
        ph,
      );
    } else {
      // TODO allow saving SQL to a file
      throw new Error("Saving SQL to a file not implemented yet");
    }
  }

  async sqlite(
    dbFileName: string,
    options: {
      stdin?: (writer: Deno.Writer) => Promise<void>;
      isSuccess?: (code: number, dbFileName: string) => boolean;
      onSuccess?: (stdout: Uint8Array, dbFileName: string) => void;
      onError?: (
        stderr: Uint8Array,
        dbFileName: string,
        stdout: Uint8Array,
      ) => void;
    } = {},
  ) {
    const sqliteCmd = "sqlite3";
    if (!this.oco.isDryRun) {
      const p = Deno.run({
        cmd: [sqliteCmd, dbFileName],
        // Enable pipe between processes
        stdin: options.stdin ? "piped" : undefined,
        stdout: "piped",
        stderr: "piped",
      });
      if (!p.stdin) throw Error();

      if (options.stdin) {
        await options.stdin(p.stdin);
        p.stdin.close();
      }

      const isSuccess = options.isSuccess
        ? options.isSuccess
        : (code: number, dbFileName: string) => {
          return code === 0;
        };
      const { code } = await p.status();
      const stdout = await p.output();
      const stderr = await p.stderrOutput();
      if (isSuccess(code, dbFileName)) {
        if (options.onSuccess) options.onSuccess(stdout, dbFileName);
      } else {
        if (options.onError) options.onError(stderr, dbFileName, stdout);
      }
    } else {
      console.log(sqliteCmd, dbFileName);
    }
  }

  async sqliteCreate(dbFileName: string) {
    if (fs.existsSync(dbFileName)) {
      if (!this.oco.isDryRun) {
        Deno.removeSync(dbFileName);
      }
      if (this.oco.isDryRun || this.oco.isVerbose) {
        console.log("rm -f", colors.yellow(dbFileName));
      }
    }

    await this.sqlite(dbFileName, {
      stdin: async (writer) => {
        const ph = new StringArrayPersistenceHandler();
        const [ctx, imt] = gimtr.transformRdbmsModel(
          gimtr.RdbmsSqlTransformer,
          await this.informationModelSpec(),
          dia.SQLiteDialect,
          ph,
        );
        await writer.write(new TextEncoder().encode(ph.text.join("\n")));
      },
      onSuccess: this.oco.isVerbose
        ? (stdout, dbFileName) => {
          console.log(colors.green("created"), colors.yellow(dbFileName));
          Deno.stdout.write(stdout);
        }
        : undefined,
      onError: this.oco.isVerbose
        ? (stderr, dbFileName) => {
          console.log(colors.red("error creating"), colors.yellow(dbFileName));
          Deno.stderr.write(stderr);
        }
        : undefined,
    });
  }

  // deno-lint-ignore require-await
  async sqliteDescribe(databases: string[]) {
    databases.forEach(async (db) => {
      if (fs.existsSync(db)) {
        await this.sqlite(db, {
          stdin: async (writer) => {
            await writer.write(new TextEncoder().encode(".tables"));
          },
          onSuccess: this.oco.isVerbose
            ? (stdout) => {
              Deno.stdout.write(stdout);
            }
            : undefined,
          onError: this.oco.isVerbose
            ? (stderr) => {
              Deno.stderr.write(stderr);
            }
            : undefined,
        });
      }
    });
  }

  // deno-lint-ignore require-await
  async sqliteClean(databases: string[]) {
    databases.forEach((db) => {
      if (fs.existsSync(db)) {
        if (!this.oco.isDryRun) {
          Deno.removeSync(db);
        }
        if (this.oco.isDryRun || this.oco.isVerbose) {
          console.log("rm -f", colors.yellow(db));
        }
      }
    });
  }

  async osQueryATC() {
    // osQueryConfigATC(migration, pathSpec) : std.manifestJsonEx({
    //   auto_table_construction : {
    //     [table.name] : {
    //       query : "select %(columns)s FROM %(tableName)s" % { tableName: table.name, columns: std.join(', ', [column.name for column in table.columns]) },
    //       path : pathSpec % migration,
    //       columns : [column.name for column in table.columns]
    //     } for table in migration.tables
    //   }
    // }, "    ")
  }

  /** 
   * Update the opsfolio.ts that uses this library so that it's using the latest
   * version(s) of all dependencies. This requires the [udd](https://github.com/hayd/deno-udd) 
   * library to be present in the PATH.
   */
  async update() {
    const denoModules = this.pluginsMgr.plugins.filter((p) => {
      return ex.isDenoModulePlugin(p) &&
          ex.fs.isFileSystemPluginSource(p.source)
        ? true
        : false;
    }).map((p) => p.source.systemID);
    const updatePkgs = this.reportShellCmd(
      `udd opsfolio.ts ${denoModules.join(" ")}`,
    );
    await shell.runShellCommand(updatePkgs, {
      ...(this.oco.isVerbose
        ? shell.cliVerboseShellOutputOptions
        : shell.quietShellOutputOptions),
      dryRun: this.oco.isDryRun,
    });
    this.executeHooks({ proxyCmd: HookLifecycleStep.UPDATE });
  }
}

export async function inspectHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const { "inspect": inspect, "sql": sql } = ctx.cli.cliArgs;
  if (inspect && sql) {
    await ctx.inspectSQL();
    return true;
  }
}

export async function sqliteHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const {
    "sqlite": sqlite,
    "create": create,
    "describe": describe,
    "clean": clean,
    "--db": db,
  } = ctx.cli.cliArgs;
  if (sqlite) {
    if (create && Array.isArray(db) && db.length == 1) {
      await ctx.sqliteCreate(db[0]);
      return true;
    }
    if (describe && Array.isArray(db)) {
      await ctx.sqliteDescribe(db);
      return true;
    }
    if (clean && Array.isArray(db)) {
      await ctx.sqliteClean(db);
      return true;
    }
  }
}

export async function cleanHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const { "clean": clean } = ctx.cli.cliArgs;
  if (clean) {
    await ctx.clean();
    return true;
  }
}

export async function doctorHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const { "doctor": doctor } = ctx.cli.cliArgs;
  if (doctor) {
    await ctx.executeHooks({ proxyCmd: HookLifecycleStep.DOCTOR });
    return true;
  }
}

export async function updateHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const { "update": update } = ctx.cli.cliArgs;
  if (update) {
    await ctx.update();
    return true;
  }
}

export async function versionHandler(
  ctx: OpsfolioController,
): Promise<true | void> {
  const { "version": version } = ctx.cli.cliArgs;
  if (version) {
    console.log(
      `opsfolio ${colors.yellow(await determineVersion(import.meta.url))}`,
    );
    return true;
  }
}

export const commonHandlers = [
  inspectHandler,
  sqliteHandler,
  cleanHandler,
  doctorHandler,
  updateHandler,
  versionHandler,
];

export interface CommandHandlerSpecOptions<C extends OpsfolioController> {
  readonly docoptSpec?: (caller: CommandHandlerCaller) => string;
  readonly prepareControllerOptions?: (
    caller: CommandHandlerCaller,
    cliArgs: docopt.DocOptions,
  ) => OpsfolioControllerOptions;
  readonly prepareController?: (
    caller: CommandHandlerCaller,
    cliArgs: docopt.DocOptions,
    options: OpsfolioControllerOptions,
  ) => C;
}

export async function CLI<
  C extends OpsfolioController,
>(
  caller: CommandHandlerCaller,
  options: CommandHandlerSpecOptions<C> = {},
): Promise<void> {
  const { prepareController } = options;
  try {
    const docoptSpecFn = options.docoptSpec || defaultDocoptSpec;
    const prepareControllerOptions = options.prepareControllerOptions ||
      opsfolioControllerOptions;
    const cliArgs = docopt.default(docoptSpecFn(caller));
    const pchOptions = prepareControllerOptions(caller, cliArgs);
    const context = prepareController
      ? prepareController(caller, cliArgs, pchOptions)
      : new OpsfolioController({ cliArgs }, pchOptions);
    await context.initController();
    let handled: true | void;
    for (const handler of commonHandlers) {
      handled = await handler(context);
      if (handled) break;
    }
    if (!handled) {
      console.error("Unable to handle validly parsed docoptSpec:");
      console.dir(cliArgs);
    }
  } catch (e) {
    console.error(e.message);
  }
}

// All `opsfolio.ts` files should have something like this as part of their main
// entry point:
// ---------------------------------------------------------------------------
// if (import.meta.main) {
//   await opsfolio.CLI({
//     calledFromMain: import.meta.main,
//     calledFromMetaURL: import.meta.url,
//     version: "v0.1.0",
//   });
// }
