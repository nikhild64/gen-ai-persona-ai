/**
 * Vitest setup mirroring Angular's `init-testbed.js` so specs can run via
 * `bunx vitest run` as well as `ng test`.
 */
import '@angular/compiler';
import { NgModule } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

const ANGULAR_TESTBED_SETUP = Symbol.for('@angular/cli/testbed-setup');

if (!(globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP]) {
  (globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP] = true;

  @NgModule({
    providers: [],
  })
  class TestModule {}

  getTestBed().initTestEnvironment(
    [BrowserTestingModule, TestModule],
    platformBrowserTesting(),
    {
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
    },
  );
}
