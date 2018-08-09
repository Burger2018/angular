/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {existsSync, lstatSync, readFileSync, readdirSync} from 'fs';
import {basename, resolve} from 'path';

import {PackageTransformer} from './transform/package_transformer';

export function mainNgcc(args: string[]): number {
  const formats = args[0] ? args[0].split(',') : ['fesm2015', 'esm2015', 'fesm5', 'esm5'];
  const packagePaths = args[1] ? [resolve(args[1])] : findPackagesToCompile();

  const transformer = new PackageTransformer();
  packagePaths.forEach(packagePath => {
    formats.forEach(format => {
      console.warn(`Compiling ${packagePath} : ${format}`);
      transformer.transform(packagePath, format);
    });
  });

  return 0;
}

// TODO - consider nested node_modules

/**
 * Check whether the given folder needs to be included in the ngcc compilation.
 * We do not care about folders that are:
 *
 * - symlinks
 * - node_modules
 * - do not contain a package.json
 * - do not have a typings property in package.json
 * - do not have an appropriate metadata.json file
 *
 * @param folderPath The absolute path to the folder.
 * @param folderName The final segment of the folder path.
 */
function hasMetadataFile(folderPath: string): boolean {
  const folderName = basename(folderPath);
  if (lstatSync(folderPath).isSymbolicLink() || folderName === 'node_modules') {
    return false;
  }
  const packageJsonPath = resolve(folderPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.typings) {
    return false;
  }
  // TODO: avoid if packageJson contains built marker
  const metadataPath =
      resolve(folderPath, packageJson.typings.replace(/\.d\.ts$/, '.metadata.json'));
  return existsSync(metadataPath);
}

/**
 * Look for packages that need to be compiled.
 * The function will recurse into folders that start with `@...`, e.g. `@angular/...`.
 *  Without an argument it starts at `node_modules`.
 */
function findPackagesToCompile(folder: string = 'node_modules'): string[] {
  const path = resolve(folder);
  const packagesToCompile: string[] = [];
  readdirSync(path).filter(p => !p.startsWith('.')).forEach(p => {
    const packagePath = resolve(path, p);
    if (p.startsWith('@')) {
      packagesToCompile.push(...findPackagesToCompile(packagePath));
    } else {
      packagesToCompile.push(packagePath);
    }
  });

  return packagesToCompile.filter(path => recursiveDirTest(path, hasMetadataFile));
}

function recursiveDirTest(dir: string, test: (dir: string) => boolean): boolean {
  return test(dir) || readdirSync(dir).some(segment => {
    const path = resolve(dir, segment);
    return lstatSync(path).isDirectory() && recursiveDirTest(path, test);
  });
}