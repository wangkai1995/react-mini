import * as CommonApi from "./common";
import * as HookApi from './hook';
import { Component,Suspense } from './classComponent';

var React = {
  ...CommonApi,
  ...HookApi,
   Component,
   Suspense,
};

export default React as any
