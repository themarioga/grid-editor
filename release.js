#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prepare a major, minor or patch release.
 */
const types = ['major', 'minor', 'patch'];
const type = process.argv[2];
const typeIndex = types.indexOf(type);
if (process.argv.length != 3 || !types.includes(type)) {
  console.error(`Usage: ./${path.basename(process.argv[1])} [major|minor|patch]`);
  process.exit(1);
}

// Get the current version from package.json. Git tags are not a reliable
// source: `git tag -l` sorts alphabetically, so it puts v1.0.9 after v1.0.10
// and picks up any non-version tag, and a repo with no tags yields nothing.
const currentVersion = JSON.parse(fs.readFileSync('package.json')).version;
const versionParts = currentVersion.trim().split('.').map(p => parseInt(p, 10));
if (versionParts.length !== 3 || versionParts.some(isNaN)) {
  console.error(`Could not parse version "${currentVersion}" from package.json`);
  process.exit(1);
}
console.log(`Current version: ${currentVersion}`);

// Create new version
const newVersionParts = versionParts
  .slice()
  .map((value, i) => {
    if (i == typeIndex) { value++; }
    if (i > typeIndex) { value = 0; }
    return value;
  });
const newVersion = newVersionParts.join('.');
const newTag = 'v' + newVersion;
console.log(`New version tag: ${newTag}`);

const existingTags = execSync('git tag -l').toString().split('\n');
if (existingTags.includes(newTag)) {
  console.error(`Tag ${newTag} already exists`);
  process.exit(1);
}

execSync('npm run build', { stdio: 'inherit' });
replaceInFile('package.json', /"version": "[0-9.]+"/, `"version": "${newVersion}"`);
replaceInFile('bower.json', /"version": "[0-9.]+"/, `"version": "${newVersion}"`);
// package-lock.json records the version twice: at the top level and on the
// root package entry. Both must match package.json or npm publish complains.
// This is a JSON edit, not a regex: the lockfile has a "version" key for every
// dependency and a regex would rewrite all of them.
setLockfileVersion('package-lock.json', newVersion);
execSync('git add -A');

confirm(`This will:
* committing to git
* git tag
* git push
* npm publish

Please  check git staging area

Type y to confirm: `).then((answer) => {
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('Aborted. The version bump is staged but not committed.');
    process.exit(1);
  }
  execSync(`git commit -m ${newTag}`, { stdio: 'inherit' });
  execSync(`git tag ${newTag}`, { stdio: 'inherit' });
  execSync(`git push`, { stdio: 'inherit' });
  execSync(`git push origin ${newTag}`, { stdio: 'inherit' });
  execSync(`npm publish`, { stdio: 'inherit' });
});


function confirm(question) {
  return new Promise((resolve) => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

function replaceInFile(filename, searchValue, replaceValue) {
  const contents = fs.readFileSync(filename).toString();
  if (!searchValue.test(contents)) {
    console.error(`Could not find a version to replace in ${filename}`);
    process.exit(1);
  }
  return fs.writeFileSync(filename, contents.replace(searchValue, replaceValue));
}

function setLockfileVersion(filename, version) {
  const lock = JSON.parse(fs.readFileSync(filename));
  lock.version = version;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = version;
  }
  // npm writes the lockfile with 2-space indent and a trailing newline.
  return fs.writeFileSync(filename, JSON.stringify(lock, null, 2) + '\n');
}
