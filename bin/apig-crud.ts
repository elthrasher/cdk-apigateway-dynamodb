#!/usr/bin/env node
import 'source-map-support/register';

import { App } from '@aws-cdk/core';

import { ApigCrudStack } from '../src/apig-crud-stack';

const app = new App();
new ApigCrudStack(app, 'ApigCrudStack');
