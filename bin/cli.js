#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import inquirer from "inquirer";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".git-cleaner.json");

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getProtectedBranches(config) {
  return config.protected || ["main", "master", "prod", "develop", "staging"];
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function isGitRepo() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch() {
  return execSync("git branch --show-current").toString().trim();
}

function getAllLocalBranches() {
  return execSync("git branch")
    .toString()
    .split("\n")
    .map((b) => b.replace(/^\*?\s+/, "").trim())
    .filter(Boolean);
}

function deleteBranch(branch, force = false) {
  const flag = force ? "-D" : "-d";
  execSync(`git branch ${flag} "${branch}"`, { stdio: "pipe" });
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

const LOGO = `
${chalk.hex("#F97316").bold("  ╔═╗╦╔╦╗  ")}${chalk.hex("#FB923C")("╔╗ ╦═╗╔═╗╔╗╔╔═╗╦ ╦")}
${chalk.hex("#F97316").bold("  ║ ╦║ ║   ")}${chalk.hex("#FB923C")("╠╩╗╠╦╝╠═╣║║║║  ╠═╣")}
${chalk.hex("#F97316").bold("  ╚═╝╩ ╩   ")}${chalk.hex("#FB923C")("╚═╝╩╚═╩ ╩╝╚╝╚═╝╩ ╩")}
${chalk.hex("#FDBA74")("  ╔═╗╦  ╔═╗╔═╗╔╗╔╔═╗╦═╗")}
${chalk.hex("#FDBA74")("  ║  ║  ║╣ ╠═╣║║║║╣ ╠╦╝")}
${chalk.hex("#FDBA74")("  ╚═╝╩═╝╚═╝╩ ╩╝╚╝╚═╝╩╚═")}
`;

function printHeader() {
  console.clear();
  console.log(LOGO);
  console.log(chalk.gray("  ─────────────────────────────────────────\n"));
}

function printProtectedList(protected_) {
  console.log(chalk.bold.yellow("  🔒 Protected branches (will never be deleted):"));
  protected_.forEach((b) => console.log(chalk.yellow(`     • ${b}`)));
  console.log();
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function runClean(options = {}) {
  if (!isGitRepo()) {
    console.log(chalk.red("\n  ✖ Not inside a Git repository.\n"));
    process.exit(1);
  }

  const config = loadConfig();
  const protected_ = getProtectedBranches(config);
  const current = getCurrentBranch();
  const allBranches = getAllLocalBranches();

  // Add current branch to protected set for this run
  const safeSet = new Set([...protected_, current]);
  const deletable = allBranches.filter((b) => !safeSet.has(b));

  printHeader();
  printProtectedList(protected_);

  if (current) {
    console.log(chalk.cyan(`  📍 Current branch: ${chalk.bold(current)} (protected for this session)\n`));
  }

  if (deletable.length === 0) {
    console.log(chalk.green("  ✔ Nothing to delete — all branches are protected.\n"));
    return;
  }

  console.log(chalk.bold(`  Found ${chalk.white(deletable.length)} branch(es) eligible for deletion:\n`));

  let toDelete;

  if (options.all) {
    toDelete = deletable;
  } else {
    const { selected } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selected",
        message: chalk.bold("Select branches to delete") + chalk.gray(" (space to toggle, enter to confirm):"),
        choices: deletable.map((b) => ({
          name: b,
          value: b,
          checked: options.selectAll || false,
        })),
        pageSize: 20,
      },
    ]);
    toDelete = selected;
  }

  if (toDelete.length === 0) {
    console.log(chalk.yellow("\n  Nothing selected. Bye!\n"));
    return;
  }

  console.log();
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.red.bold(`  ⚠️  Delete ${toDelete.length} branch(es)? This cannot be undone.`),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("\n  Aborted.\n"));
    return;
  }

  const { force } = await inquirer.prompt([
    {
      type: "confirm",
      name: "force",
      message: chalk.gray("  Force delete (-D) even if branches are unmerged?"),
      default: true,
    },
  ]);

  console.log();
  let deleted = 0,
    failed = 0;

  for (const branch of toDelete) {
    try {
      deleteBranch(branch, force);
      console.log(chalk.green(`  ✔ Deleted: ${branch}`));
      deleted++;
    } catch (err) {
      const msg = err.stderr?.toString().trim() || err.message;
      console.log(chalk.red(`  ✖ Failed:  ${branch}`) + chalk.gray(` — ${msg}`));
      failed++;
    }
  }

  console.log(
    `\n  ${chalk.green.bold(`${deleted} deleted`)}${failed ? chalk.red(`  ${failed} failed`) : ""}` +
      chalk.gray("  ·  done.\n")
  );
}

async function runConfig() {
  const config = loadConfig();
  const current = getProtectedBranches(config);

  printHeader();
  console.log(chalk.bold("  ⚙️  Manage protected branches\n"));
  console.log(chalk.gray("  Current list: ") + chalk.yellow(current.join(", ") + "\n"));

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "➕  Add a protected branch", value: "add" },
        { name: "➖  Remove a protected branch", value: "remove" },
        { name: "✏️   Replace entire list", value: "replace" },
        { name: "🔄  Reset to defaults", value: "reset" },
        { name: "← Back / Exit", value: "exit" },
      ],
    },
  ]);

  if (action === "exit") return;

  if (action === "add") {
    const { branch } = await inquirer.prompt([
      { type: "input", name: "branch", message: "Branch name to protect:" },
    ]);
    if (branch.trim()) {
      config.protected = [...new Set([...current, branch.trim()])];
      saveConfig(config);
      console.log(chalk.green(`\n  ✔ Added "${branch.trim()}" to protected list.\n`));
    }
  }

  if (action === "remove") {
    const { toRemove } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "toRemove",
        message: "Select branches to unprotect:",
        choices: current,
      },
    ]);
    config.protected = current.filter((b) => !toRemove.includes(b));
    saveConfig(config);
    console.log(chalk.green(`\n  ✔ Removed: ${toRemove.join(", ")}\n`));
  }

  if (action === "replace") {
    const { list } = await inquirer.prompt([
      {
        type: "input",
        name: "list",
        message: "Enter branch names (comma-separated):",
        default: current.join(", "),
      },
    ]);
    config.protected = list.split(",").map((b) => b.trim()).filter(Boolean);
    saveConfig(config);
    console.log(chalk.green("\n  ✔ Protected list updated.\n"));
  }

  if (action === "reset") {
    delete config.protected;
    saveConfig(config);
    console.log(chalk.green("\n  ✔ Reset to defaults: main, master, prod, develop, staging\n"));
  }
}

function printHelp() {
  printHeader();
  console.log(`  ${chalk.bold("Usage:")}

  ${chalk.cyan("git-cleaner")}                 Interactive branch deletion
  ${chalk.cyan("git-cleaner --all")}            Select all deletable branches (still confirms)
  ${chalk.cyan("git-cleaner config")}           Manage your protected branches list
  ${chalk.cyan("git-cleaner --help")}           Show this help

  ${chalk.bold("Config file:")} ${chalk.gray(CONFIG_PATH)}

  ${chalk.bold("How it works:")}
  • Branches in your protected list are ${chalk.yellow("never")} shown for deletion
  • Your current checked-out branch is always protected
  • You can use ${chalk.cyan("-D")} (force) or ${chalk.cyan("-d")} (safe, merged only)

  ${chalk.bold("Protected defaults:")} main, master, prod, develop, staging
`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
} else if (args.includes("config")) {
  runConfig().catch(console.error);
} else {
  runClean({ all: args.includes("--all"), selectAll: args.includes("--select-all") }).catch(console.error);
}
